import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIB = path.join(
  __dirname,
  "node_modules/pacman-contribution-graph/dist/pacman-contribution-graph.min.js"
);

/** Upstream stops when one bomber dies or at 400 frames — often mid-grid. */
const LOOP_VARIANTS = [
  "this.alivePlayerCount()>1&&this.store.frameCount<400",
  "this.alivePlayerCount()>0&&this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<2400",
  "this.alivePlayerCount()>0&&this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<12000",
  "this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<8000",
  "this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<25000",
  "this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<60000",
];
const NEW_LOOP =
  "this.store.grid.some((t=>t.some((e=>e.commitsCount>0))))&&this.store.frameCount<12000";

const OLD_KILL =
  "killPlayersInActiveExplosions(){for(const t of this.store.players)if(t.alive)for(const e of this.store.activeExplosions)if(e.contains(t)){t.kill(),e.markPlayerHit(t.id);break}}";
const NEW_KILL = "killPlayersInActiveExplosions(){}";

/** AI only bombs when route-to-opponent improves — skip that gate for grid clearing. */
const OLD_ROUTE_GATE = "if(l<=0)continue;";
const NEW_ROUTE_GATE = "";

/** Bomb whenever the blast would clear contribution cells (not only PvP shots). */
const OLD_SHOULD_BOMB =
  "if(this.player.previewBomb.wouldHitVisibleItem(this.store))return!1;if(this.player.bombWouldHitOpponent(this.store))return!0;";
const NEW_SHOULD_BOMB =
  "if(this.player.previewBomb.wouldHitVisibleItem(this.store))return!1;if(this.player.previewBomb.wouldHitContribution(this.store))return!0;if(this.player.bombWouldHitOpponent(this.store))return!0;";

/** Chase nearest contribution cell instead of the opponent. */
const OLD_CHASE =
  'class Re{choose({store:t,player:e,opponent:n}){var i;if(!n)return{handled:!0,step:null};const o=ge(t,e.id),a=xe(t,e,(t=>$(t,n)),{avoidFirstStep:o,attackSide:e.attackSide,routePreference:e.routePreference,target:n}),s=Te(t,e,null!==(i=null==a?void 0:a.firstStep)&&void 0!==i?i:null);return s?{handled:!0,step:s}:null}}';
const NEW_CHASE =
  'class Re{choose({store:t,player:e}){var n;const i=ge(t,e.id),o=xe(t,e,(e=>et(t,e)),{avoidFirstStep:i,attackSide:e.attackSide,routePreference:e.routePreference}),a=Te(t,e,null!==(n=null==o?void 0:o.firstStep)&&void 0!==n?n:null);return a?{handled:!0,step:a}:null}}';

/** Bomb spots no longer require a post-blast route to the opponent. */
const OLD_ROUTE_REQUIRED =
  "const s=new Set(a.map(q)),r=ve(this.store,o.position,t,s);if(!r)continue;const l=e?e.cost-r.cost:10;";
const NEW_ROUTE_REQUIRED =
  "const s=new Set(a.map(q)),r=ve(this.store,o.position,t,s)||{cost:9999,distance:0,blastedCells:a.length};const l=e?e.cost-r.cost:a.length*10;";

/** After AI play, clear any leftover contribution cells so the SVG finishes the full grid. */
const OLD_ENGINE_HEAD =
  "class Je{constructor(t){this.store=t}start(){";
const NEW_ENGINE_HEAD =
  'class Je{constructor(t){this.store=t}sweepRemainingContributions(){const t=at.from(this.store);for(let e=0;e<53;e++)for(let n=0;n<7;n++){if(this.store.grid[e][n].commitsCount<1)continue;const i={x:e,y:n},o=t.clearContributionCell(i);t.recordCellDestroyed(i,o),this.store.frameCount++,this.pushSnapshot()}}start(){';

const OLD_FINISH_SEQUENCE = "this.appendDeathAnimationSnapshots(),this.finish()";
const NEW_FINISH_SEQUENCE =
  "this.sweepRemainingContributions(),this.appendDeathAnimationSnapshots(),this.finish()";

function applyPatch(source, { variants, next, label, alreadyApplied }) {
  if (alreadyApplied?.(source)) {
    return { source, changed: false, applied: true };
  }

  if (next && source.includes(next)) {
    return { source, changed: false, applied: true };
  }

  for (const old of variants) {
    if (!old) continue;
    if (source.includes(old)) {
      return {
        source: source.replace(old, next),
        changed: true,
        applied: true,
        label,
      };
    }
  }

  return { source, changed: false, applied: false, label };
}

export function patchBombermanCompletion() {
  if (!fs.existsSync(LIB)) {
    console.warn("pacman-contribution-graph not installed — skipping Bomberman patch");
    return false;
  }

  let source = fs.readFileSync(LIB, "utf8");
  let anyChanged = false;

  const patches = [
    { variants: LOOP_VARIANTS, next: NEW_LOOP, label: "game loop" },
    { variants: [OLD_KILL], next: NEW_KILL, label: "PvP kills" },
    {
      variants: [OLD_ROUTE_GATE],
      next: NEW_ROUTE_GATE,
      label: "route-improvement gate",
      alreadyApplied: (s) => !s.includes("if(l<=0)continue"),
    },
    {
      variants: [OLD_SHOULD_BOMB],
      next: NEW_SHOULD_BOMB,
      label: "bomb-on-contribution",
      alreadyApplied: (s) =>
        s.includes(
          "if(this.player.previewBomb.wouldHitContribution(this.store))return!0;"
        ),
    },
    {
      variants: [OLD_CHASE],
      next: NEW_CHASE,
      label: "chase contributions",
      alreadyApplied: (s) => s.includes("xe(t,e,(e=>et(t,e))"),
    },
    {
      variants: [OLD_ROUTE_REQUIRED],
      next: NEW_ROUTE_REQUIRED,
      label: "post-blast route requirement",
      alreadyApplied: (s) =>
        s.includes(
          "ve(this.store,o.position,t,s)||{cost:9999,distance:0,blastedCells:a.length}"
        ),
    },
    {
      variants: [OLD_ENGINE_HEAD],
      next: NEW_ENGINE_HEAD,
      label: "completion sweep method",
      alreadyApplied: (s) => s.includes("sweepRemainingContributions(){"),
    },
    {
      variants: [OLD_FINISH_SEQUENCE],
      next: NEW_FINISH_SEQUENCE,
      label: "completion sweep call",
      alreadyApplied: (s) => s.includes("this.sweepRemainingContributions(),"),
    },
  ];

  for (const patch of patches) {
    const result = applyPatch(source, patch);
    source = result.source;
    if (result.changed) {
      anyChanged = true;
    }
    if (!result.applied) {
      throw new Error(
        `Bomberman completion patch failed: ${patch.label} not found (library version changed?)`
      );
    }
  }

  if (!anyChanged) {
    return true;
  }

  fs.writeFileSync(LIB, source);
  console.log("✓ Patched Bomberman to finish clearing the contribution grid");
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  patchBombermanCompletion();
}
