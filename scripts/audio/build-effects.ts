// Builds the sound effects (assets/audio/effects): mono MP3 at 64 kbps, levelled by loudness.
//   node scripts/audio/build-effects.ts <candidates-dir>
// <candidates-dir> holds the chosen takes and stems. See scripts/audio/README.md.
import { mkdirSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { measure, run } from "./ffmpeg.ts";

const candidates = process.argv[2];
if (candidates === undefined) throw new Error("usage: node scripts/audio/build-effects.ts <candidates-dir>");
const root = resolve(import.meta.dirname, "../..");
const out = join(root, "assets/audio/effects");
const work = mkdtempSync(join(tmpdir(), "spanish-diplomacy-effects-"));

/** audio.md 4.3: by loudness, except sounds too short to have one, which go by peak. */
const target = { lufs: -20, shortPeak: -6, peakCeiling: -1 };
/** Shorter than this and integrated loudness (400 ms blocks) means little. */
const shortSeconds = 1;

/** file in <candidates-dir>, and its length. */
const takes: readonly (readonly [name: string, seconds: number])[] = [
  ["order-a", 0.55],
  ["recruit-a", 0.95],
  ["build-a", 1.15],
  ["air-a", 2.4],
  ["rail-a", 2.7],
  ["truck-a", 2.2],
  ["march-a", 2],
  ["battle-a", 1.6],
  ["blocked-a", 0.15]
];

function encode(source: string, filter: string, name: string): void {
  const file = join(out, `${name}.mp3`);
  run("ffmpeg", ["-hide_banner", "-y", "-i", source, "-af", filter, "-ac", "1", "-ar", "44100", "-map_metadata", "-1", "-fflags", "+bitexact", "-c:a", "libmp3lame", "-b:a", "64k", "-id3v2_version", "0", "-write_xing", "1", file]);
  const heard = measure(file);
  console.log(`${name}: ${heard.input_i.toFixed(1)} LUFS, ${heard.input_tp.toFixed(1)} dBTP, ${String(statSync(file).size)} B`);
}

/** Levels a mono file and encodes it with 6 ms in and 60 ms out, so no edge clicks. */
function level(source: string, seconds: number, name: string): void {
  const measured = measure(source);
  const wanted = seconds < shortSeconds ? target.shortPeak - measured.input_tp : target.lufs - measured.input_i;
  const gain = Math.min(wanted, target.peakCeiling - 1 - measured.input_tp);
  const fadeOut = Math.min(0.06, seconds / 4);
  encode(source, `volume=${gain.toFixed(2)}dB,afade=t=in:d=0.006,afade=t=out:st=${(seconds - fadeOut).toFixed(3)}:d=${fadeOut.toFixed(3)}`, name);
}

/**
 * The owner's end-turn mix (D8): linear gains, the kettledrum times 1.3, through the mixer page's
 * limiter (-6 dB, ratio 20), then a linear fade over the last 0.6 s to silence at 2.0 s.
 */
function endTurn(): void {
  const wav = join(work, "end-turn.wav");
  const inputs = ["stem-bell", "stem-kettledrum-hit", "recruit-a"].flatMap((name) => ["-i", join(candidates ?? "", `${name}.mp3`)]);
  const mix = [
    "[0:a]volume=0.80[bell]",
    "[1:a]volume=1.04[drum]",
    "[2:a]volume=0.20,adelay=100:all=1[snare]",
    "[bell][drum][snare]amix=inputs=3:duration=longest:normalize=0,acompressor=threshold=-6dB:ratio=20:attack=3:release=250:knee=1:makeup=1,apad=whole_dur=2,atrim=0:2,afade=t=out:st=1.4:d=0.6:curve=tri[mix]"
  ].join(";");
  run("ffmpeg", ["-hide_banner", "-y", ...inputs, "-filter_complex", mix, "-map", "[mix]", "-ac", "1", "-ar", "44100", "-c:a", "pcm_f32le", wav]);
  // Levelled by loudness like the rest; the fade is part of the mix, so no second one is added.
  const measured = measure(wav);
  const gain = Math.min(target.lufs - measured.input_i, target.peakCeiling - 1 - measured.input_tp);
  encode(wav, `volume=${gain.toFixed(2)}dB`, "end-turn");
}

mkdirSync(out, { recursive: true });
try {
  for (const [name, seconds] of takes) level(join(candidates, `${name}.mp3`), seconds, name);
  endTurn();
} finally {
  rmSync(work, { force: true, recursive: true });
}
