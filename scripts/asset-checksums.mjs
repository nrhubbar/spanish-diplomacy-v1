// Writes (or with --check, verifies) SHA-256 checksums for every shipped map asset.
// The manifest makes any regenerated or replaced asset an explicit, reviewable change.
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";

const directory = new URL("../assets/maps/", import.meta.url);
const manifestUrl = new URL("checksums.json", directory);
const files = (await readdir(directory)).filter((name) => /\.(svg|png|jpg|webp)$/.test(name)).sort();
const actual = Object.fromEntries(await Promise.all(files.map(async (name) => [
  name,
  createHash("sha256").update(await readFile(new URL(name, directory))).digest("hex")
])));

if (process.argv.includes("--check")) {
  const expected = JSON.parse(await readFile(manifestUrl, "utf8"));
  const drift = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].filter((name) => expected[name] !== actual[name]);
  if (drift.length > 0) {
    console.error(`Asset checksums differ: ${drift.join(", ")}`);
    process.exit(1);
  }
  console.log(`All ${String(files.length)} map assets match assets/maps/checksums.json`);
} else {
  await writeFile(manifestUrl, `${JSON.stringify(actual, null, 2)}\n`);
  console.log(`Wrote checksums for ${String(files.length)} map assets`);
}
