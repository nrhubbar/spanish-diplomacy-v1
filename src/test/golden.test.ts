import { describe, expect, it } from "vitest";
import { refusalText } from "../main/presentation/refusals";
import golden from "./golden/golden.json";
import { recordGolden } from "./golden/goldenGames";

describe("golden games", () => {
  it("plays the same games, with the same report lines and refusals", () => {
    const now = recordGolden((scenario, result) => refusalText(scenario, result.refusal));
    expect(now.distinctRefusals).toEqual(golden.distinctRefusals);
    expect(now.games).toEqual(golden.games);
  }, 120_000);
});
