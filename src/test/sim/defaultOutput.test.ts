import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../../sim/main";
import { clearTempOut, cliIo, tempOut } from "./cliFixture";

// The golden files were written before the harness could record anything, from the fixture
// scenario. A change to the fixture's rules or to the computer player may move them: re-derive
// them then. A change to the harness must not.
const golden = (file: string): string => readFileSync(join("src/test/sim/golden", file), "utf8");

afterEach(clearTempOut);

describe("a run without --record", () => {
  it("writes the same bytes as before the harness could record, and no other file", async () => {
    const out = tempOut();
    const run = cliIo();
    expect(await runCli(["--scenario", "tiny-front", "--games", "2", "--turns", "3", "--run", "r", "--out", out], run.io)).toBe(0);
    const dir = join(out, "r");
    expect(readdirSync(dir).sort()).toEqual(["games.jsonl", "summary.json"]);
    expect(readFileSync(join(dir, "games.jsonl"), "utf8")).toBe(golden("games.jsonl"));
    expect(readFileSync(join(dir, "summary.json"), "utf8")).toBe(golden("summary.json"));
    expect(run.out.join("").replace(dir, "OUT")).toBe(golden("stdout.txt"));
    expect(run.err.join("")).toBe("sim: 2 games on 2 worker threads\nsim: 1/2\nsim: 2/2\n");
  });
});
