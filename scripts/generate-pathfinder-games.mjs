import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildContributionData } from "./build-contribution-grid.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");
const CRAWL_DIR = path.join(__dirname, ".contribution-crawl");
const USERNAME = "srinivas600";

/** @param {{ level?: string }[]} contributions */
export function contributionsToWeeks(contributions) {
  const cols = Math.ceil(contributions.length / 7);
  const weeks = [];
  for (let x = 0; x < cols; x++) {
    const days = [];
    for (let y = 0; y < 7; y++) {
      const cell = contributions[x * 7 + y];
      days.push({ contributionLevel: cell?.level || "NONE" });
    }
    weeks.push({ contributionDays: days });
  }
  return weeks;
}

function ensureContributionCrawl() {
  if (fs.existsSync(path.join(CRAWL_DIR, "package.json"))) return;

  console.log("Cloning Contribution-Crawl...");
  execSync(
    "git clone --depth 1 https://github.com/MaskiCoding/Contribution-Crawl.git .contribution-crawl",
    { cwd: __dirname, stdio: "inherit" }
  );
}

export async function renderContributionCrawl() {
  ensureContributionCrawl();

  if (!fs.existsSync(path.join(CRAWL_DIR, "dist", "index.js"))) {
    execSync("npm ci && npm run build", { cwd: CRAWL_DIR, stdio: "inherit" });
  }

  const token = process.env.GH_PAT || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const args = ["dist/index.js", USERNAME, DIST];
  if (!token) {
    console.warn("No GitHub token — generating Contribution Crawl with mock data.");
    args.push("--mock");
  }

  const result = spawnSync(process.execPath, args, {
    cwd: CRAWL_DIR,
    env: { ...process.env, GITHUB_TOKEN: token },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Contribution Crawl generation failed");
  }

  for (const file of ["contribution-crawl-light.svg", "contribution-crawl-dark.svg"]) {
    if (fs.existsSync(path.join(DIST, file))) {
      console.log(`✓ ${file}`);
    }
  }
}

export async function renderMarioParkour(contributions) {
  const script = path.join(__dirname, "generate-mario-path.py");
  const weeksJson = path.join(__dirname, ".mario-weeks.json");
  const data = contributions ?? (await buildContributionData()).contributions;
  fs.writeFileSync(weeksJson, JSON.stringify(contributionsToWeeks(data)));

  const result = spawnSync("python", [script], {
    cwd: __dirname,
    env: {
      ...process.env,
      GITHUB_ACTOR: USERNAME,
      MARIO_WEEKS_JSON: weeksJson,
      MARIO_OUTPUT_LIGHT: path.join(DIST, "mario-contribution.svg"),
      MARIO_OUTPUT_DARK: path.join(DIST, "mario-contribution-dark.svg"),
    },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Mario parkour generation failed (is Python installed?)");
  }

  for (const file of ["mario-contribution.svg", "mario-contribution-dark.svg"]) {
    if (fs.existsSync(path.join(DIST, file))) {
      console.log(`✓ ${file}`);
    }
  }
}
