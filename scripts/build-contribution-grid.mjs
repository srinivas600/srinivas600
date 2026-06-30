import { execSync } from "child_process";
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

export function buildContributionsFromRepo(repoPath) {
  const template = generateScenarioContributions("full").contributions;
  const countsByDate = getCommitCountsByDate(repoPath);

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
  username = "srinivas600",
  repoPath = process.env.HITMEHARD_PATH || DEFAULT_REPO,
} = {}) {
  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repoContributions = buildContributionsFromRepo(repoPath);
  const snkCells = contributionsToSnkCells(repoContributions);

  if (!token) {
    console.log("No GitHub token — using hitmehard git history for the contribution grid.");
    return { contributions: repoContributions, snkCells, source: "hitmehard" };
  }

  try {
    const apiCells = await fetchGithubContributions(username, token);
    const countsByDate = Object.fromEntries(apiCells.map((c) => [c.date, c.count]));
    const repoCounts = getCommitCountsByDate(repoPath);

    const contributions = repoContributions.map((cell) => {
      const dateStr = cell.date.toISOString().slice(0, 10);
      const count = Math.max(countsByDate[dateStr] || 0, repoCounts[dateStr] || 0);
      return { ...cell, count, level: countToLevelName(count) };
    });

  const mergedSnkCells = contributionsToSnkCells(contributions);
    console.log("Merged GitHub API data with hitmehard git history.");
    return { contributions, snkCells: mergedSnkCells, source: "merged" };
  } catch (err) {
    console.warn(`GitHub API fetch failed (${err.message}); using hitmehard git history.`);
    return { contributions: repoContributions, snkCells, source: "hitmehard" };
  }
}
