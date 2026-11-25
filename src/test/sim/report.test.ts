import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { GameLine } from "../../sim/game";
import { byMeasure, type Inventory, type InventoryColumns, type Measure, measureColumns } from "../../sim/inventory";
import { runCli } from "../../sim/main";
import { buildReport, csv, formatReport, meanRows, readRun, type RecordedRun, type Report, reportTables } from "../../sim/report";
import { buildSummary, type RunPlan } from "../../sim/run";
import { contentionNote, type TimingLine } from "../../sim/timings";
import { clearTempOut, cliIo, tempOut } from "./cliFixture";

afterEach(clearTempOut);

const columns: InventoryColumns = { counts: ["territories"], projects: ["building:fort", "link:road"], resources: ["gold"], sites: ["building:fort"], unitTypes: ["foot", "horse"] };

/** An inventory of two sides whose every number is 0 but those given, by side, measure and turn. */
function inventory(turns: number, given: Readonly<Record<string, Readonly<Partial<Record<Measure, readonly (readonly number[])[]>>>>>): Inventory {
  const side = (id: string) => byMeasure((measure) => given[id]?.[measure] ?? Array.from({ length: turns + 1 }, () => columns[measureColumns[measure]].map(() => 0)));
  return { columns, sides: { red: side("red"), blue: side("blue") } };
}

const line = (seed: number, turns: number, winners: readonly string[], given: Parameters<typeof inventory>[1]): GameLine => ({
  abandonments: 0, battles: {}, battlesByTurn: Array.from({ length: turns }, () => 2), end: winners.length === 0 ? "freeze" : "decided", firstTurnRoutes: {},
  inventory: inventory(turns, given), longestQuiet: seed === 2 ? 6 : 0, losses: {}, objectiveChecks: 1, seed, turns, variant: "baseline",
  ...(winners.length === 0 ? {} : { victory: "territories" }), winners
});

const lines = [
  line(1, 1, ["red"], { red: { units: [[3, 0], [5, 1]], recruitsOrdered: [[0, 0], [2, 0]], recruitsRefused: [[0, 0], [1, 0]], income: [[9], [4]], standing: [[1], [2]], buildsUnderWay: [[0, 0], [0, 1]], held: [[10], [8.125]] } }),
  line(2, 2, ["red", "blue"], { red: { units: [[3, 0], [4, 0], [6, 0]], recruitsOrdered: [[0, 0], [1, 0], [1, 1]], income: [[9], [5], [6]], standing: [[1], [1], [1]], held: [[10], [9], [7]] } })
];
const plan: RunPlan = { scenarioId: "s", seeds: [1, 2], turnLimit: 2, variants: [{ name: "unplayed", patch: [] }] };
const timings: readonly TimingLine[] = [
  { kind: "game", variant: "baseline", seed: 1, turns: 1, milliseconds: 100, worker: 1 },
  { kind: "game", variant: "baseline", seed: 2, turns: 2, milliseconds: 300, worker: 2 },
  { kind: "run", games: 2, workers: 2, cores: 4, totalMilliseconds: 310, gameMilliseconds: 400, note: contentionNote }
];
const run: RecordedRun = { lines, summary: buildSummary(plan, ["red", "blue"], lines), timings };
const report = buildReport(run);
const [cell] = report.cells;

describe("the report", () => {
  it("takes means over the games still running on each turn", () => {
    expect(report.cells).toHaveLength(1);
    expect(cell?.running).toEqual([2, 2, 1]);
    expect(cell?.sides["red"]?.perTurn.units).toEqual([[3, 0], [4.5, 0.5], [6, 0]]);
    expect(cell?.sides["red"]?.perTurn.income).toEqual([[9], [4.5], [6]]);
    expect(cell?.sides["blue"]?.perTurn.units).toEqual([[0, 0], [0, 0], [0, 0]]);
    expect(meanRows([], 2)).toEqual([0, 0]);
  });

  it("adds flows up from turn 1, and takes stocks at each game's end", () => {
    expect(cell?.sides["red"]?.totals["recruitsOrdered"]).toEqual([2, 0.5]);
    expect(cell?.sides["red"]?.totals["income"]).toEqual([7.5]);
    expect(cell?.sides["red"]?.final["units"]).toEqual([5.5, 0.5]);
    expect(cell?.sides["red"]?.final["income"]).toBeUndefined();
    expect(cell?.sides["red"]?.totals["units"]).toBeUndefined();
  });

  it("carries the summary's outcomes, the lengths of all games, and the clock", () => {
    expect(cell?.outcomes).toMatchObject({ decided: 2, earlyWins: 2, freezes: 0, games: 2, sharedVictories: 1, stalled: 1, victories: { territories: 2 } });
    expect(cell?.outcomes.wins["red"]?.wins).toBe(1.5);
    expect(cell?.outcomes.turns).toMatchObject({ max: 2, median: 1.5, min: 1 });
    expect(cell?.milliseconds.perGame).toMatchObject({ max: 300, median: 200 });
    expect(cell?.milliseconds.perTurn).toMatchObject({ max: 150, min: 100 });
    expect(report.run?.note).toContain("share the machine");
  });

  it("writes each table as CSV, blank where a table has no such column", () => {
    const tables = reportTables(run, report);
    expect(tables["units.csv"]?.split("\n").slice(0, 6)).toEqual([
      "variant,side,turn,games,type,onMap,training,paused,ordered,refused",
      "baseline,red,0,2,foot,3,0,0,0,0",
      "baseline,red,0,2,horse,0,0,0,0,0",
      "baseline,red,1,2,foot,4.5,0,0,1.5,0.5",
      "baseline,red,1,2,horse,0.5,0,0,0,0",
      "baseline,red,2,1,foot,6,0,0,1,0"
    ]);
    expect(tables["buildings.csv"]?.split("\n").slice(0, 5)).toEqual([
      "variant,side,turn,games,project,standing,underWay,waiting,ordered,refused",
      "baseline,red,0,2,building:fort,1,0,0,0,0",
      "baseline,red,0,2,link:road,,0,0,0,0",
      "baseline,red,1,2,building:fort,1.5,0,0,0,0",
      "baseline,red,1,2,link:road,,0.5,0,0,0"
    ]);
    expect(tables["economy.csv"]?.split("\n").slice(0, 3)).toEqual(["variant,side,turn,games,resource,held,income,upkeep,unpaid", "baseline,red,0,2,gold,10,9,0,0", "baseline,red,1,2,gold,8.5625,4.5,0,0"]);
    expect(tables["land.csv"]?.split("\n")[0]).toBe("variant,side,turn,games,count,mean");
    expect(tables["games.csv"]).toBe("variant,seed,end,turns,winners,victory,earlyWin,stalled,longestQuiet,battles\nbaseline,1,decided,1,red,territories,1,0,0,2\nbaseline,2,decided,2,red+blue,territories,1,1,6,4\n");
    expect(tables["timings.csv"]).toBe("variant,seed,turns,milliseconds,millisecondsPerTurn,worker\nbaseline,1,1,100,100,1\nbaseline,2,2,300,150,2\n");
    const finals = (tables["finals.csv"] ?? "").trim().split("\n").map((text) => text.split(","));
    const value = (row: number, name: string) => finals[row]?.[finals[0]?.indexOf(name) ?? -1];
    expect(finals).toHaveLength(5);
    expect([value(1, "side"), value(1, "won"), value(1, "units:foot"), value(1, "held:gold"), value(1, "total-recruitsOrdered:foot"), value(1, "total-recruitsRefused:foot"), value(1, "total-income:gold"), value(1, "buildsUnderWay:link:road")]).toEqual(["red", "1", "5", "8.125", "2", "1", "4", "1"]);
    expect([value(4, "side"), value(4, "won"), value(4, "units:foot")]).toEqual(["blue", "0.5", "0"]);
    expect(value(3, "won")).toBe("0.5");
  });

  it("quotes CSV fields that need it, and fills rows that lack a column with a blank", () => {
    expect(csv([{ a: "x,\"y\"" }, { b: 2 }])).toBe("a,b\n\"x,\"\"y\"\"\",\n,2\n");
  });

  it("says which personas a cell's factions play, where any is given one", () => {
    const seated = buildSummary(plan, ["red", "blue"], lines, new Map([["baseline", { red: "calm" }]]));
    expect(buildReport({ ...run, summary: seated }).cells[0]?.seats).toEqual({ red: "calm" });
    expect("seats" in buildReport(run).cells[0]!).toBe(false);
  });

  it("gives a freeze no victory and a game without a winner no credit", () => {
    const frozen = [line(1, 2, [], {})];
    const only = { lines: frozen, summary: buildSummary({ ...plan, seeds: [1] }, ["red", "blue"], frozen), timings: [] };
    const quiet = buildReport(only);
    expect(quiet.cells[0]?.outcomes.victories).toEqual({});
    expect(quiet.run).toBeNull();
    expect(quiet.cells[0]?.milliseconds).toEqual({ perGame: null, perTurn: null });
    expect(reportTables(only, quiet)["games.csv"]).toContain("baseline,1,freeze,2,,,0,0,0,4");
    expect(formatReport(quiet, "dir")).toBe("tables: report.json and *.csv in dir\n");
  });

  it("refuses games that have no inventory", () => {
    const [first] = lines;
    const bare = { ...first! };
    delete (bare as { inventory?: unknown }).inventory;
    expect(() => buildReport({ ...run, lines: [bare] })).toThrow(/Seed 1 of "baseline" has no inventory: run with --record inventory/);
  });
});

describe("--record inventory on the command line", () => {
  const files = ["buildings.csv", "economy.csv", "finals.csv", "games.csv", "games.jsonl", "land.csv", "report.json", "summary.json", "timings.csv", "timings.jsonl", "units.csv"];
  const record = async (out: string, name: string, workers: string) => {
    const world = cliIo({}, ["2026-11-19T14:05:09Z", "2026-11-19T14:05:10Z", "2026-11-19T14:05:12.500Z"]);
    const code = await runCli(["--scenario", "tiny-front", "--seeds", "1-4", "--turns", "6", "--workers", workers, "--record", "inventory", "--out", out, "--run", name], world.io);
    return { code, text: world.out.join("") };
  };

  it("writes every file, the same games whatever the workers, and how long they took", async () => {
    const out = tempOut();
    const one = await record(out, "one", "1");
    const four = await record(out, "four", "4");
    expect([one.code, four.code]).toEqual([0, 0]);
    const read = (name: string, file: string) => readFileSync(join(out, name, file), "utf8");
    expect(readdirSync(join(out, "one")).sort()).toEqual(files);
    for (const file of ["games.jsonl", "summary.json", "units.csv", "buildings.csv", "economy.csv", "land.csv", "finals.csv", "games.csv"]) expect(read("four", file)).toBe(read("one", file));
    const lines4 = read("four", "timings.jsonl").trim().split("\n").map((text) => JSON.parse(text) as TimingLine);
    expect(lines4.map((entry) => entry.kind)).toEqual(["game", "game", "game", "game", "run"]);
    expect(lines4.map((entry) => (entry.kind === "game" ? entry.worker : 0))).toEqual([1, 2, 3, 4, 0]);
    // With no --run, the clock is read for the folder's name first; with it, only around the games.
    expect(lines4.at(-1)).toMatchObject({ cores: 3, gameMilliseconds: 28, games: 4, totalMilliseconds: 1000, workers: 4 });
    expect(one.text).toContain("time: 1.0 s in all");
    expect(one.text).toContain("tables: report.json and *.csv in");
    expect(/^[\x20-\x7e\n]*$/.test(one.text)).toBe(true);
    expect((JSON.parse(read("one", "report.json")) as Report).cells[0]?.id).toBe("baseline");
  });

  it("writes a run's tables again from its files with --report, and plays nothing", async () => {
    const out = tempOut();
    await record(out, "r", "1");
    const dir = join(out, "r");
    const read = (file: string) => readFileSync(join(dir, file), "utf8");
    const stored = Object.fromEntries(["games.jsonl", "summary.json", "timings.jsonl"].map((file) => [join(dir, file), read(file)]));
    const first = read("units.csv");
    const before = read("report.json");
    writeFileSync(join(dir, "units.csv"), "");
    const again = cliIo(stored);
    expect(await runCli(["--report", dir], again.io)).toBe(0);
    expect(read("units.csv")).toBe(first);
    expect(read("report.json")).toBe(before);
    expect(again.out.join("")).toContain("tables: report.json");
    expect(again.err).toEqual([]);
    expect(readRun(dir, (path) => stored[path] ?? "").lines).toHaveLength(4);
    const missing = cliIo();
    expect(await runCli(["--report", "nowhere"], missing.io)).toBe(2);
    expect(missing.err.join("")).toMatch(/ENOENT/);
  });

  it("refuses to record anything else", async () => {
    const world = cliIo();
    expect(await runCli(["--record", "everything"], world.io)).toBe(2);
    expect(world.err.join("")).toBe("--record: \"everything\" is not something to record; use inventory.\n");
  });
});
