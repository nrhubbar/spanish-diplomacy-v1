// Checks the owner-owned budgets in project/budgets.json (tasks H8).
//   npm run budgets:check                  the initial chunk of build/dist (run `npm run build` first)
//   npm run budgets:check -- --sim <dir>   also a harness run's summary.json (H7)
// Exits 1 when a measured budget is missed. A miss is reported to the owner, never fixed by
// raising the budget.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const budgets = JSON.parse(readFileSync("project/budgets.json", "utf8"));
const lines = [];
let missed = false;
const report = (name, ok, detail) => {
  lines.push(`${ok ? "met   " : "MISSED"} ${name}: ${detail}`);
  if (!ok) missed = true;
};

// The initial chunk: the entry module and everything the page preloads with it.
const dist = "build/dist";
const html = join(dist, "index.html");
if (!existsSync(html)) {
  console.error("budgets: build/dist/index.html is missing; run `npm run build` first.");
  process.exit(2);
}
const page = readFileSync(html, "utf8");
const scripts = [...page.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g), ...page.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="([^"]+)"/g)]
  .map((match) => match[1]);
const gzipKb = scripts.reduce((sum, src) => sum + gzipSync(readFileSync(join(dist, src.replace(/^\//, "")))).length, 0) / 1000;
const chunk = budgets.initialChunk.maxGzipKb;
report("initial chunk", gzipKb <= chunk, `${gzipKb.toFixed(2)} kB gzip against ${chunk} kB (${scripts.join(", ")})`);

// A harness run (H7), when one is named: the first object in its summary with games, freezes and wins.
const simIndex = process.argv.indexOf("--sim");
if (simIndex !== -1) {
  const summary = JSON.parse(readFileSync(join(process.argv[simIndex + 1], "summary.json"), "utf8"));
  const find = (value) => {
    if (value === null || typeof value !== "object") return undefined;
    if ("games" in value && "freezes" in value && "wins" in value) return value;
    for (const child of Object.values(value)) {
      const hit = find(child);
      if (hit !== undefined) return hit;
    }
    return undefined;
  };
  const metrics = find(summary);
  if (metrics === undefined) {
    console.error("budgets: no games, freezes and wins found in the summary.");
    process.exit(2);
  }
  const { games, maxFreezeRate, minWinShareOfDecided } = budgets.harness;
  const decided = metrics.decided ?? Object.values(metrics.wins).reduce((sum, entry) => sum + (entry.wins ?? entry), 0);
  report("harness games", metrics.games >= games, `${metrics.games} games against ${games}`);
  report("freeze rate", metrics.freezes / metrics.games <= maxFreezeRate, `${(metrics.freezes / metrics.games).toFixed(3)} against ${maxFreezeRate}`);
  for (const [faction, entry] of Object.entries(metrics.wins)) {
    const wins = typeof entry === "number" ? entry : entry.wins;
    const share = decided === 0 ? 0 : wins / decided;
    report(`win share, ${faction}`, share >= minWinShareOfDecided, `${share.toFixed(3)} of decided games against ${minWinShareOfDecided}`);
  }
}

console.log(lines.join("\n"));
process.exit(missed ? 1 : 0);
