import { describe, expect, it } from "vitest";
import { assess } from "../main/ai/assessment";
import { planWithdrawals } from "../main/ai/orders/withdraw";
import { createPlan } from "../main/ai/plan";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { seededRandom } from "../main/engine/random";
import { type GameState, isMoveOrder, type Scenario } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { armyValue, oddsForValues } from "../main/engine/combat";
import { heldWhole, oneShortOwners, type Placement } from "./aiBoards";
import { armyIn, faction, spain, spainWithAir, territory, unit, withUnits } from "./support";
import { lightBarricades, pinned } from "./pinned";

// D23 and D24: the computer player's defence of the ground that decides the game, and of its seat.

/** Own armies standing in the territory once the faction's orders are carried out. */
const stillHeld = (scenario: Scenario, state: GameState, factionId: string, territoryId: string, seed: number): number => {
  const moves = generateComputerSubmission(scenario, state, faction(factionId), seededRandom(seed)).orders.filter(isMoveOrder);
  const leaving = new Set(moves.map((order) => order.unitId));
  const staying = Object.values(state.units).filter((entry) => entry.factionId === factionId && entry.territoryId === territoryId && !leaving.has(entry.id)).length;
  return staying + moves.filter((order) => order.to === territoryId).length;
};

describe("victory defence (D23)", () => {
  // The Republic needs one more territory. The Asturian miners stand next to Galicia, the
  // Santander column next to Castilla y Leon and La Rioja, and La Rioja stands empty. The old
  // planner emptied Galicia, Castilla y Leon and Navarra to mass on Asturias, and left La Rioja
  // empty: any one of them lost the game.
  const units = [
    ["north-zamora-29", "north", "galicia"],
    ["north-san-marcial-22", "north", "castilla-y-leon"],
    ["north-san-quintin-25", "north", "castilla-y-leon"],
    ["north-america-23", "north", "navarra"],
    ["rep-asturian-militia", "republic", "asturias"],
    ["rep-santander-column", "republic", "cantabria"],
    ["rep-madrid-security", "republic", "madrid"],
    ["rep-wad-ras-1", "republic", "castilla-la-mancha"]
  ] as const;

  it("marks only ground a rival in reach would win by taking as critical", () => {
    const scenario = pinned(spainWithAir());
    const state = heldWhole(scenario, oneShortOwners, units);
    const republic = victoryProgress(scenario, state).find((entry) => entry.factionId === "republic");
    expect(republic && republic.territoryThreshold - republic.territoriesControlled).toBe(1);
    const north = assess(scenario, state, faction("north"));
    for (const id of ["galicia", "castilla-y-leon", "la-rioja"]) expect(north.isCritical(territory(id))).toBe(true);
    // The South's ground is beyond every Republican army's reach this turn.
    const south = assess(scenario, state, faction("south"));
    expect(south.isCritical(territory("ceuta"))).toBe(false);
    expect(south.stake(territory("ceuta"))).toBe(south.profile.stakes.territory);
  });

  it("empties a victory-critical territory only to strike the leader, and garrisons one standing empty", () => {
    for (const scenario of [spain(), spainWithAir()]) {
      const state = heldWhole(scenario, oneShortOwners, units);
      for (const seed of [1, 2, 3]) {
        expect(stillHeld(scenario, state, "north", "la-rioja", seed), `la-rioja, seed ${String(seed)}`).toBeGreaterThan(0);
        const moves = generateComputerSubmission(scenario, state, faction("north"), seededRandom(seed)).orders.filter(isMoveOrder);
        for (const id of ["galicia", "castilla-y-leon", "navarra"].filter((entry) => stillHeld(scenario, state, "north", entry, seed) === 0)) {
          const struck = moves.filter((order) => order.from === id).map((order) => oneShortOwners[order.to]);
          expect(struck, `${id}, seed ${String(seed)}`).toContain("republic");
        }
      }
    }
  });

  it("keeps the last army on an objective even when another is planned to arrive (S3, seed 57)", () => {
    // A planned arrival can fail (a full railhead, a bounce), so it never frees the last army
    // standing on an objective to leave it.
    const scenario = pinned(spainWithAir());
    const state = withUnits(scenario, [["north-milan-32", "north", "asturias"], ["north-zamora-29", "north", "galicia"], ["rep-asturian-militia", "republic", "cantabria"]]);
    const own = Object.values(state.units).filter((entry) => entry.factionId === "north");
    const plan = createPlan(assess(scenario, state, faction("north")), own);
    const [milan, zamora] = [state.units[unit("north-milan-32")], state.units[unit("north-zamora-29")]];
    if (milan === undefined || zamora === undefined) throw new Error("missing unit");
    plan.commit(zamora, territory("asturias"), true);
    expect(plan.armiesIn(territory("asturias"))).toBe(2);
    expect(plan.exposure([milan])).toBeUndefined();
  });

  it("counts a rail-borne threat (pressureOn reach)", () => {
    // Under `allowance` the Madrid guards can ride the rail beyond the next territory; under
    // one-step movement they threaten only Madrid's neighbours.
    const scenario = pinned(spainWithAir());
    const state = withUnits(scenario, [["rep-madrid-security", "republic", "madrid"], ["north-aragon-17", "north", "aragon"]]);
    const view = assess(scenario, state, faction("north"));
    const far = scenario.territories.map((entry) => entry.id).filter((id) => view.threatOrigins(id).has(territory("madrid")));
    const neighbours = new Set(scenario.connections.flatMap((connection) => (connection.between.includes(territory("madrid")) ? connection.between : [])));
    expect(far.some((id) => !neighbours.has(id))).toBe(true);
    const stepOnly = { ...scenario, rules: { ...scenario.rules, movement: "single-step" as const } };
    const near = assess(stepOnly, state, faction("north"));
    expect(scenario.territories.map((entry) => entry.id).filter((id) => near.threatOrigins(id).has(territory("madrid"))).every((id) => id === "madrid" || neighbours.has(id))).toBe(true);
  });
});

describe("withdrawals from the seat and the last objective (D24)", () => {
  const context = (scenario: Scenario, state: GameState, factionId: string) => ({ factionId: faction(factionId), memory: {}, planned: [], random: seededRandom(1), scenario, state });

  it("does not abandon the seat while it can still be held", () => {
    // Granada No. 6 holds part of Andalucia, the South's seat and its only objective with units,
    // against six Republican regiments: 24 to 6. The old 2:1 rule withdrew it.
    const scenario = lightBarricades(pinned(spain()));
    const state = withUnits(scenario, [
      ["south-granada-6", "south", "andalucia"],
      ["rep-vitoria-8", "republic", "andalucia"], ["rep-sevilla-34", "republic", "andalucia"], ["rep-castilla-3", "republic", "andalucia"],
      ["rep-otumba-9", "republic", "andalucia"], ["rep-guadalajara-10", "republic", "andalucia"], ["rep-wad-ras-1", "republic", "andalucia"]
    ]);
    expect(planWithdrawals(context(scenario, state, "south"))).toEqual([]);
    // The same odds on ordinary ground are hopeless, even odds of losing it whole: the North's
    // Caceres garrison, in Extremadura, which is neither its seat nor an objective.
    const elsewhere = withUnits(scenario, [
      ["north-argel-27", "north", "extremadura"],
      ["rep-vitoria-8", "republic", "extremadura"], ["rep-sevilla-34", "republic", "extremadura"], ["rep-castilla-3", "republic", "extremadura"],
      ["rep-otumba-9", "republic", "extremadura"], ["rep-guadalajara-10", "republic", "extremadura"], ["rep-wad-ras-1", "republic", "extremadura"]
    ]);
    expect(planWithdrawals(context(scenario, elsewhere, "north")).map((order) => order.unitId)).toEqual([unit("north-argel-27")]);
  });

  it("on a hopeless seat, withdraws all but a rearguard, and a lone defender stays (R2, S3)", () => {
    const scenario = lightBarricades(pinned(spain()));
    const republicans: Placement = [
      ["rep-vitoria-8", "republic", "andalucia"], ["rep-sevilla-34", "republic", "andalucia"], ["rep-castilla-3", "republic", "andalucia"],
      ["rep-otumba-9", "republic", "andalucia"], ["rep-guadalajara-10", "republic", "andalucia"],
      ["rep-catalan-columns", "republic", "andalucia"], ["rep-durruti-column", "republic", "andalucia"]
    ];
    // Leaving would leave the Republic alone there, which takes Andalucia whole (R2).
    const lone = withUnits(scenario, [["south-granada-6", "south", "andalucia"], ...republicans]);
    expect(planWithdrawals(context(scenario, lone, "south"))).toEqual([]);
    // With two, the stronger stays as the rearguard and the other leaves.
    const more: Placement = [
      ["rep-wad-ras-1", "republic", "andalucia"], ["rep-covadonga-4", "republic", "andalucia"], ["rep-basque-column", "republic", "andalucia"],
      ["rep-santander-column", "republic", "andalucia"], ["rep-barcelona-security", "republic", "andalucia"]
    ];
    const full = withUnits(scenario, [["south-granada-6", "south", "andalucia"], ["south-cadiz-33", "south", "andalucia"], ...republicans, ...more]);
    // A worn second regiment: the stand is hopeless with it too.
    const two: GameState = { ...full, units: { ...full.units, [unit("south-cadiz-33")]: { ...armyIn(full, "south-cadiz-33"), strength: 20 } } };
    const leaving = planWithdrawals(context(scenario, two, "south")).map((order) => order.unitId);
    expect(leaving).toHaveLength(1);
    const stays = [unit("south-granada-6"), unit("south-cadiz-33")].find((id) => !leaving.includes(id));
    const value = (id: string) => armyValue(scenario, armyIn(two, id), "defence");
    expect(stays).toBe(unit("south-granada-6"));
    expect(value("south-granada-6")).toBeGreaterThan(value("south-cadiz-33"));
  });

  it("never gives up two objectives at once: the second becomes the last stand", () => {
    // The North holds contested Pais Vasco and Aragon, its only objectives with units, and both
    // stands look hopeless by the ordinary rule (at least even odds of losing them whole).
    const scenario = lightBarricades(pinned(spain()));
    const full = withUnits(scenario, [
      ["north-flandes-5", "north", "pais-vasco"], ["rep-santander-column", "republic", "pais-vasco"],
      ["rep-vitoria-8", "republic", "pais-vasco"], ["rep-sevilla-34", "republic", "pais-vasco"],
      ["north-aragon-17", "north", "aragon"], ["rep-durruti-column", "republic", "aragon"], ["rep-catalan-columns", "republic", "aragon"],
      ["rep-barcelona-security", "republic", "aragon"], ["rep-otumba-9", "republic", "aragon"]
    ]);
    const halved = (id: string) => ({ ...armyIn(full, id), strength: armyIn(full, id).strength / 2 });
    const state: GameState = { ...full, units: { ...full.units, [unit("north-flandes-5")]: halved("north-flandes-5"), [unit("north-aragon-17")]: halved("north-aragon-17") } };
    const { hopelessTakeChance, lastStandTakeChance } = scenario.ai.profiles[faction("north")]!.withdraw;
    for (const [id, attack] of [["pais-vasco", 12], ["aragon", 13]] as const) {
      const { takeChance } = oddsForValues(scenario, state, { attackerFactionId: faction("republic"), defenderFactionIds: [faction("north")], diggingIn: false, territoryId: territory(id) }, attack, 3);
      expect(takeChance).toBeGreaterThanOrEqual(hopelessTakeChance);
      expect(takeChance).toBeLessThan(lastStandTakeChance);
    }
    const orders = planWithdrawals(context(scenario, state, "north"));
    expect(orders.map((order) => order.from)).toHaveLength(1);
  });

  it("holds its last objective while it can, even when every unit there is demoralized", () => {
    // The North's only objective with units is Pais Vasco (not its seat), held by a shaken battalion.
    const scenario = lightBarricades(pinned(spain()));
    const base = withUnits(scenario, [["north-flandes-5", "north", "pais-vasco"], ["rep-basque-column", "republic", "pais-vasco"]]);
    const shaken = base.units[unit("north-flandes-5")];
    if (shaken === undefined) throw new Error("missing unit");
    const state = { ...base, units: { ...base.units, [shaken.id]: { ...shaken, morale: { demoralized: true, quietTurns: 0 } } } };
    expect(planWithdrawals(context(scenario, state, "north"))).toEqual([]);
  });
});
