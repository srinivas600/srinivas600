// Generates a neofetch-style profile card (dark + light) as self-contained SVGs.
// Left column: ASCII art. Right column: neofetch-style key/value info.
// Run: node scripts/generate-neofetch.mjs

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "profile");

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

// ASCII portrait produced by photo-to-ascii.mjs; falls back to a robot logo.
const ASCII_FILE = join(__dirname, "ascii-art.json");
const FALLBACK_ASCII = [
  "      ┌───────────────────────┐",
  "      │   ▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄   │",
  "      │  █                 █  │",
  "      │  █   ●         ●   █  │",
  "      │  █                 █  │",
  "      │  █       ───       █  │",
  "      │  █   ╲_________╱   █  │",
  "      │  █                 █  │",
  "      │   ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀   │",
  "      └─────┬───────────┬─────┘",
  "            │           │",
  "        ┌───┴───┐   ┌───┴───┐",
  "        │  { }  │   │  </>  │",
  "        └───────┘   └───────┘",
];
const ASCII = existsSync(ASCII_FILE)
  ? JSON.parse(readFileSync(ASCII_FILE, "utf8"))
  : FALLBACK_ASCII;

// Each row: { key, value } renders "key: value"; { header } / { rule } / null (blank).
const INFO = [
  { header: "srinivas600" },
  { rule: true },
  { key: "OS", value: "Data Scientist & AI Engineer" },
  { key: "Host", value: "Evoke Technologies" },
  { key: "Uptime", value: "Ex-Turing · Ex-Infosys" },
  { key: "Kernel", value: "ML / DL / GenAI" },
  { key: "Location", value: "India" },
  { key: "IDE", value: "Cursor · VS Code · Jupyter" },
  null,
  { key: "Languages.Programming", value: "Python, SQL, Bash" },
  { key: "Languages.ML", value: "PyTorch, TensorFlow, scikit-learn" },
  { key: "Languages.Real", value: "English, Telugu, Hindi" },
  null,
  { key: "Focus.LLMs", value: "RAG, Fine-Tuning, SFT, RLHF" },
  { key: "Focus.Agents", value: "Terminal-Bench, SWE-bench, OSWorld" },
  { key: "Focus.MLOps", value: "Docker, K8s, AWS, Terraform" },
  null,
  { key: "Contact.Email", value: "srinivasnallamati987@gmail.com" },
  { key: "Contact.LinkedIn", value: "srinivas-nallamati" },
  { key: "Contact.Instagram", value: "according_to_faradays_law" },
  null,
  { palette: true },
];

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

const THEMES = {
  dark: {
    file: "neofetch-dark.svg",
    bg: "#0d1117",
    frame: "#30363d",
    titlebar: "#161b22",
    title: "#8b949e",
    art: "#56d364",
    header: "#f0f6fc",
    rule: "#484f58",
    key: "#58a6ff",
    sep: "#8b949e",
    value: "#c9d1d9",
  },
  light: {
    file: "neofetch-light.svg",
    bg: "#ffffff",
    frame: "#d0d7de",
    titlebar: "#f6f8fa",
    title: "#57606a",
    art: "#1a7f37",
    header: "#1f2328",
    rule: "#d0d7de",
    key: "#0969da",
    sep: "#57606a",
    value: "#1f2328",
  },
};

const PALETTE = ["#ff5f56", "#ffbd2e", "#27c93f", "#58a6ff", "#bc8cff", "#39d0d8", "#c9d1d9"];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const WIDTH = 860;
const TITLEBAR_H = 40;
const PAD_TOP = TITLEBAR_H + 30;
const LINE_H = 20;
const ART_X = 40;
const INFO_X = 372;
const FONT = "ui-monospace, 'SFMono-Regular', 'Cascadia Mono', Consolas, 'Liberation Mono', Menlo, monospace";
const FONT_SIZE = 14;
// The photo portrait is many rows tall, so it gets its own compact line height.
const ART_FONT_SIZE = 9;
const ART_LINE_H = 9.5;

const infoHeight = INFO.length * LINE_H;
const artHeight = ASCII.length * ART_LINE_H;
const bodyHeight = Math.max(infoHeight, artHeight);
const HEIGHT = PAD_TOP + bodyHeight + 20;
const artTop = PAD_TOP + Math.max(0, (infoHeight - artHeight) / 2);

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

function renderArt(t) {
  const tspans = ASCII.map(
    (line, i) =>
      `<tspan x="${ART_X}" dy="${i === 0 ? 0 : ART_LINE_H}" xml:space="preserve">${esc(line)}</tspan>`
  ).join("");
  return `<text x="${ART_X}" y="${artTop}" fill="${t.art}" font-family="${FONT}" font-size="${ART_FONT_SIZE}" xml:space="preserve">${tspans}</text>`;
}

function renderInfo(t) {
  const parts = [];
  INFO.forEach((row, i) => {
    const y = PAD_TOP + i * LINE_H;
    if (row === null) return;
    if (row.header) {
      parts.push(
        `<text x="${INFO_X}" y="${y}" fill="${t.header}" font-family="${FONT}" font-size="${FONT_SIZE}" font-weight="bold">${esc(row.header)}</text>`
      );
      return;
    }
    if (row.rule) {
      parts.push(
        `<text x="${INFO_X}" y="${y}" fill="${t.rule}" font-family="${FONT}" font-size="${FONT_SIZE}">${"-".repeat(11)}</text>`
      );
      return;
    }
    if (row.palette) {
      const size = 13;
      const gap = 5;
      PALETTE.forEach((c, j) => {
        const x = INFO_X + j * (size + gap);
        parts.push(`<rect x="${x}" y="${y - size + 2}" width="${size}" height="${size}" rx="2" fill="${c}" />`);
      });
      return;
    }
    parts.push(
      `<text x="${INFO_X}" y="${y}" font-family="${FONT}" font-size="${FONT_SIZE}">` +
        `<tspan fill="${t.key}" font-weight="bold">${esc(row.key)}</tspan>` +
        `<tspan fill="${t.sep}">: </tspan>` +
        `<tspan fill="${t.value}">${esc(row.value)}</tspan>` +
        `</text>`
    );
  });
  return parts.join("");
}

function renderSVG(t) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-label="srinivas600 neofetch profile card">
  <rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="10" fill="${t.bg}" stroke="${t.frame}" />
  <path d="M0.5 10.5 A10 10 0 0 1 10.5 0.5 H${WIDTH - 10.5} A10 10 0 0 1 ${WIDTH - 0.5} 10.5 V${TITLEBAR_H} H0.5 Z" fill="${t.titlebar}" stroke="${t.frame}" />
  <circle cx="22" cy="20" r="6" fill="#ff5f56" />
  <circle cx="42" cy="20" r="6" fill="#ffbd2e" />
  <circle cx="62" cy="20" r="6" fill="#27c93f" />
  <text x="${WIDTH / 2}" y="25" text-anchor="middle" fill="${t.title}" font-family="${FONT}" font-size="13">srinivas600@github ~ neofetch</text>
  ${renderArt(t)}
  ${renderInfo(t)}
</svg>
`;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const key of Object.keys(THEMES)) {
  const t = THEMES[key];
  const out = join(OUT_DIR, t.file);
  writeFileSync(out, renderSVG(t), "utf8");
  console.log(`wrote ${out}`);
}
