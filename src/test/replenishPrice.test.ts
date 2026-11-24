import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { carryOf, carryScale, holdings } from "../main/engine/carry";
import { chargeReplenish, priceReplenishments, replenishQuote, uncharge } from "../main/engine/recruitment/rules";
import { viewFor } from "../main/engine/visibility";
import { replenishDetail, replenishPriceLabel } from "../main/presentation/recruitment";
import type { BuildingId, GameState, Resources, SubTerritoryId, TurnOutcome, UnitState } from "../main/engine/types";
import { faction, spainWithAir, unit, withoutUpkeep } from "./support";
import { pinned } from "./pinned";

/** B2, D28.3: Replenish prices with a per-faction carry; D28.1: the Hospital and the Depot. */

const scenario = withoutUpkeep(pinned(spainWithAir()));
const republic = faction("republic");
const north = faction("north");
const regimentId = unit("rep-sevilla-34");
const murcia = "murcia" as SubTerritoryId;
const amount = (funds: number, manpower: number): Resources => ({ funds, manpower } as Resources);
const of = (resources: Resources | undefined, id: string): number => (resources as Record<string, number> | undefined)?.[id] ?? 0;

/** Murcia's regiment (infantry: 6 Funds and 1 Manpower to recruit, 775 men) short of `missing` men, Murcia with `buildings`. */
function short(missing: number, buildings: readonly string[] = [], carry?: Resources): { readonly state: GameState; readonly unit: UnitState } {
  const base = initialGameState(scenario);
  const regiment: UnitState = { ...base.units[regimentId]!, strength: 775 - missing };
  const state: GameState = {
    ...base,
    subTerritories: { ...base.subTerritories, [murcia]: { ...base.subTerritories[murcia]!, buildings: buildings as BuildingId[] } },
    treasuries: { ...base.treasuries, [republic]: amount(20, 10) },
    units: { [regimentId]: regiment },
    ...(carry === undefined ? {} : { carry: { [republic]: carry } })
  };
  return { state, unit: regiment };
}

const ofKind = <Kind extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: Kind) =>
  outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

describe("Replenish prices carry their fractions (B2, D28.3)", () => {
  it("a small top-up owes its true share and pays no whole point until the carry adds up", () => {
    const { state, unit: regiment } = short(100);
    const quote = replenishQuote(scenario, state, regiment)!;
    // Half the recruit price for 100 of 775 men: 0.387 Funds and 0.065 Manpower.
    expect(quote.owed).toEqual(amount(387, 65));
    expect(quote.cost).toEqual(amount(0, 0));
    expect(quote.men).toBe(100);
    // The order menu and the report say so rather than "nothing".
    expect(replenishDetail(scenario, state, [regiment])).toContain("under a point, added to later orders");
    expect(replenishPriceLabel(scenario, amount(1, 0))).toBe("1 Funds");
  });

  it("over several orders pays the true price to within a point, never a whole point per order", () => {
    let carry: Resources = {};
    let paid = amount(0, 0);
    const owed = replenishQuote(scenario, short(100).state, short(100).unit)!.owed;
    for (let order = 0; order < 10; order += 1) {
      const charge = chargeReplenish(carry, owed);
      carry = charge.carry;
      paid = amount(of(paid, "funds") + of(charge.paid, "funds"), of(paid, "manpower") + of(charge.paid, "manpower"));
    }
    // 1,000 men: 3.87 Funds and 0.65 Manpower owed in all; rounding up each order would have charged 10 and 10.
    expect(paid).toEqual(amount(3, 0));
    expect(carry).toEqual(amount(870, 650));
    expect(of(paid, "funds") * carryScale + of(carry, "funds")).toBe(10 * of(owed, "funds"));
  });

  it("pays a whole point once the carry passes one, and conserves every thousandth through a turn", () => {
    const { state } = short(300, [], amount(900, 950));
    const result = resolveTurn(scenario, state, [{ factionId: republic, orders: [{ factionId: republic, kind: "replenish", unitId: regimentId }] }], 4);
    const applied = ofKind(result.outcomes, "replenish-applied")[0]!;
    const owed = replenishQuote(scenario, state, state.units[regimentId]!)!.owed;
    expect(applied.paid).toEqual(amount(2, 1));
    const income = ofKind(result.outcomes, "income").find((outcome) => outcome.factionId === republic)!.paid;
    const [before, after] = [holdings(state, republic), holdings(result.finalState, republic)];
    for (const id of ["funds", "manpower"] as const) {
      expect(of(after, id)).toBe(of(before, id) - of(owed, id) + of(income, id) * carryScale);
      // Income settles the carry: the treasury is the whole part of what the faction has, and the rest waits in hand.
      expect(of(result.finalState.treasuries[republic], id)).toBe(Math.floor(of(after, id) / carryScale));
      expect(of(carryOf(result.finalState, republic), id)).toBeLessThanOrEqual(0);
    }
  });

  it("prices several orders in turn, and an order the balance cannot cover leaves the carry alone", () => {
    const { state: both, unit: regiment } = short(300);
    // Priced twice over, as two units of the same type and strength would be.
    const twin = regiment;
    const one = replenishQuote(scenario, both, regiment)!;
    expect(one.cost).toEqual(amount(1, 0));
    // Each alone pays 1 Funds; in turn the second finds the first's carry: 1.161 + 1.161 = 2.322 Funds.
    const priced = priceReplenishments(scenario, both, republic, [regiment, twin]);
    expect(priced.total).toEqual(amount(2, 0));
    const poor = priceReplenishments(scenario, both, republic, [regiment, twin], amount(1, 0));
    expect(poor.entries.map((entry) => entry.affordable)).toEqual([true, false]);
    expect(poor.total).toEqual(amount(1, 0));
  });

  it("a cancelled order is taken back out of the carry, which may become a credit", () => {
    // A owes 0.4 and pays nothing; B owes 0.7 and pays 1; cancelling A leaves a credit of 0.3.
    const a = chargeReplenish({}, amount(400, 0));
    expect(a.paid).toEqual(amount(0, 0));
    const b = chargeReplenish(a.carry, amount(700, 0));
    expect(b.paid).toEqual(amount(1, 0));
    expect(uncharge(b.carry, amount(400, 0), a.paid)).toEqual(amount(-300, 0));
    // Cancelling B instead restores the carry A left.
    expect(uncharge(b.carry, amount(700, 0), b.paid)).toEqual(a.carry);
    // A credit pays nothing until the debt passes it.
    expect(chargeReplenish(amount(-300, 0), amount(200, 0))).toEqual({ carry: amount(-100, 0), paid: amount(0, 0) });
  });

  it("is the viewer's own: viewFor drops other factions' carries", () => {
    const { state } = short(100);
    const carried: GameState = { ...state, carry: { [republic]: amount(5, 5), [north]: amount(7, 7) } };
    expect(viewFor(scenario, carried, republic).carry).toEqual({ [republic]: amount(5, 5) });
    expect(viewFor(scenario, carried, undefined).carry).toEqual({});
  });
});

describe("the Hospital and the Depot do different things (D28.1)", () => {
  const missing = 700;
  const quoteWith = (buildings: readonly string[]) => replenishQuote(scenario, short(missing, buildings).state, short(missing, buildings).unit)!;

  it("without either: half the establishment a turn, at half the recruit price", () => {
    const plain = quoteWith([]);
    expect(plain.perTurn).toBe(387);
    expect(plain.men).toBe(387);
    expect(plain.owed).toEqual(amount(Math.round((6000 * 0.5 * 387) / 775), Math.round((1000 * 0.5 * 387) / 775)));
  });

  it("a Hospital raises the cap to three quarters; the price per man stays", () => {
    const hospital = quoteWith(["hospital"]);
    expect(hospital.perTurn).toBe(581);
    expect(hospital.men).toBe(581);
    expect(hospital.owed).toEqual(amount(Math.round((6000 * 0.5 * 581) / 775), Math.round((1000 * 0.5 * 581) / 775)));
  });

  it("a Depot takes a quarter off the Funds; the men a turn stay", () => {
    const depot = quoteWith(["depot"]);
    expect(depot.perTurn).toBe(387);
    expect(depot.owed).toEqual(amount(Math.round((6000 * 0.5 * 0.75 * 387) / 775), Math.round((1000 * 0.5 * 387) / 775)));
  });

  it("both together: three quarters a turn at the Depot's price", () => {
    const both = quoteWith(["hospital", "depot"]);
    expect(both.men).toBe(581);
    expect(both.owed).toEqual(amount(Math.round((6000 * 0.5 * 0.75 * 581) / 775), Math.round((1000 * 0.5 * 581) / 775)));
  });
});
