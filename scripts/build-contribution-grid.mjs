import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { generateScenarioContributions } from "pacman-contribution-graph";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO = path.resolve(__dirname, "../../hitmehard");

const LEVELS = ["NONE", "FIRST_QUARTILE", "SECOND_QUARTILE", "THIRD_QUARTILE", "FOURTH_QUARTILE"];

function countToLevel(count) {
  if (count <= 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 9) return 3;
  return 4;
}

function countToLevelName(count) {
  return LEVELS[countToLevel(count)];
}

export function getCommitCountsByDate(repoPath = process.env.HITMEHARD_PATH || DEFAULT_REPO) {
  const output = execSync("git log --format=%ad --date=short", {
    cwd: repoPath,
    encoding: "utf8",
  });

  const counts = {};
  for (const line of output.trim().split("\n")) {
    if (!line) continue;
    counts[line] = (counts[line] || 0) + 1;
  }
  return counts;
}

export function hasLocalRepo(repoPath = process.env.HITMEHARD_PATH || DEFAULT_REPO) {
  return fs.existsSync(path.join(repoPath, ".git"));
}

export function buildContributionsFromCounts(countsByDate) {
  const template = generateScenarioContributions("full").contributions;
  return template.map((cell) => {
    const dateStr = cell.date.toISOString().slice(0, 10);
    const count = countsByDate[dateStr] || 0;
    return {
      ...cell,
      count,
      level: countToLevelName(count),
    };
  });
}

export function buildContributionsFromRepo(repoPath) {
  return buildContributionsFromCounts(getCommitCountsByDate(repoPath));
}

export function contributionsToSnkCells(contributions) {
  return contributions.map((cell, index) => {
    const level = countToLevel(cell.count);
    return {
      x: Math.floor(index / 7),
      y: index % 7,
      date: cell.date.toISOString().slice(0, 10),
      count: cell.count,
      level,
    };
  });
}

export async function fetchGithubContributions(username, token) {
  const query = `
    query ($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays {
                contributionCount
                contributionLevel
                weekday
                date
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  if (!json.data?.user) throw new Error("GitHub user not found");

  return json.data.user.contributionsCollection.contributionCalendar.weeks.flatMap(
    ({ contributionDays }, x) =>
      contributionDays.map((d) => ({
        x,
        y: d.weekday,
        date: d.date,
        count: d.contributionCount,
        level:
          (d.contributionLevel === "FOURTH_QUARTILE" && 4) ||
          (d.contributionLevel === "THIRD_QUARTILE" && 3) ||
          (d.contributionLevel === "SECOND_QUARTILE" && 2) ||
          (d.contributionLevel === "FIRST_QUARTILE" && 1) ||
          0,
      }))
  );
}

export async function buildContributionData({
  username = process.env.GITHUB_USERNAME || "srinivas600",
  repoPath = process.env.HITMEHARD_PATH || DEFAULT_REPO,
} = {}) {
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const localRepo = hasLocalRepo(repoPath);

  if (token) {
    try {
      const apiCells = await fetchGithubContributions(username, token);
      const countsByDate = Object.fromEntries(apiCells.map((c) => [c.date, c.count]));

      if (localRepo) {
        const repoCounts = getCommitCountsByDate(repoPath);
        for (const [date, count] of Object.entries(repoCounts)) {
          countsByDate[date] = Math.max(countsByDate[date] || 0, count);
        }
      }

      const contributions = buildContributionsFromCounts(countsByDate);
      const snkCells = contributionsToSnkCells(contributions);
      const source = localRepo ? "merged" : "github";
      console.log(`Using ${source} contribution data for ${username}.`);
      return { contributions, snkCells, source };
    } catch (err) {
      if (!localRepo) throw err;
      console.warn(`GitHub API fetch failed (${err.message}); using hitmehard git history.`);
    }
  }

  if (!localRepo) {
    throw new Error(
      "No local hitmehard repo and no GitHub token. Set GH_PAT/GITHUB_TOKEN in CI, or clone hitmehard locally."
    );
  }

  const contributions = buildContributionsFromRepo(repoPath);
  const snkCells = contributionsToSnkCells(contributions);
  console.log("No GitHub token — using hitmehard git history for the contribution grid.");
  return { contributions, snkCells, source: "hitmehard" };
}
