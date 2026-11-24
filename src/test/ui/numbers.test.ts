import { describe, expect, it } from "vitest";
import { menInShort } from "../../main/presentation/casualties";
import { amountText, resourceAmount, signedAmountText, signedResourceAmount } from "../../main/presentation/economy";
import { ledgersFor } from "../../main/presentation/ledger";
import { signedTenths, tenths } from "../../main/presentation/numbers";
import { signed } from "../../main/presentation/odds";
import { disbandSaving, menShort } from "../../main/presentation/recruitment";
import { initialGameState } from "../../main/engine/resolution";
import type { ResourceId } from "../../main/engine/types";
import { faction, spainWithAir } from "../support";

/** N5: no number the player sees goes past the tenths. */

const minus = "−";
const funds = "funds" as ResourceId;
const manpower = "manpower" as ResourceId;

describe("tenths (N5)", () => {
  it.each([
    [0, "0"], [7, "7"], [1.5, "1.5"], [14.25, "14.3"], [0.15, "0.2"], [1.15, "1.2"], [0.049, "<0.1"], [0.05, "0.1"], [2.96, "3"],
    [-2.25, `${minus}2.3`], [-3, `${minus}3`], [-0.01, `${minus}<0.1`]
  ])("prints %d as %s", (value, text) => {
    expect(tenths(value)).toBe(text);
  });

  it("signs a change", () => {
    expect([1.25, 0, -0.75, 0.02].map(signedTenths)).toEqual(["+1.3", "+0", `${minus}0.8`, "+<0.1"]);
    expect([2, 0, -1, 0.4].map(signed)).toEqual(["+2", "0", `${minus}1`, "+0.4"]);
  });

  it("is what amounts, upkeep, men and casualties print through", () => {
    const scenario = spainWithAir();
    expect(resourceAmount(scenario, manpower, 14.25)).toBe("14.3k");
    expect(signedResourceAmount(scenario, manpower, -0.75)).toBe(`${minus}0.8k`);
    expect(amountText(scenario, { [funds]: 0.02, [manpower]: 1.26 })).toContain("<0.1 Funds");
    expect(signedAmountText(scenario, { [funds]: 1.25 })).toBe("+1.3 Funds");
    expect(disbandSaving(scenario, [{ upkeep: { [manpower]: 0.25 } }])).toBe("Saves 0.3k Manpower a turn");
    expect([menShort(700), menShort(2450)]).toEqual(["700 men", "2.5k men"]);
    expect([950, 12_449, 999_949, 999_950, 1_249_500].map(menInShort)).toEqual(["950", "12.4k", "999.9k", "1M", "1.2M"]);
  });

  it("rounds a ledger's true total, not the sum of its rounded rows", () => {
    const scenario = spainWithAir();
    const ledger = ledgersFor(scenario, initialGameState(scenario), faction("republic"), {}).find(({ resourceId }) => resourceId === manpower)!;
    expect(ledger.total).toBeCloseTo(ledger.rows.reduce((sum, row) => sum + row.value, 0), 3);
  });
});
