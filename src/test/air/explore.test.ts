import { writeFileSync } from "node:fs";
import { it } from "vitest";
import { playComputerGame } from "../../sim/engine";
import { spain } from "../support";

it("explore", () => {
  const counts: Record<string, number> = {};
  const scenario = spain();
  for (let seed = 1; seed <= 10; seed += 1) {
    playComputerGame(scenario, seed, 40, ({ result }) => {
      for (const outcome of result.outcomes) {
        const key = outcome.kind === "raid" ? `raid:${outcome.result}` : outcome.kind === "rejected-order" ? `rejected:${outcome.reason}` : outcome.kind;
        counts[key] = (counts[key] ?? 0) + 1;
      }
      for (const modifier of result.outcomes.flatMap((o) => (o.kind === "battle" ? o.modifiers : []))) counts[`mod:${modifier.kind}`] = (counts[`mod:${modifier.kind}`] ?? 0) + 1;
    });
  }
  writeFileSync(process.env["EXPLORE_OUT"] ?? "/dev/null", JSON.stringify(counts));
}, 300000);
