import fs from "fs";

const s = fs.readFileSync("../dist/bomberman-contribution-graph.svg", "utf8");
const m = s.match(/<frames>(\d+)<\/frames>/);
const d = s.match(/<durationMs>(\d+)<\/durationMs>/);
const fr = s.match(/<frameRate>(\d+)<\/frameRate>/);
console.log("frames", m?.[1], "durationMs", d?.[1], "frameRate", fr?.[1]);

const playerGroups = [...s.matchAll(/<g opacity="0">[\s\S]*?<\/g>/g)];
console.log("opacity-0 groups", playerGroups.length);

const keyTimesAll = [...s.matchAll(/keyTimes="([^"]+)"/g)];
const last = keyTimesAll[keyTimesAll.length - 1];
console.log("last keyTimes count", last[1].split(";").length);
console.log("last keyTimes tail", last[1].split(";").slice(-5).join(";"));

// find player sprite uses with animate opacity
const bmPlayer = [...s.matchAll(/id="bm-player[^"]*"[\s\S]*?keyTimes="([^"]+)"/g)];
console.log("bm-player anims", bmPlayer.length);
if (bmPlayer.length) {
  const kt = bmPlayer[bmPlayer.length - 1][1].split(";");
  console.log("last player anim keyTimes end", kt.slice(-3));
}

// compare pacman
const p = fs.readFileSync("../dist/pacman-contribution-graph.svg", "utf8");
const pm = p.match(/<frames>(\d+)<\/frames>/);
console.log("\npacman frames", pm?.[1]);
