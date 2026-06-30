import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { userContributionToGrid } from "../snk-main/packages/action/userContributionToGrid.ts";
import { getBestRoute } from "../snk-main/packages/solver/getBestRoute.ts";
import { getPathToPose } from "../snk-main/packages/solver/getPathToPose.ts";
import { snake4 } from "../snk-main/packages/types/__fixtures__/snake.ts";
import { createSvg } from "../snk-main/packages/svg-creator/index.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DIST = path.resolve(ROOT, "dist");

const cells = JSON.parse(process.env.SNK_CELLS_JSON ?? "[]");

const grid = userContributionToGrid(cells);
const snake = snake4;
const chain = getBestRoute(grid, snake)!;
chain.push(...getPathToPose(chain.slice(-1)[0], snake)!);

const paletteGithub = {
  colorDots: { 1: "#9be9a8", 2: "#40c463", 3: "#30a14e", 4: "#216e39" },
  colorEmpty: "#ebedf0",
  colorDotBorder: "#1b1f230a",
  colorSnake: "purple",
  sizeCell: 16,
  sizeDot: 12,
  sizeDotBorderRadius: 2,
};

const paletteDark = {
  colorDots: { 1: "#0e4429", 2: "#006d32", 3: "#26a641", 4: "#39d353" },
  colorEmpty: "#161b22",
  colorDotBorder: "#010409",
};

const animationOptions = { step: 8, frameDuration: 100 };

fs.mkdirSync(DIST, { recursive: true });

fs.writeFileSync(
  path.join(DIST, "snake.svg"),
  createSvg(grid, cells, chain, paletteGithub, animationOptions)
);
console.log("✓ snake.svg");

fs.writeFileSync(
  path.join(DIST, "snake-dark.svg"),
  createSvg(
    grid,
    cells,
    chain,
    { ...paletteGithub, dark: paletteDark },
    animationOptions
  )
);
console.log("✓ snake-dark.svg");
