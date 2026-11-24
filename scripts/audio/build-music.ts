// Builds the four music files (assets/audio/music) from the approved mix's recordings.
//   node scripts/audio/build-music.ts <music-dir>
// <music-dir> holds the four MP3 originals, make_supermix.py, its .venv, and supermix_v2_out/cues.json.
// See scripts/audio/README.md.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loudnormFilter, measure, run } from "./ffmpeg.ts";

interface RenderedTrack {
  readonly overlapNext: number;
  readonly seconds: number;
  readonly title: string;
  readonly track: string;
}

const musicDir = process.argv[2];
if (musicDir === undefined) throw new Error("usage: node scripts/audio/build-music.ts <music-dir>");
const root = resolve(import.meta.dirname, "../..");
const out = join(root, "assets/audio/music");
const work = mkdtempSync(join(tmpdir(), "spanish-diplomacy-music-"));
const target = { lufs: -18, truePeak: -1.5 };
const fileNames: Readonly<Record<string, string>> = {
  DragonsLullaby2023: "a-dragons-lullaby",
  MemoriesOfStone: "memories-of-stone",
  ShadowsAndDust: "shadows-and-dust",
  Unraveling: "unraveling"
};
const seconds = (value: number): number => Math.round(value * 1000) / 1000;

mkdirSync(out, { recursive: true });
try {
  run(join(musicDir, ".venv/bin/python"), ["-I", join(import.meta.dirname, "render-tracks.py"), musicDir, join(musicDir, "supermix_v2_out/cues.json"), work]);
  const rendered = JSON.parse(readFileSync(join(work, "rendered.json"), "utf8")) as RenderedTrack[];
  const manifest = rendered.map((track) => {
    const id = fileNames[track.track];
    if (id === undefined) throw new Error(`No file name for ${track.track}`);
    const wav = join(work, `${track.track}.wav`);
    const level = loudnormFilter(measure(wav), target);
    const encode = (extension: string, codec: readonly string[]): string => {
      const file = join(out, `${id}.${extension}`);
      run("ffmpeg", ["-hide_banner", "-y", "-i", wav, "-af", `${level},aresample=48000`, "-map_metadata", "-1", "-fflags", "+bitexact", ...codec, file]);
      return file;
    };
    const ogg = encode("ogg", ["-c:a", "libopus", "-b:a", "64k", "-vbr", "on", "-application", "audio"]);
    const m4a = encode("m4a", ["-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart"]);
    const heard = measure(ogg);
    console.log(`${id}: ${track.seconds.toFixed(1)} s, ${heard.input_i.toFixed(1)} LUFS, ${heard.input_tp.toFixed(1)} dBTP, ${String(statSync(ogg).size)} B ogg, ${String(statSync(m4a).size)} B m4a`);
    return { id, overlapSeconds: seconds(track.overlapNext), seconds: seconds(track.seconds), title: track.title };
  });
  writeFileSync(join(out, "tracks.json"), `${JSON.stringify(manifest, undefined, 2)}\n`);
} finally {
  rmSync(work, { force: true, recursive: true });
}
