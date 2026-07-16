// Converts a photo into an ASCII-art grid for the neofetch card.
// Usage: node scripts/photo-to-ascii.mjs <imagePath> [cols] [invert]
//   invert = 1  -> dark pixels become dense glyphs (good for portraits on dark bg)
// Writes scripts/ascii-art.json (array of strings) and prints a preview.

import { Jimp } from "jimp";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Tuned defaults for the profile portrait (dp_wp.png). Override via args/env.
const imgPath = process.argv[2];
const COLS = Number(process.argv[3] || 42);
const INVERT = String(process.argv[4] ?? "0") === "1";
const CROP = process.env.CROP || "0.19,0.03,0.67,0.98";
// Ramp from empty -> dense ink.
const RAMP = " .`':,^-~=+ilo*csvxtj?F72Y5S#%8@$".split("");
// Character cell aspect (glyph advance width / line height) for our SVG font.
const CELL_ASPECT = 0.46;

if (!imgPath) {
  console.error("Provide an image path.");
  process.exit(1);
}

const image = await Jimp.read(imgPath);

// Crop via CROP="left,top,right,bottom" as fractions (0..1).
if (CROP) {
  const [l, t, r, b] = CROP.split(",").map(Number);
  const { width: w0, height: h0 } = image.bitmap;
  const x = Math.round(l * w0);
  const y = Math.round(t * h0);
  image.crop({ x, y, w: Math.round((r - l) * w0), h: Math.round((b - t) * h0) });
}

const { width: iw, height: ih } = image.bitmap;
const rows = Math.max(1, Math.round(COLS * (ih / iw) * CELL_ASPECT));

const CONTRAST = process.env.CONTRAST ? Number(process.env.CONTRAST) : 0.22;
image.greyscale().contrast(CONTRAST).resize({ w: COLS, h: rows });

// Gather brightness values.
const vals = [];
for (let y = 0; y < rows; y++) {
  for (let x = 0; x < COLS; x++) {
    const idx = (y * COLS + x) * 4;
    vals.push(image.bitmap.data[idx]); // greyscale -> R=G=B
  }
}
const min = Math.min(...vals);
const max = Math.max(...vals);
const span = Math.max(1, max - min);

const lines = [];
for (let y = 0; y < rows; y++) {
  let line = "";
  for (let x = 0; x < COLS; x++) {
    let b = (image.bitmap.data[(y * COLS + x) * 4] - min) / span; // 0..1 stretched
    // Slight contrast curve to deepen midtones.
    b = Math.min(1, Math.max(0, (b - 0.5) * 1.25 + 0.5));
    let density = INVERT ? 1 - b : b;
    // Optionally drop blown highlights (e.g. white shirt / bright wall) to empty.
    const clip = process.env.HICLIP ? Number(process.env.HICLIP) : 0;
    if (clip && b > clip) density = 0;
    const ci = Math.min(RAMP.length - 1, Math.round(density * (RAMP.length - 1)));
    line += RAMP[ci];
  }
  lines.push(line.replace(/\s+$/g, "")); // trim trailing spaces
}

writeFileSync(join(__dirname, "ascii-art.json"), JSON.stringify(lines, null, 2), "utf8");
console.log(`cols=${COLS} rows=${rows} invert=${INVERT}`);
console.log(lines.join("\n"));
