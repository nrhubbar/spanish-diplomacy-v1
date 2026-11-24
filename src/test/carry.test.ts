import { describe, expect, it } from "vitest";
import { deposit, holdings, inPoints, inThousandths, withCarry } from "../main/engine/carry";
import { chargeReplenish } from "../main/engine/recruitment/rules";
import { addResources, subtractResources } from "../main/engine/resources";
import { signedResourceAmount } from "../main/presentation/economy";
import { developmentSchema } from "../main/scenarios/schema/modularSchema";
import type { FactionId, GameState, ResourceId, Resources } from "../main/engine/types";
import { spainWithAir } from "./support";

const republic = "republic" as FactionId;
const north = "north" as FactionId;
const funds = "funds" as ResourceId;
const manpower = "manpower" as ResourceId;
const of = (value: Resources): Resources => value;
type Ledger = Pick<GameState, "carry" | "treasuries">;

describe("one carry in thousandths per faction and resource", () => {
  it("banks whole points and keeps the fraction in hand, however the gains are split", () => {
    const start: Ledger = { treasuries: { [republic]: of({ [funds]: 2 }) } };
    const once = deposit(start, republic, { [funds]: 1500 });
    expect(once).toEqual({ carry: { [republic]: { [funds]: -500 } }, treasuries: { [republic]: { [funds]: 3 } } });
    const twice = deposit(once, republic, { [funds]: 1500 });
    expect(twice).toEqual({ carry: {}, treasuries: { [republic]: { [funds]: 5 } } });
    expect(holdings(twice, republic)).toEqual({ [funds]: 5000 });
  });

  it("takes upkeep and an owed Replenish from the same carry", () => {
    const owing: Ledger = { carry: { [republic]: { [manpower]: 400 }, [north]: { [manpower]: 7 } }, treasuries: { [republic]: { [manpower]: 1 }, [north]: {} } };
    expect(holdings(owing, republic)).toEqual({ [manpower]: 600 });
    expect(deposit(owing, republic, { [manpower]: -250 })).toEqual({
      carry: { [republic]: { [manpower]: -350 }, [north]: { [manpower]: 7 } },
      treasuries: { [republic]: { [manpower]: 0 }, [north]: {} }
    });
  });

  it("never takes a treasury below zero: a larger debt stays in the carry", () => {
    expect(deposit({ treasuries: {} }, republic, { [funds]: -900 })).toEqual({ carry: { [republic]: { [funds]: 900 } }, treasuries: { [republic]: { [funds]: 0 } } });
  });

  it("a Replenish never pays out while the carry is a credit", () => {
    for (const credit of [-999, -500, -1]) expect(chargeReplenish({ [manpower]: credit }, { [manpower]: 1 }).paid[manpower]).toBeGreaterThanOrEqual(0);
  });

  it("writes no carry field for nothing owed, and drops a faction's when it is settled", () => {
    expect(withCarry(undefined, republic, { [funds]: 0 })).toEqual({});
    expect(withCarry({ [republic]: { [funds]: 3 } }, republic, {})).toEqual({ carry: {} });
    expect(inPoints(inThousandths({ [funds]: 0.35 }))).toEqual({ [funds]: 0.35 });
  });

  it("sums of fractions never drift, and show without noise", () => {
    const tenths = Array.from({ length: 10 }).reduce<Resources>((sum) => addResources(sum, { [manpower]: 0.1 }), {});
    expect(tenths).toEqual({ [manpower]: 1 });
    expect(subtractResources({ [manpower]: 0.3 }, { [manpower]: 0.1 })).toEqual({ [manpower]: 0.2 });
    const scenario = spainWithAir();
    expect(signedResourceAmount(scenario, funds, 0.1 + 0.2)).toBe("+0.3");
    expect(signedResourceAmount(scenario, funds, -15.65)).toBe("−15.65");
  });

  it("a development track may yield thousandths, no finer", () => {
    const track = { id: "works", maxLevel: 3, name: "Works", resource: "funds", sources: [], upgrade: { cost: {}, turns: 1 } };
    for (const amount of [0.05, 0.15, 0.25, 1.5, 2]) expect(developmentSchema.safeParse({ ...track, yieldPerLevel: amount }).success).toBe(true);
    for (const amount of [0, 0.0005, -1]) expect(developmentSchema.safeParse({ ...track, yieldPerLevel: amount }).success).toBe(false);
  });
});
