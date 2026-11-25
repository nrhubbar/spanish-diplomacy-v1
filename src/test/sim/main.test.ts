import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { defaultScenarioId, scenarioSources } from "../../sim/engine";
import type { GameLine } from "../../sim/game";
import { planOf, readVariants, runCli } from "../../sim/main";
import { parseArgs } from "../../sim/args";
import { formatSummary, runStamp } from "../../sim/output";
import type { FromWorker, ToWorker } from "../../sim/pool";
import type { GameTask, PlayedGame, Summary } from "../../sim/run";
import { serveWorker } from "../../sim/worker";
import { spainId } from "../support";
import { clearTempOut, cliIo as io, cliSources as sources, finished, tempOut } from "./cliFixture";

afterEach(clearTempOut);

describe("sim command line", () => {
  it("runs games across workers and writes summary.json and games.jsonl", async () => {
    const out = tempOut();
    const files = { "cap.json": JSON.stringify({ name: "cap", patch: [{ op: "replace", path: "/combat/diggingIn/max", value: 1 }] }) };
    const run = io(files);
    const code = await runCli(["--scenario", "tiny-front", "--games", "8", "--turns", "20", "--variant", "cap.json", "--out", out], run.io);
    expect(code).toBe(0);
    const dir = join(out, "20261119-140509");
    const summary = JSON.parse(readFileSync(join(dir, "summary.json"), "utf8")) as Summary;
    const lines = readFileSync(join(dir, "games.jsonl"), "utf8").trim().split("\n").map((line) => JSON.parse(line) as GameLine);
    expect(summary.games).toBe(16);
    expect(summary.cells.map((cell) => cell.id)).toEqual(["baseline", "cap"]);
    expect(lines).toHaveLength(16);
    expect(lines.slice(0, 4).map((line) => line.seed)).toEqual([1, 2, 3, 4]);
    expect(run.err.join("")).toContain("16 games on 2 worker threads");
    expect(run.err.join("")).toContain("sim: 16/16");
    expect(run.out.join("")).toContain("cap vs baseline (8 seeds)");
  });

  it("writes the same files whatever the worker count and the order games finish in", async () => {
    const out = tempOut();
    const read = (name: string, file: string) => readFileSync(join(out, name, file), "utf8");
    await runCli(["--scenario", "tiny-front", "--seeds", "1-5", "--workers", "1", "--run", "one", "--out", out], io().io);
    finished.length = 0;
    await runCli(["--scenario", "tiny-front", "--seeds", "1-5", "--workers", "4", "--run", "four", "--out", out], io().io);
    // With four workers, later seeds finish first.
    expect(finished).toEqual([4, 3, 2, 1, 5]);
    expect(read("four", "summary.json")).toBe(read("one", "summary.json"));
    expect(read("four", "games.jsonl")).toBe(read("one", "games.jsonl"));
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
      [["--scenario", "tiny-front", "--variant", "a.json"], { "a.json": "[{\"op\":\"replace\",\"path\":\"/nope\",\"value\":1}]" }, /nope/],
      [["--scenario", "tiny-front", "--lineup", "red"], {}, /is not a seat/],
      [["--scenario", "tiny-front", "--lineup", "red=ghost"], {}, /unknown persona "ghost"/],
      [["--scenario", "spanish-civil-war-1936", "--lineup", "green=builder"], {}, /unknown faction "green"/],
      [["--scenario", "spanish-civil-war-1936", "--lineup", "north=rush", "--lineup", "north=rush"], {}, /"north-rush" is used twice/]
    ];
    for (const [argv, files, message] of cases) {
      const run = io(files);
      expect(await runCli(argv, run.io)).toBe(2);
      expect(run.err.join("")).toMatch(message);
    }
  });

  it("plays the shipped personas by lineup, and by a variant's own seats", async () => {
    const out = tempOut();
    const files = { "v.json": JSON.stringify({ name: "v", patch: [{ op: "add", path: "/ai/seats/south", value: "denier" }] }) };
    const argv = ["--scenario", "spanish-civil-war-1936", "--games", "1", "--turns", "1", "--lineup", "republic=no-build,north=rush", "--variant", "v.json", "--out", out, "--run", "r"];
    expect(await runCli(argv, io(files).io)).toBe(0);
    const summary = JSON.parse(readFileSync(join(out, "r", "summary.json"), "utf8")) as Summary;
    expect(summary.cells.map((cell) => [cell.id, cell.seats])).toEqual([
      ["baseline", undefined], ["v", { south: "denier" }], ["republic-no-build_north-rush", { north: "rush", republic: "no-build" }]
    ]);
  });

  it("reports a game that fails on a worker thread instead of losing it", () => {
    const posted: FromWorker<PlayedGame>[] = [];
    let send: (message: ToWorker<GameTask>) => void = () => undefined;
    const plan = { scenarioId: "tiny-front", seeds: [1], turnLimit: 2, variants: [] };
    serveWorker({ plan, worker: 1 }, sources, { on: (_event, listener) => { send = listener; }, postMessage: (message) => posted.push(message) }, () => 0);
    send({ kind: "task", task: { cell: 5, seed: 9 } });
    send({ kind: "task", task: { cell: 0, seed: 1 } });
    expect(posted[0]).toEqual({ kind: "failed", message: "seed 9: Unknown cell 5." });
    expect(posted[1]?.kind).toBe("result");
  });

  it("defaults to the only shipped scenario, and asks when there are several", () => {
    const [shipped] = scenarioSources();
    const onlySpain = [{ ...shipped!, scenarios: Object.fromEntries(Object.entries(shipped!.scenarios).filter(([path]) => path.includes(spainId))) }];
    const plan = planOf(parseArgs([]), [], onlySpain);
    expect(plan.scenarioId).toBe(spainId);
    expect(defaultScenarioId(onlySpain)).toBe(spainId);
    expect(() => defaultScenarioId(scenarioSources())).toThrow(/Name a scenario with --scenario/);
    expect(() => defaultScenarioId([])).toThrow(/playable ones are: none/);
    expect(planOf(parseArgs(["--scenario", "x"]), [], []).scenarioId).toBe("x");
  });

  it("refuses two variants with one name, or one named like the baseline", () => {
    const read = (path: string) => (path === "baseline.json" ? "[]" : "{\"name\":\"same\",\"patch\":[]}");
    expect(() => readVariants(["a.json", "b.json"], read)).toThrow(/"same" is used twice/);
    expect(() => readVariants(["baseline.json"], read)).toThrow(/"baseline"/);
  });

  it("formats an ASCII console summary and names run folders by time", async () => {
    const out = tempOut();
    const run = io();
    await runCli(["--scenario", "tiny-front", "--games", "2", "--turns", "1", "--out", out, "--run", "r"], run.io);
    const text = run.out.join("");
    expect(text).toMatch(/^sim: tiny-front, seeds 1-2, turn limit 1, 2 games/);
    expect(text).toContain("baseline: 2 games");
    expect(/^[\x20-\x7e\n]*$/.test(text)).toBe(true);
    const summary = JSON.parse(readFileSync(join(out, "r", "summary.json"), "utf8")) as Summary;
    expect(formatSummary(summary, "x")).not.toContain("blunder");
    expect(text).toContain("stalled: 5 or more quiet turns");
    expect(runStamp(new Date("2026-01-02T03:04:05.678Z"))).toBe("20260102-030405");
  });
});
