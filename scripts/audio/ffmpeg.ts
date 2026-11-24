// Shared ffmpeg calls for the audio build scripts.
import { spawnSync } from "node:child_process";

/** Runs a command and returns what it wrote to stderr (where ffmpeg reports); throws when it fails. */
export function run(command: string, args: readonly string[]): string {
  const result = spawnSync(command, [...args], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")}\n${result.stderr}`);
  return result.stderr;
}

export interface Loudness {
  readonly input_i: number;
  readonly input_lra: number;
  readonly input_thresh: number;
  readonly input_tp: number;
}

/** Integrated loudness (LUFS) and true peak (dBTP) of a file after an optional filter. */
export function measure(file: string, filter?: string): Loudness {
  const chain = [filter, "loudnorm=print_format=json"].filter((part) => part !== undefined).join(",");
  const report = run("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-af", chain, "-f", "null", "-"]);
  const json = JSON.parse(report.slice(report.lastIndexOf("{"), report.lastIndexOf("}") + 1)) as Record<string, string>;
  return {
    input_i: Number(json["input_i"]),
    input_lra: Number(json["input_lra"]),
    input_thresh: Number(json["input_thresh"]),
    input_tp: Number(json["input_tp"])
  };
}

/**
 * The second loudness pass: a linear gain to the target when the peak allows it, and loudnorm's
 * own limiting when it does not. Linear keeps the music's shape; the level was already ridden.
 */
export function loudnormFilter(measured: Loudness, target: { readonly lufs: number; readonly truePeak: number }): string {
  return [
    `loudnorm=I=${String(target.lufs)}`,
    `TP=${String(target.truePeak)}`,
    `LRA=${String(Math.max(7, Math.ceil(measured.input_lra)))}`,
    `measured_I=${String(measured.input_i)}`,
    `measured_TP=${String(measured.input_tp)}`,
    `measured_LRA=${String(measured.input_lra)}`,
    `measured_thresh=${String(measured.input_thresh)}`,
    "linear=true"
  ].join(":");
}
