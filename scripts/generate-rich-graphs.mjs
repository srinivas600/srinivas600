import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ArcadeRenderer } from "pacman-contribution-graph";
import { buildContributionData } from "./build-contribution-grid.mjs";
import { renderContributionCrawl, renderMarioParkour } from "./generate-pathfinder-games.mjs";
import { patchBombermanCompletion } from "./patch-bomberman-completion.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.resolve(ROOT, "dist");

const GAMES = [
  { game: "pacman", light: "pacman-contribution-graph.svg", dark: "pacman-contribution-graph-dark.svg" },
  { game: "breakout", light: "breakout-contribution-graph.svg", dark: "breakout-contribution-graph-dark.svg" },
  { game: "galaga", light: "galaga-contribution-graph.svg", dark: "galaga-contribution-graph-dark.svg" },
  { game: "bomberman", light: "bomberman-contribution-graph.svg", dark: "bomberman-contribution-graph-dark.svg" },
  { game: "minesweeper", light: "minesweeper-contribution-graph.svg", dark: "minesweeper-contribution-graph-dark.svg" },
];

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
        username: "srinivas600",
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

  const { contributions, snkCells, source } = await buildContributionData();
  const active = contributions.filter((c) => c.level !== "NONE").length;
  console.log(
    `Generating graphs from ${source} data (${active}/${contributions.length} active days in the last year)`
  );

  patchBombermanCompletion();

  for (const game of GAMES) {
    await renderArcadeGame(game, contributions);
  }

  const snkActive = snkCells.filter((c) => c.level > 0).length;
  console.log(`Snake grid: ${snkActive}/${snkCells.length} active days`);
  await renderSnake(snkCells);

  console.log("\nPuzzle & pathfinding games:");
  await renderContributionCrawl();
  await renderMarioParkour(contributions);

  console.log(`\nDone. Output written to ${DIST}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
