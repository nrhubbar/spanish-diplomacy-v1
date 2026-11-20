import { describe, expect, it } from "vitest";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, PlayerSubmission, Resources, Scenario, TurnOutcome, WeatherId, WeatherZoneId } from "../main/engine/types";
import { faction, spain, spainD20, territory, unit } from "./support";

/**
 * Whole turns through `resolveTurn` under both dice modules: a replenishing holder does not dig
 * in (R5, Q-RECR-5), and Snow stops the works growing (T4), the d6 preset's morale part and the
 * d20's alike.
 */

const republic = faction("republic");
const murcia = territory("murcia");
const regiment = unit("rep-sevilla-34");

const dice: readonly (readonly [string, () => Scenario])[] = [["d6-table", spain], ["d20-graded", spainD20]];

/** Murcia with its lone regiment at a third of its men, and nobody else on the board. */
function loneHolder(scenario: Scenario, weather?: WeatherId): GameState {
  const base = initialGameState(scenario);
  const held = base.units[regiment]!;
  return {
    ...base,
    treasuries: { ...base.treasuries, [republic]: { funds: 20, manpower: 10 } as Resources },
    units: { [regiment]: { ...held, strength: 250 } },
    ...(weather === undefined ? {} : { weather: { outcomes: { cantabrian: weather, mediterranean: weather, meseta: weather, south: weather } as Record<WeatherZoneId, WeatherId>, roll: 18 } })
  };
}

const submissions = (orders: PlayerSubmission["orders"]): readonly PlayerSubmission[] => [{ factionId: republic, orders }];
const ofKind = <Kind extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: Kind) =>
  outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

describe.each(dice)("a whole turn on %s", (_name, scenarioOf) => {
  const scenario = scenarioOf();

  it("a holder that rests entrenches; one that replenishes holds without entrenching (Q-RECR-5)", () => {
    const state = loneHolder(scenario);
    const rested = resolveTurn(scenario, state, submissions([]), 11);
    expect(rested.finalState.fortification[murcia]?.level ?? 0).toBeGreaterThan(0);

    const replenished = resolveTurn(scenario, state, submissions([{ factionId: republic, kind: "replenish", unitId: regiment }]), 11);
    expect(ofKind(replenished.outcomes, "replenish-applied")).toHaveLength(1);
    expect(replenished.finalState.units[regiment]!.strength).toBeGreaterThan(250);
    expect(replenished.finalState.fortification[murcia]).toBeUndefined();
  });

  it("Snow keeps the works where they were (T4)", () => {
    const snowy = loneHolder(scenario, "snow" as WeatherId);
    const dug: GameState = { ...snowy, fortification: { [murcia]: { factionId: republic, level: 1 } } };
    const result = resolveTurn(scenario, dug, submissions([]), 11);
    expect(result.finalState.fortification[murcia]).toEqual({ factionId: republic, level: 1 });
    // The same turn in Clear weather digs in.
    const clear = resolveTurn(scenario, { ...dug, weather: loneHolder(scenario, "clear" as WeatherId).weather! }, submissions([]), 11);
    expect(clear.finalState.fortification[murcia]!.level).toBeGreaterThan(1);
  });
});

describe("a capital that falls with purchases in it (M4, $5, U3)", () => {
  const scenario = spainD20();
  const north = faction("north");
  const murciaSub = "murcia" as never;
  const ofKindAll = <Kind extends TurnOutcome["kind"]>(outcomes: readonly TurnOutcome[], kind: Kind) =>
    outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

  it("refunds what had not started, forfeits what had, and pays the new holder less the raid cut", () => {
    const base = initialGameState(scenario);
    const attacker = unit("north-milan-32");
    const clm = territory("castilla-la-mancha");
    const clmSubs = (scenario.index.subTerritoriesByTerritory.get(clm) ?? []).map((sub) => sub.id);
    const mines = { developmentId: "mines", kind: "development" } as never;
    const farms = { developmentId: "farms", kind: "development" } as never;
    const funds = (amount: number): Resources => ({ funds: amount } as Resources);
    const state: GameState = {
      ...base,
      control: { ...base.control, [clm]: { factionId: north, kind: "controlled" } },
      raidCuts: [{ subTerritoryId: murciaSub, turnNumber: base.turnNumber }],
      subTerritories: {
        ...base.subTerritories,
        ...Object.fromEntries(clmSubs.map((id) => [id, { ...base.subTerritories[id]!, holder: north }])),
        [murciaSub]: { ...base.subTerritories[murciaSub]!, queue: [
          { factionId: republic, paid: funds(8), progress: 1, project: mines },
          { factionId: republic, paid: funds(6), progress: 0, project: farms }
        ] }
      },
      training: [{ factionId: republic, paid: { funds: 6, manpower: 1 } as Resources, paused: false, territoryId: murcia, turnsLeft: 1, typeId: "infantry-regiment" as never, unitId: "r_republic_infantry-regiment_1" as never }],
      treasuries: { ...base.treasuries, [republic]: { funds: 20, manpower: 10 } as Resources },
      units: { ...Object.fromEntries(Object.entries(base.units).filter(([, entry]) => entry.territoryId !== "murcia")), [attacker]: { ...base.units[attacker]!, territoryId: clm } }
    };
    const result = resolveTurn(scenario, state, [
      { factionId: republic, orders: [
        { factionId: republic, kind: "build", project: { buildingId: "hospital", kind: "building" } as never, subTerritoryId: murciaSub },
        { factionId: republic, kind: "recruit", territoryId: murcia, unitTypeId: "militia-column" as never }
      ] },
      { factionId: north, orders: [{ factionId: north, from: clm, kind: "move", to: murcia, unitId: attacker }] }
    ], 3);
    expect(result.finalState.subTerritories[murciaSub]!.holder).toBe(north);
    // $5: the head in progress passes to the North with its payment lost; the rest is refunded.
    expect(ofKindAll(result.outcomes, "build-forfeited").map((outcome) => outcome.project)).toEqual([mines]);
    expect(ofKindAll(result.outcomes, "build-refunded").map((outcome) => outcome.refund)).toEqual([funds(6), funds(6)]);
    expect(result.finalState.subTerritories[murciaSub]!.queue).toEqual([{ factionId: north, paid: {}, progress: 2, project: mines }]);
    // D28.2: the militia paid this turn is refunded; the regiment under way is lost.
    const training = ofKindAll(result.outcomes, "training-refunded");
    expect(training.map((outcome) => outcome.typeId)).toEqual(["infantry-regiment", "militia-column"]);
    expect(training.map((outcome) => outcome.refund)).toEqual([{}, { funds: 2, manpower: 3 }]);
    expect(result.finalState.training).toEqual([]);
    // U3: Murcia pays its new holder, less this turn's raid cut.
    const northIncome = ofKindAll(result.outcomes, "income").find((outcome) => outcome.factionId === north)!;
    expect(northIncome.cutSubTerritoryIds).toContain(murciaSub);
    // The books balance: what the Republic paid at reveal all came back but the forfeited head.
    const republicIncome = ofKindAll(result.outcomes, "income").find((outcome) => outcome.factionId === republic)!.paid as Record<string, number>;
    expect(result.finalState.treasuries[republic]).toEqual({ funds: 20 + 6 + (republicIncome["funds"] ?? 0), manpower: 10 + (republicIncome["manpower"] ?? 0) });
  });
});
