// R2: at the end of each turn a territory where only one side has ground armies flips whole to
// that side. Every territory that starts contested must therefore have a ground army of every
// side that holds ground there, or it flips on turn 1 for no reason the player can see.
// Garrisons added for this are logged in milestone-3-rev-2-declog.md.
import { describe, expect, it } from "vitest";
import { unitTypeOf } from "../main/engine/movement/network";
import { holdersIn } from "../main/engine/partition/holders";
import { initialGameState } from "../main/engine/resolution";
import { shippedRegistry, spainId } from "./support";

describe("turn-1 contested territories (R2)", () => {
  const scenario = shippedRegistry().require(spainId).scenario;
  const state = initialGameState(scenario);
  /** Each contested territory: the sides holding ground there, and the sides with ground armies there (aircraft and generals never count). */
  const contested = scenario.territories.flatMap((territory) => {
    const holders = holdersIn(scenario, state.subTerritories, territory.id);
    if (holders.length < 2) return [];
    const armies = Object.values(state.units).filter((unit) => unit.territoryId === territory.id && unitTypeOf(scenario, state, unit.id)?.kind === "ground");
    return [{ armies: [...new Set(armies.map((unit) => unit.factionId))].sort(), holders: [...holders].sort(), territoryId: territory.id }];
  });

  it("lists every starting contested territory and the sides with armies in it", () => {
    expect(contested).toEqual([
      { armies: ["north", "republic"], holders: ["north", "republic"], territoryId: "asturias" },
      { armies: ["north", "republic"], holders: ["north", "republic"], territoryId: "pais-vasco" },
      // The Barbastro garrison holds eastern Huesca (declog: R2 garrison).
      { armies: ["north", "republic"], holders: ["north", "republic"], territoryId: "aragon" },
      { armies: ["north", "republic"], holders: ["north", "republic"], territoryId: "extremadura" },
      { armies: ["republic", "south"], holders: ["republic", "south"], territoryId: "islas-baleares" },
      { armies: ["republic", "south"], holders: ["republic", "south"], territoryId: "andalucia" }
    ]);
  });

  it("gives every side that holds ground in a contested territory an army there", () => {
    for (const entry of contested) expect(entry.armies, entry.territoryId).toEqual(entry.holders);
  });
});
