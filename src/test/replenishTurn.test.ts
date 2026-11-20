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
