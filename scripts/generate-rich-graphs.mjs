import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ArcadeRenderer,
  generateScenarioContributions,
} from "pacman-contribution-graph";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.resolve(ROOT, "dist");
const DENSITY = 0.7;
const SEED = 600;

const GAMES = [
  { game: "pacman", light: "pacman-contribution-graph.svg", dark: "pacman-contribution-graph-dark.svg" },
  { game: "breakout", light: "breakout-contribution-graph.svg", dark: "breakout-contribution-graph-dark.svg" },
  { game: "galaga", light: "galaga-contribution-graph.svg", dark: "galaga-contribution-graph-dark.svg" },
];

function createDenseContributions(density = DENSITY, seed = SEED) {
  const full = generateScenarioContributions("full").contributions;
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const levels = [
    "FIRST_QUARTILE",
    "SECOND_QUARTILE",
    "THIRD_QUARTILE",
    "FOURTH_QUARTILE",
  ];
  const counts = [1, 4, 8, 12];

  return full.map((cell) => {
    if (rand() >= density) return { ...cell, level: "NONE", count: 0 };
    const i = Math.floor(rand() * levels.length);
    return { ...cell, level: levels[i], count: counts[i] };
  });
}

function createSnkCells(density = DENSITY, seed = SEED, weeks = 53, days = 7) {
  let s = seed;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const cells = [];
  for (let x = 0; x < weeks; x++) {
    for (let y = 0; y < days; y++) {
      const level =
        rand() < density ? (1 + Math.floor(rand() * 4)) : 0;
      cells.push({
        x,
        y,
        date: `2025-w${x}-d${y}`,
        count: level * 3,
        level,
      });
    }
  }
  return cells;
}

async function renderArcadeGame({ game, light, dark }, contributions) {
  for (const [theme, filename] of [
    ["github", light],
    ["github-dark", dark],
  ]) {
    const outPath = path.join(DIST, filename);
    await new Promise((resolve, reject) => {
      const renderer = new ArcadeRenderer({
        game,
        platform: "scenario",
        scenario: "full",
        username: "demo",
        gameTheme: theme,
        contributions,
        svgCallback: (svg) => {
          fs.writeFileSync(outPath, svg);
          resolve();
        },
      });
      renderer.start().catch(reject);
    });
    console.log(`✓ ${filename}`);
  }
}

async function renderSnake(cells) {
  const { spawnSync } = await import("child_process");
  const result = spawnSync(
    process.execPath,
    [
      path.join(__dirname, "node_modules", "tsx", "dist", "cli.mjs"),
      path.join(__dirname, "generate-snake-rich.ts"),
    ],
    {
      cwd: path.join(__dirname),
      env: { ...process.env, SNK_CELLS_JSON: JSON.stringify(cells) },
      stdio: "inherit",
    }
  );
  if (result.status !== 0) {
    throw new Error("Snake generation failed");
  }
}

async function main() {
  fs.mkdirSync(DIST, { recursive: true });

  const contributions = createDenseContributions();
  const active = contributions.filter((c) => c.level !== "NONE").length;
  console.log(
    `Generating graphs at ~${Math.round(DENSITY * 100)}% activity (${active}/${contributions.length} active days)`
  );

  for (const game of GAMES) {
    await renderArcadeGame(game, contributions);
  }

  const cells = createSnkCells();
  const snkActive = cells.filter((c) => c.level > 0).length;
  console.log(`Snake grid: ${snkActive}/${cells.length} active days`);
  await renderSnake(cells);

  console.log(`\nDone. Output written to ${DIST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
