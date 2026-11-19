import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { fixtureSources } from "../fixtures/scenarios/fixtureSources";
import { defaultScenarioId, scenarioSources } from "../../sim/engine";
import type { GameLine } from "../../sim/game";
import { type CliIo, planOf, readVariants, runCli, type WorkerSetup } from "../../sim/main";
import { parseArgs } from "../../sim/args";
import { formatSummary, runStamp } from "../../sim/output";
import type { FromWorker, PoolWorker, ToWorker } from "../../sim/pool";
import type { GameTask, Summary } from "../../sim/run";
import { serveWorker } from "../../sim/worker";

const sources = [...scenarioSources(), fixtureSources];
const folders: string[] = [];
afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { force: true, recursive: true });
});

/** A worker thread stood in by the real worker code on this thread, over an in-memory port. */
function inProcessWorker(setup: WorkerSetup): PoolWorker<GameTask, GameLine> {
  let toWorker: (message: ToWorker<GameTask>) => void = () => undefined;
  let toPool: (message: FromWorker<GameLine>) => void = () => undefined;
  serveWorker(setup, sources, {
    on: (_event, listener) => { toWorker = listener; },
    postMessage: (message) => { setTimeout(() => { toPool(message); }, 0); }
  });
  return {
    onError: () => undefined,
    onMessage: (listener) => { toPool = listener; },
    post: (message) => { toWorker(message); },
    terminate: () => Promise.resolve(0)
  };
}

function io(files: Readonly<Record<string, string>> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const value: CliIo = {
    cores: 3,
    now: () => new Date("2026-11-19T14:05:09Z"),
    readText: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`ENOENT: ${path}`);
      return text;
    },
    sources,
    spawn: inProcessWorker,
    stderr: (text) => err.push(text),
    stdout: (text) => out.push(text)
  };
  return { err, io: value, out };
}

const tempOut = (): string => {
  const folder = mkdtempSync(join(tmpdir(), "sim-test-"));
  folders.push(folder);
  return folder;
};

describe("sim command line", () => {
  it("runs games across workers and writes summary.json and games.jsonl", async () => {
    const out = tempOut();
    const files = { "cap.json": JSON.stringify({ name: "cap", patch: [{ op: "replace", path: "/combat/diggingIn/max", value: 1 }] }) };
    const run = io(files);
    const code = await runCli(["--scenario", "tiny-front", "--games", "4", "--turns", "20", "--variant", "cap.json", "--blunders", "both", "--out", out], run.io);
    expect(code).toBe(0);
    const dir = join(out, "20261119-140509");
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as Summary;
    const lines = readFileSync(join(dir, "games.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as GameLine);
    expect(summary.games).toBe(16);
    expect(summary.cells.map((cell) => cell.id)).toEqual([
      "baseline/with-blunders", "baseline/without-blunders", "cap/with-blunders", "cap/without-blunders"
    ]);
    expect(lines).toHaveLength(16);
    expect(lines.slice(0, 4).map((line) => line.seed)).toEqual([1, 2, 3, 4]);
    expect(run.err.join("")).toContain("16 games on 2 worker threads");
    expect(run.err.join("")).toContain("sim: 16/16");
    expect(run.out.join("")).toContain("cap/with-blunders vs baseline/with-blunders (4 seeds)");
  });

  it("gives the same summary whatever the worker count", async () => {
    const out = tempOut();
    const read = (name: string) => readFileSync(join(out, name, "summary.json"), "utf8");
    await runCli(["--scenario", "tiny-front", "--seeds", "1-5", "--blunders", "with", "--workers", "1", "--run", "one", "--out", out], io().io);
    await runCli(["--scenario", "tiny-front", "--seeds", "1-5", "--blunders", "with", "--workers", "4", "--run", "four", "--out", out], io().io);
    expect(read("four")).toBe(read("one"));
  });

  it("prints help and exits 2 on bad input, before playing anything", async () => {
    const help = io();
    expect(await runCli(["--help"], help.io)).toBe(0);
    expect(help.out.join("")).toContain("Usage: npm run sim");
    const cases: readonly [readonly string[], Readonly<Record<string, string>>, RegExp][] = [
      [["--games", "x"], {}, /positive whole number/],
      [["--scenario", "nowhere"], {}, /Unknown scenario/],
      [["--games", "1"], {}, /Name a scenario with --scenario; the playable ones are: .*tiny-front/],
      [["--scenario", "tiny-front", "--variant", "missing.json"], {}, /missing.json: ENOENT/],
      [["--scenario", "tiny-front", "--variant", "bad.json"], { "bad.json": "{" }, /bad.json/],
      [["--scenario", "tiny-front", "--variant", "a.json"], { "a.json": "[{\"op\":\"replace\",\"path\":\"/nope\",\"value\":1}]" }, /nope/]
    ];
    for (const [argv, files, message] of cases) {
      const run = io(files);
      expect(await runCli(argv, run.io)).toBe(2);
      expect(run.err.join("")).toMatch(message);
    }
  });

  it("reports a game that fails on a worker thread instead of losing it", () => {
    const posted: FromWorker<GameLine>[] = [];
    let send: (message: ToWorker<GameTask>) => void = () => undefined;
    const plan = { blunders: "with" as const, scenarioId: "tiny-front", seeds: [1], turnLimit: 2, variants: [] };
    serveWorker({ plan }, sources, { on: (_event, listener) => { send = listener; }, postMessage: (message) => posted.push(message) });
    send({ kind: "task", task: { cell: 5, seed: 9 } });
    send({ kind: "task", task: { cell: 0, seed: 1 } });
    expect(posted[0]).toEqual({ kind: "failed", message: "seed 9: Unknown cell 5." });
    expect(posted[1]?.kind).toBe("result");
  });

  it("defaults to the only shipped scenario, and plays without blunders while they are pending", () => {
    const shipped = scenarioSources();
    const plan = planOf(parseArgs([]), [], shipped);
    expect(plan.scenarioId).toBe(defaultScenarioId(shipped));
    expect(plan.blunders).toBe("without");
    expect(() => defaultScenarioId([])).toThrow(/playable ones are: none/);
    expect(planOf(parseArgs(["--scenario", "x", "--blunders", "with"]), [], []).scenarioId).toBe("x");
  });

  it("refuses two variants with one name, or one named like the baseline", () => {
    const read = (path: string) => (path === "baseline.json" ? "[]" : "{\"name\":\"same\",\"patch\":[]}");
    expect(() => readVariants(["a.json", "b.json"], read)).toThrow(/"same" is used twice/);
    expect(() => readVariants(["baseline.json"], read)).toThrow(/"baseline"/);
  });

  it("formats an ASCII console summary and names run folders by time", async () => {
    const out = tempOut();
    const run = io();
    await runCli(["--scenario", "tiny-front", "--games", "2", "--turns", "1", "--blunders", "without", "--out", out, "--run", "r"], run.io);
    const text = run.out.join("");
    expect(text).toMatch(/^sim: tiny-front, seeds 1-2, turn limit 1, 2 games/);
    expect(text).toContain("baseline/without-blunders: 2 games");
    expect(/^[\x20-\x7e\n]*$/.test(text)).toBe(true);
    const summary = JSON.parse(readFileSync(join(out, "r", "summary.json"), "utf8")) as Summary;
    expect(text).toContain("this run plays without them");
    expect(formatSummary({ ...summary, blunders: "both" }, "x")).toContain("with and without play alike");
    expect(formatSummary({ ...summary, blunderControl: "scenario" }, "x")).not.toContain("blunder rate");
    expect(text).toContain("stalled: 5 or more quiet turns");
    expect(runStamp(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102-030405");
  });
});
