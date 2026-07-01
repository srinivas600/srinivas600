import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, "..", "dist");

const SHEEP = 3;
const TIGERS = 3;
const WIDTH = 920;
const HEIGHT = 360;
const TRIP_MS = 6500;

const THEMES = {
  light: {
    skyTop: "#7dd3fc",
    skyBottom: "#e0f2fe",
    sun: "#fde047",
    cloud: "#ffffff",
    panel: "#ffffff",
    panelStroke: "#cbd5e1",
    panelShadow: "#94a3b880",
    grass: "#4ade80",
    grassDark: "#16a34a",
    river: "#38bdf8",
    riverDeep: "#0284c7",
    riverHighlight: "#7dd3fc88",
    bankLabel: "#0f172a",
    muted: "#64748b",
    accent: "#0ea5e9",
    progressBg: "#e2e8f0",
    progressFill: "#22c55e",
    danger: "#ef4444",
    wood: "#92400e",
    woodLight: "#b45309",
    sheepBg: "#f8fafc",
    sheepRing: "#cbd5e1",
    tigerBg: "#ffedd5",
    tigerRing: "#fb923c",
    farmerSkin: "#fcd34d",
    farmerCoat: "#2563eb",
  },
  dark: {
    skyTop: "#0f172a",
    skyBottom: "#1e293b",
    sun: "#fbbf24",
    cloud: "#334155",
    panel: "#1e293b",
    panelStroke: "#334155",
    panelShadow: "#00000066",
    grass: "#166534",
    grassDark: "#14532d",
    river: "#1d4ed8",
    riverDeep: "#1e3a8a",
    riverHighlight: "#3b82f666",
    bankLabel: "#f1f5f9",
    muted: "#94a3b8",
    accent: "#38bdf8",
    progressBg: "#334155",
    progressFill: "#4ade80",
    danger: "#f87171",
    wood: "#78350f",
    woodLight: "#92400e",
    sheepBg: "#f8fafc",
    sheepRing: "#64748b",
    tigerBg: "#431407",
    tigerRing: "#ea580c",
    farmerSkin: "#fcd34d",
    farmerCoat: "#3b82f6",
  },
};

function isSafe(sheep, tigers) {
  return sheep === 0 || tigers <= sheep;
}

function solveRiverCrossing(sheep, tigers) {
  const key = (s) => `${s.ls},${s.lt},${s.rs},${s.rt},${s.boat}`;
  const start = { ls: sheep, lt: tigers, rs: 0, rt: 0, boat: 0 };
  const queue = [{ state: start, pathSteps: [] }];
  const visited = new Set([key(start)]);

  while (queue.length) {
    const { state, pathSteps } = queue.shift();
    if (state.ls === 0 && state.lt === 0 && state.rs === sheep && state.rt === tigers) {
      return pathSteps;
    }

    const onLeft = state.boat === 0;
    const src = onLeft ? { s: state.ls, t: state.lt } : { s: state.rs, t: state.rt };
    const moves = [{ ds: 0, dt: 0 }];

    for (let ds = 0; ds <= src.s; ds++) {
      for (let dt = 0; dt <= src.t; dt++) {
        if (ds + dt >= 1 && ds + dt <= 2) moves.push({ ds, dt });
      }
    }

    for (const { ds, dt } of moves) {
      const next = { ...state };
      if (onLeft) {
        next.ls -= ds;
        next.lt -= dt;
        next.rs += ds;
        next.rt += dt;
        next.boat = 1;
      } else {
        next.rs -= ds;
        next.rt -= dt;
        next.ls += ds;
        next.lt += dt;
        next.boat = 0;
      }

      if (isSafe(next.ls, next.lt) && isSafe(next.rs, next.rt)) {
        const k = key(next);
        if (!visited.has(k)) {
          visited.add(k);
          queue.push({ state: next, pathSteps: [...pathSteps, { ds, dt, state: next }] });
        }
      }
    }
  }

  return null;
}

function applyMove(state, animal, toRight) {
  const next = { ...state, cargo: animal };
  if (toRight) {
    if (animal === "sheep") {
      next.ls -= 1;
      next.rs += 1;
    } else {
      next.lt -= 1;
      next.rt += 1;
    }
    next.boat = 1;
  } else if (animal === "sheep") {
    next.rs -= 1;
    next.ls += 1;
  } else {
    next.rt -= 1;
    next.lt += 1;
  }
  next.boat = toRight ? 1 : 0;
  return next;
}

function expandToSingleTrips(solution) {
  const frames = [{ ls: SHEEP, lt: TIGERS, rs: 0, rt: 0, boat: 0, cargo: null }];

  for (const step of solution) {
    let cur = frames[frames.length - 1];
    const toRight = cur.boat === 0;
    const parts = [...Array(step.ds).fill("sheep"), ...Array(step.dt).fill("tiger")];

    if (parts.length === 0) {
      frames.push({ ...step.state, cargo: null });
      continue;
    }

    for (let i = 0; i < parts.length; i++) {
      cur = applyMove(cur, parts[i], toRight);
      frames.push({ ...cur, cargo: parts[i] });

      if (i < parts.length - 1) {
        cur = { ...cur, boat: toRight ? 0 : 1, cargo: null };
        frames.push({ ...cur, cargo: null });
      }
    }
  }

  return frames;
}

function bankSlots(count, bankX, startY = 118) {
  const gap = 52;
  return Array.from({ length: count }, (_, i) => ({
    x: bankX,
    y: startY + i * gap,
  }));
}

function layoutFrame(frame) {
  const leftSheepX = 88;
  const leftTigerX = 168;
  const rightSheepX = 672;
  const rightTigerX = 752;
  const boatX = frame.boat === 0 ? 360 : 520;
  const boatY = 198;

  const entities = [
    ...bankSlots(frame.ls, leftSheepX).map((p) => ({ type: "sheep", ...p })),
    ...bankSlots(frame.lt, leftTigerX).map((p) => ({ type: "tiger", ...p })),
    ...bankSlots(frame.rs, rightSheepX).map((p) => ({ type: "sheep", ...p })),
    ...bankSlots(frame.rt, rightTigerX).map((p) => ({ type: "tiger", ...p })),
  ];

  if (frame.cargo) {
    entities.push({ type: frame.cargo, x: boatX + 34, y: boatY - 28, onBoat: true });
  }

  return {
    entities,
    farmer: { x: boatX + 10, y: boatY - 34 },
    boat: { x: boatX, y: boatY },
  };
}

function renderAnimalToken(type, x, y, t, onBoat = false) {
  const isSheep = type === "sheep";
  const fill = isSheep ? t.sheepBg : t.tigerBg;
  const ring = isSheep ? t.sheepRing : t.tigerRing;
  const emoji = isSheep ? "🐑" : "🐯";
  const r = onBoat ? 22 : 20;
  const cy = y + 20;

  return `
    <g>
      <circle cx="${x + 20}" cy="${cy + 2}" r="${r}" fill="${t.panelShadow}" opacity="0.35"/>
      <circle cx="${x + 20}" cy="${cy}" r="${r}" fill="${fill}" stroke="${ring}" stroke-width="2.5"/>
      <text x="${x + 20}" y="${cy + 7}" text-anchor="middle" font-size="${onBoat ? 20 : 18}">${emoji}</text>
    </g>`;
}

function renderBoat(x, y, t) {
  return `
    <g>
      <ellipse cx="${x + 46}" cy="${y + 26}" rx="52" ry="10" fill="${t.panelShadow}" opacity="0.25"/>
      <path d="M ${x + 4} ${y + 18} Q ${x + 46} ${y + 34} ${x + 88} ${y + 18} L ${x + 80} ${y + 8} Q ${x + 46} ${y + 2} ${x + 12} ${y + 8} Z"
            fill="${t.wood}" stroke="${t.woodLight}" stroke-width="1.5"/>
      <rect x="${x + 18}" y="${y + 2}" width="56" height="5" rx="2" fill="${t.woodLight}"/>
    </g>`;
}

function renderFarmer(x, y, t) {
  return `
    <g>
      <circle cx="${x + 14}" cy="${y + 8}" r="9" fill="${t.farmerSkin}" stroke="${t.panelStroke}" stroke-width="1"/>
      <rect x="${x + 4}" y="${y + 16}" width="20" height="16" rx="4" fill="${t.farmerCoat}"/>
      <text x="${x + 14}" y="${y + 40}" text-anchor="middle" font-size="9" fill="${t.muted}" font-family="Segoe UI, sans-serif">Farmer</text>
    </g>`;
}

function renderStaticScene(t) {
  return `
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${t.skyTop}"/>
        <stop offset="100%" stop-color="${t.skyBottom}"/>
      </linearGradient>
      <linearGradient id="riverGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${t.river}"/>
        <stop offset="100%" stop-color="${t.riverDeep}"/>
      </linearGradient>
      <filter id="panelShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="${t.panelShadow}" flood-opacity="0.45"/>
      </filter>
    </defs>

    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#sky)"/>
    <circle cx="780" cy="52" r="28" fill="${t.sun}" opacity="0.9"/>
    <ellipse cx="140" cy="58" rx="42" ry="16" fill="${t.cloud}" opacity="0.85"/>
    <ellipse cx="170" cy="50" rx="28" ry="14" fill="${t.cloud}" opacity="0.75"/>
    <ellipse cx="620" cy="44" rx="36" ry="14" fill="${t.cloud}" opacity="0.55"/>

    <rect x="0" y="88" width="${WIDTH}" height="${HEIGHT - 88}" fill="${t.grassDark}" opacity="0.15"/>

    <!-- Left bank -->
    <g filter="url(#panelShadow)">
      <rect x="24" y="96" width="248" height="196" rx="18" fill="${t.panel}" stroke="${t.panelStroke}" stroke-width="1.5"/>
    </g>
    <text x="148" y="122" text-anchor="middle" fill="${t.bankLabel}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="15" font-weight="700">Start Bank</text>
    <text x="108" y="144" text-anchor="middle" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">Sheep</text>
    <text x="188" y="144" text-anchor="middle" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">Tigers</text>
    <rect x="52" y="152" width="112" height="120" rx="12" fill="${t.grass}" opacity="0.22"/>
    <rect x="132" y="152" width="112" height="120" rx="12" fill="${t.grass}" opacity="0.14"/>

    <!-- River -->
    <rect x="288" y="108" width="344" height="172" rx="16" fill="url(#riverGrad)"/>
    <path d="M 300 170 Q 360 160 420 170 T 540 170 T 660 170 T 720 170" fill="none" stroke="${t.riverHighlight}" stroke-width="3" opacity="0.8">
      <animate attributeName="d"
        values="M 300 170 Q 360 160 420 170 T 540 170 T 660 170 T 720 170;
                M 300 178 Q 360 188 420 178 T 540 178 T 660 178 T 720 178;
                M 300 170 Q 360 160 420 170 T 540 170 T 660 170 T 720 170"
        dur="4s" repeatCount="indefinite"/>
    </path>
    <path d="M 300 210 Q 380 200 460 210 T 620 210" fill="none" stroke="${t.riverHighlight}" stroke-width="2" opacity="0.5">
      <animate attributeName="d"
        values="M 300 210 Q 380 200 460 210 T 620 210;
                M 300 218 Q 380 228 460 218 T 620 218;
                M 300 210 Q 380 200 460 210 T 620 210"
        dur="5s" repeatCount="indefinite"/>
    </path>
    <text x="460" y="136" text-anchor="middle" fill="#ffffff" font-family="Segoe UI, sans-serif" font-size="13" font-weight="600" opacity="0.9">River</text>

    <!-- Right bank -->
    <g filter="url(#panelShadow)">
      <rect x="648" y="96" width="248" height="196" rx="18" fill="${t.panel}" stroke="${t.panelStroke}" stroke-width="1.5"/>
    </g>
    <text x="772" y="122" text-anchor="middle" fill="${t.bankLabel}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="15" font-weight="700">Goal Bank</text>
    <text x="732" y="144" text-anchor="middle" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">Sheep</text>
    <text x="812" y="144" text-anchor="middle" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">Tigers</text>
    <rect x="676" y="152" width="112" height="120" rx="12" fill="${t.grass}" opacity="0.22"/>
    <rect x="756" y="152" width="112" height="120" rx="12" fill="${t.grass}" opacity="0.14"/>

    <!-- Header -->
    <text x="32" y="42" fill="${t.bankLabel}" font-family="Segoe UI, Ubuntu, sans-serif" font-size="22" font-weight="700">River Crossing</text>
    <text x="32" y="64" fill="${t.muted}" font-family="Segoe UI, sans-serif" font-size="12">Level 1 — Ferry 3 sheep &amp; 3 tigers. Boat fits the farmer + one animal.</text>
    <text x="32" y="80" fill="${t.danger}" font-family="Segoe UI, sans-serif" font-size="11" font-weight="600">Rule: Never leave more tigers than sheep on either bank.</text>
  `;
}

function renderHud(frame, trip, total, t) {
  const progress = trip / total;
  const barW = WIDTH - 64;
  const safeLeft = isSafe(frame.ls, frame.lt);
  const safeRight = isSafe(frame.rs, frame.rt);
  const won = frame.ls === 0 && frame.lt === 0 && frame.rs === SHEEP && frame.rt === TIGERS;

  return `
    <rect x="24" y="${HEIGHT - 52}" width="${barW}" height="10" rx="5" fill="${t.progressBg}"/>
    <rect x="24" y="${HEIGHT - 52}" width="${(barW * progress).toFixed(1)}" height="10" rx="5" fill="${won ? t.progressFill : t.accent}"/>
    <text x="32" y="${HEIGHT - 58}" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">Ferry trip ${trip} of ${total}</text>
    <text x="${WIDTH - 32}" y="${HEIGHT - 58}" text-anchor="end" fill="${t.muted}" font-size="11" font-family="Segoe UI, sans-serif">
      Left ${frame.ls}🐑 ${frame.lt}🐯  ·  Right ${frame.rs}🐑 ${frame.rt}🐯
    </text>
    <text x="${WIDTH / 2}" y="${HEIGHT - 18}" text-anchor="middle" fill="${won ? t.progressFill : safeLeft && safeRight ? t.bankLabel : t.danger}"
      font-family="Segoe UI, sans-serif" font-size="12" font-weight="600">
      ${won ? "✓ All animals crossed safely!" : safeLeft && safeRight ? "Board is safe — keep ferrying…" : "⚠ Unsafe bank — tigers would eat sheep!"}
    </text>
  `;
}

function buildSvg(frames, themeName) {
  const t = THEMES[themeName];
  const n = frames.length;

  const scenes = frames.map((frame, i) => {
    const begin = i * TRIP_MS;
    const end = (i + 1) * TRIP_MS;
    const { entities, farmer, boat } = layoutFrame(frame);

    const dynamic = [
      renderBoat(boat.x, boat.y, t),
      renderFarmer(farmer.x, farmer.y, t),
      ...entities.map((e) => renderAnimalToken(e.type, e.x, e.y, t, e.onBoat)),
      renderHud(frame, i + 1, n, t),
    ].join("");

    return `<g opacity="0">${dynamic}
      <set attributeName="opacity" to="1" begin="${begin}ms" end="${end}ms"/>
      <set attributeName="opacity" to="0" begin="${end}ms"/>
    </g>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" role="img" aria-label="River crossing puzzle animation">
  ${renderStaticScene(t)}
  ${scenes.join("\n")}
</svg>`;
}

export function renderRiverCrossing() {
  const solution = solveRiverCrossing(SHEEP, TIGERS);
  if (!solution) {
    throw new Error("No river crossing solution found");
  }

  const frames = expandToSingleTrips(solution);
  fs.mkdirSync(DIST, { recursive: true });

  fs.writeFileSync(path.join(DIST, "river-crossing.svg"), buildSvg(frames, "light"));
  fs.writeFileSync(path.join(DIST, "river-crossing-dark.svg"), buildSvg(frames, "dark"));

  console.log(`✓ river-crossing.svg (${frames.length} ferry trips, gameplay UI)`);
  console.log("✓ river-crossing-dark.svg");
}
