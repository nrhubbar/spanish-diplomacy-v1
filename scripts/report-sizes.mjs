// Reports what a player downloads from build/dist (run `npm run build` first). It sets no limit and
// never fails; the budgets are checked by `npm run budgets:check`.
//   npm run budgets:report
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { gzipSync } from "node:zlib";

const dist = "build/dist";
const kb = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;

function filesIn(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

function report() {
  const page = readFileSync(join(dist, "index.html"), "utf8");
  const initial = [...page.matchAll(/<(?:script|link)[^>]*(?:type="module"|rel="modulepreload")[^>]*(?:src|href)="([^"]+)"/g)]
    .map((match) => join(dist, match[1].replace(/^\//, "")));
  const size = (paths) => paths.reduce((sum, path) => sum + statSync(path).size, 0);
  const gzip = (paths) => paths.reduce((sum, path) => sum + gzipSync(readFileSync(path)).length, 0);
  const files = filesIn(dist).filter((path) => extname(path) !== ".map");
  const ending = (...endings) => files.filter((path) => endings.includes(extname(path)));
  const maps = ending(".webp").sort((a, b) => statSync(b).size - statSync(a).size);
  const rows = [
    ["Initial scripts (gzip)", kb(gzip(initial))],
    ["All scripts and styles (gzip)", kb(gzip(ending(".js", ".css")))],
    ["Map pictures", kb(size(maps))],
    ["  largest, loaded when wanted", maps.length === 0 ? kb(0) : kb(size(maps.slice(0, 1)))],
    ["Music, Opus (.ogg)", kb(size(ending(".ogg")))],
    ["Music, AAC (.m4a)", kb(size(ending(".m4a")))],
    ["Sound effects (.mp3)", kb(size(ending(".mp3")))],
    ["Total, without source maps", kb(size(files))]
  ];
  console.log("Download sizes (report only)");
  for (const [name, value] of rows) console.log(`  ${name.padEnd(34)}${value.padStart(12)}`);
}

if (existsSync(join(dist, "index.html"))) report();
else console.log("Download sizes: build/dist is missing; run `npm run build` first.");
