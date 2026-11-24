import { describe, expect, it } from "vitest";
import { legalMoves, withRoutes } from "../main/ai/orders/move";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { armyAllowance, truckBonus } from "../main/engine/movement/allowance";
import { amphibiousModifiers } from "../main/engine/movement/hooks";
import { holdsWhole, railCapacity, railReach, rideableNetwork } from "../main/engine/movement/network";
import { moveRoutes, validateRoute } from "../main/engine/movement/routes";
import type { GameState, MoveLeg, MoveOrder, Scenario, SubTerritoryId, SubTerritoryState, TerritoryId, TurnResolutionResult } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { armyLeaving, routeChips, routeTag } from "../main/presentation/movement";
import { loadPackage } from "../main/scenarios/loader";
import { type Json, modularMap, modularScenario } from "./modularFixture";
import { faction, move, submissionsOf, territory, unit } from "./support";

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);

/** The modular tiny-front, plus a lorry (carries 2) and a horse (mobile) type and some extra red units in Westfold. */
function load(mutate: (scenario: Json) => void = () => undefined): Scenario {
  const scenario = modularScenario();
  const types = scenario["unitTypes"] as Json[];
  types.push(
    { id: "lorry", name: "Lorry", attack: 0, defence: 0, kind: "ground", symbol: "transport", orders: ["move"], effects: [{ "@type": "transport", "@data": { carries: 2 } }] },
    { id: "horse", name: "Horse", attack: 3, defence: 3, kind: "ground", symbol: "cavalry", orders: ["move"], effects: [{ "@type": "mobile" }] }
  );
  const units = scenario["units"] as Json[];
  const extra = (id: string, type: string, territoryId = "westfold", factionId = "red"): Json => ({ id, name: id, factionId, type, formationKind: "other", strength: 400, fullStrength: 400, territoryId, sources: [{ sourceId: "fixture" }] });
  units.push(extra("red-second", "foot"), extra("red-lorry", "lorry"), extra("red-horse", "horse"), extra("red-third", "foot"), extra("blue-second", "foot", "harbor", "blue"));
  const map = modularMap();
  (map["unitSymbols"] as Json)["lorry"] = "src/test/fixtures/scenarios/tiny-front/foot.svg";
  (map["unitSymbols"] as Json)["horse"] = "src/test/fixtures/scenarios/tiny-front/foot.svg";
  mutate(scenario);
  return loadPackage({ assetPaths, mapDocument: map, mapPath: "map.json", scenarioDocument: scenario, scenarioPath: "scenario.json" }).scenario;
}

const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

/** R5: Motor runs on main roads; the fixture's roads are tracks, so these tests upgrade the Westfold-Highlands-Harbor road. */
function mainRoads(data: Json): void {
  for (const entry of data["links"] as Json[]) {
    if (!["west-hills|highlands", "highlands|port-quarter", "highlands|west-hills", "port-quarter|highlands"].includes(`${String(entry["a"])}|${String(entry["b"])}`)) continue;
    entry["modifiers"] = (entry["modifiers"] as Json[]).map((modifier) => (modifier["@type"] === "road" ? { "@type": "road", "@data": { level: "main" } } : modifier));
  }
}

function openHighlands(data: Json): void {
  for (const entry of data["subTerritories"] as Json[]) if (entry["id"] === "highlands") entry["terrain"] = "open";
  mainRoads(data);
}

function withSubs(state: GameState, changes: Readonly<Record<string, Partial<SubTerritoryState>>>): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const [id, change] of Object.entries(changes)) {
    const before = subTerritories[sub(id)];
    if (before === undefined) throw new Error(id);
    subTerritories[sub(id)] = { ...before, ...change };
  }
  return { ...state, subTerritories };
}

function placed(state: GameState, placements: Readonly<Record<string, string>>): GameState {
  const units = { ...state.units };
  for (const [id, territoryId] of Object.entries(placements)) {
    const before = units[unit(id)];
    if (before === undefined) throw new Error(id);
    units[unit(id)] = { ...before, territoryId: territory(territoryId) };
  }
  return { ...state, units };
}

const order = (factionId: string, unitId: string, from: string, legs: readonly MoveLeg[]): MoveOrder => ({
  factionId: faction(factionId),
  from: territory(from),
  kind: "move",
  legs,
  to: legs[legs.length - 1]?.to ?? territory(from),
  unitId: unit(unitId)
});
const land = (to: string): MoveLeg => ({ kind: "land", to: territory(to) });
const rail = (to: string): MoveLeg => ({ kind: "rail", to: territory(to) });
const sea = (to: string): MoveLeg => ({ kind: "sea", to: territory(to) });

function play(scenario: Scenario, state: GameState, orders: readonly MoveOrder[]): TurnResolutionResult {
  return resolveTurn(scenario, state, submissionsOf(orders), 1, () => () => 0.99);
}

const kinds = (result: TurnResolutionResult): readonly string[] => result.outcomes.map((outcome) => outcome.kind);
const at = (result: TurnResolutionResult, id: string): TerritoryId | undefined => result.finalState.units[unit(id)]?.territoryId;

describe("movement: ground and rail (M2, M3)", () => {
  it("holds a territory whole only when every sub-territory is the faction's", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    expect(holdsWhole(scenario, state, faction("red"), territory("westfold"))).toBe(true);
    expect(holdsWhole(scenario, withSubs(state, { "west-hills": { holder: faction("blue") } }), faction("red"), territory("westfold"))).toBe(false);
  });

  it("rides from the capital through held rail sub-territories, with range twice the lowest level (D7)", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const rides = railReach(scenario, state, faction("red"), territory("westfold"));
    const ride = rides.get(territory("highlands"));
    expect(ride).toMatchObject({ boarding: "west-town-quarter", crossings: 1, level: 1, range: 2 });
    expect(ride?.stations).toEqual(["west-town-quarter", "west-hills", "highlands"]);
    // Enemy ground is never a ride's end; the blue capitals are not reachable.
    expect(rides.has(territory("harbor"))).toBe(false);
  });

  it("does not ride through a sub-territory the faction does not hold, nor beyond the range", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    expect(railReach(scenario, withSubs(state, { "west-hills": { holder: faction("blue") } }), faction("red"), territory("westfold")).size).toBe(0);
    expect(railReach(scenario, withSubs(state, { "west-hills": { rail: 0 } }), faction("red"), territory("westfold")).size).toBe(0);
    // Red holds the whole ring at rail 1 except the start: range 2 reaches two borders away, not three.
    const all = withSubs(state, { "port-quarter": { holder: faction("red") }, lowlands: { holder: faction("red"), rail: 0 } });
    const reach = railReach(scenario, { ...placed(all, { "blue-marines": "isle", "blue-second": "isle" }) }, faction("red"), territory("westfold"));
    expect([...reach.keys()]).toEqual(["highlands", "harbor"]);
  });

  it("boards the scenario's units per station level, plus its buildings' rail capacity (D5)", () => {
    const scenario = load((data) => {
      (data["buildings"] as Json[]).push({ id: "yard", name: "Yard", cost: { funds: 1 }, turns: 1, effects: [{ "@type": "rail-capacity", "@data": { units: 2 } }] });
    });
    const state = initialGameState(scenario);
    expect(railCapacity(scenario, state, sub("west-town-quarter"))).toBe(4);
    const yard = (rail: number) => withSubs(state, { "west-town-quarter": { buildings: ["yard" as never], rail } });
    expect(railCapacity(scenario, yard(2), sub("west-town-quarter"))).toBe(6);
    expect(railCapacity(scenario, yard(1), sub("west-town-quarter"))).toBe(4);
    expect(railCapacity(scenario, yard(0), sub("west-town-quarter"))).toBe(0);
    expect(railCapacity(scenario, state, sub("nowhere"))).toBe(0);
    // The number is the scenario's own.
    const roomy = { ...scenario, linkModifiers: { ...scenario.linkModifiers, rail: { label: "Railway", rangeByLevel: { main: 4, single: 2 }, unitsPerLevel: 5 } } };
    expect(railCapacity(roomy, state, sub("west-town-quarter"))).toBe(10);
    expect(railCapacity({ ...scenario, linkModifiers: {} }, state, sub("west-town-quarter"))).toBe(0);
  });
});

describe("movement: allowance (M1)", () => {
  it("gives +1 with a truck for every two other units, none needed for cavalry", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    expect(truckBonus(scenario, state, [unit("red-guard")])).toBe(0);
    expect(truckBonus(scenario, state, [unit("red-guard"), unit("red-second"), unit("red-lorry")])).toBe(1);
    expect(truckBonus(scenario, state, [unit("red-guard"), unit("red-second"), unit("red-third"), unit("red-lorry")])).toBe(0);
    expect(truckBonus(scenario, state, [unit("red-horse")])).toBe(1);
    expect(armyAllowance(scenario, state, faction("red"), territory("westfold"), [unit("red-guard"), unit("red-lorry")])).toBe(2);
    expect(armyAllowance(scenario, state, faction("red"), territory("westfold"), [unit("red-guard")])).toBe(1);
  });

  it("offers Motor only within the allowance, and counts a mountain entry on a March", () => {
    const scenario = load(mainRoads);
    const state = initialGameState(scenario);
    const trucked = [unit("red-guard"), unit("red-lorry")];
    // R5, declog D13: Motor runs on the main road through the mountain at no extra cost.
    expect(moveRoutes(scenario, state, faction("red"), territory("westfold"), trucked).get(territory("harbor"))).toMatchObject({ cost: 2, mode: "motor", rough: [], shape: "march" });
    // Without trucks there is no Motor: the guard rides, then steps.
    expect(moveRoutes(scenario, state, faction("red"), territory("westfold"), [unit("red-guard")]).get(territory("harbor"))?.shape).toBe("rail-step");
    const open = load(openHighlands);
    const openState = withSubs(initialGameState(open), { "west-hills": { rail: 0 } });
    expect(moveRoutes(open, openState, faction("red"), territory("westfold"), trucked).get(territory("harbor"))?.legs).toEqual([land("highlands"), land("harbor")]);
    expect(moveRoutes(open, openState, faction("red"), territory("westfold"), [unit("red-guard")]).has(territory("harbor"))).toBe(false);
    // Cavalry ignore the mountain.
    expect(moveRoutes(scenario, withSubs(state, { "west-hills": { rail: 0 } }), faction("red"), territory("westfold"), [unit("red-horse")]).get(territory("harbor"))?.shape).toBe("march");
  });
});

describe("movement: routes and their checks (M2, M4, M5)", () => {
  it("offers the step, rail and rail-then-step shapes", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const routes = moveRoutes(scenario, state, faction("red"), territory("westfold"), [unit("red-guard")]);
    expect(routes.get(territory("highlands"))?.shape).toBe("step");
    expect(routes.get(territory("lowlands"))?.shape).toBe("step");
    expect(routes.get(territory("harbor"))).toMatchObject({ legs: [rail("highlands"), land("harbor")], shape: "rail-step", staging: "highlands", transit: ["highlands"] });
  });

  it("refuses a route whose earlier steps cross enemy ground, or an unknown shape", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    expect(validateRoute(scenario, state, order("red", "red-guard", "westfold", [land("lowlands"), land("harbor")])).ok).toBe(false);
    expect(validateRoute(scenario, state, order("red", "red-guard", "westfold", [rail("highlands"), rail("harbor")])).ok).toBe(false);
    expect(validateMoveOrder(scenario, state, order("red", "red-guard", "westfold", [rail("highlands"), land("harbor")])).ok).toBe(true);
  });

  it("sails from a friendly port and lands in a friendly port or assaults the coast", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const blue = moveRoutes(scenario, state, faction("blue"), territory("harbor"), [unit("blue-marines")]);
    expect(blue.get(territory("isle"))?.sea).toMatchObject({ kind: "port", level: 1 });
    const redIsle = withSubs(state, { isle: { holder: faction("red") } });
    expect(moveRoutes(scenario, redIsle, faction("blue"), territory("harbor"), [unit("blue-marines")]).get(territory("isle"))?.sea?.kind).toBe("amphibious");
    // Red holds no port in Harbor, so it cannot sail from there.
    const redInHarbor = placed(state, { "red-guard": "harbor" });
    expect(validateRoute(scenario, redInHarbor, order("red", "red-guard", "harbor", [sea("isle")])).ok).toBe(false);
  });

  it("takes the amphibious modifier from the attacker's sea-only origin", () => {
    const scenario = load();
    const state = withSubs(initialGameState(scenario), { isle: { holder: faction("red") } });
    const context = { attackerFactionId: faction("blue"), attackerUnitIds: [unit("blue-marines")], defenderFactionIds: [faction("red")], diggingIn: false, scenario, state, territoryId: territory("isle") };
    expect(amphibiousModifiers(context)).toEqual([{ kind: "amphibious", roll: -4 }]);
    expect(amphibiousModifiers({ ...context, state: initialGameState(scenario) })).toEqual([]);
  });
});

describe("movement: resolution (step 1 armies, step 3 transit)", () => {
  it("moves an army by rail and then into an attack from the staging territory", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const result = play(scenario, state, [order("red", "red-guard", "westfold", [rail("highlands"), land("harbor")])]);
    expect(kinds(result)).toContain("move-transit");
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    expect(battle?.kind === "battle" ? battle.site : undefined).toMatchObject({ territoryId: "harbor" });
    expect(battle?.kind === "battle" ? battle.attacker.armies.map((army) => army.from) : []).toEqual(["highlands"]);
  });

  it("stops an army passing through a territory an enemy enters, to defend it (Q-UX-I3)", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const result = play(scenario, state, [
      order("red", "red-guard", "westfold", [rail("highlands"), land("harbor")]),
      order("blue", "blue-marines", "harbor", [land("highlands")])
    ]);
    const intercepted = result.outcomes.find((outcome) => outcome.kind === "move-intercepted");
    expect(intercepted).toMatchObject({ stoppedAt: "highlands", to: "harbor", unitIds: ["red-guard"] });
    expect(result.outcomes.some((outcome) => outcome.kind === "reinforcement-arrived" && outcome.order.unitId === unit("red-guard"))).toBe(true);
  });

  it("holds back an army whose route is longer than its allowance", () => {
    const open = load(openHighlands);
    const state = initialGameState(open);
    const result = play(open, state, [order("red", "red-guard", "westfold", [land("highlands"), land("harbor")])]);
    expect(result.outcomes.find((outcome) => outcome.kind === "move-held-back")).toMatchObject({ reason: "allowance" });
    expect(at(result, "red-guard")).toBe("westfold");
    const trucked = play(open, state, [
      order("red", "red-guard", "westfold", [land("highlands"), land("lowlands")]),
      order("red", "red-lorry", "westfold", [land("highlands"), land("lowlands")])
    ]);
    expect(kinds(trucked)).not.toContain("move-held-back");
  });

  it("boards armies while their units fit the trains, and holds back whole the one that does not (D5)", () => {
    const scenario = load();
    const state = withSubs(initialGameState(scenario), { "west-town-quarter": { rail: 1 } });
    const result = play(scenario, state, [
      order("red", "red-guard", "westfold", [rail("highlands")]),
      order("red", "red-second", "westfold", [rail("highlands")]),
      order("red", "red-third", "westfold", [rail("highlands"), land("harbor")])
    ]);
    const held = result.outcomes.filter((outcome) => outcome.kind === "move-held-back");
    expect(held).toMatchObject([{ rail: { boarding: "west-town-quarter", left: 0, places: 1 }, reason: "rail-full", unitIds: ["red-third"] }]);
    expect(at(result, "red-second")).toBe("highlands");
    expect(at(result, "red-guard")).toBe("highlands");
  });

  it("refuses an army its trains can't take whole, and lets a later one that fits board (D5)", () => {
    const scenario = load();
    const state = withSubs(initialGameState(scenario), { "west-town-quarter": { rail: 1 } });
    const result = play(scenario, state, [
      order("red", "red-guard", "westfold", [rail("highlands")]),
      order("red", "red-second", "westfold", [rail("highlands")]),
      order("red", "red-lorry", "westfold", [rail("highlands")]),
      order("red", "red-third", "westfold", [rail("highlands"), land("harbor")])
    ]);
    // The truck takes a place too: three units on two places.
    const held = result.outcomes.filter((outcome) => outcome.kind === "move-held-back");
    expect(held).toMatchObject([{ rail: { boarding: "west-town-quarter", left: 2, places: 3 }, reason: "rail-full", unitIds: ["red-guard", "red-second", "red-lorry"] }]);
    for (const id of ["red-guard", "red-second", "red-lorry"]) expect(at(result, id)).toBe("westfold");
    expect(at(result, "red-third")).not.toBe("westfold");
  });

  it("lands units sailing one lane together as one amphibious army (W4)", () => {
    const scenario = load();
    const state = withSubs(initialGameState(scenario), { isle: { holder: faction("red") } });
    const two: MoveOrder[] = [order("blue", "blue-marines", "harbor", [sea("isle")]), move("blue", "blue-second", "harbor", "isle")];
    const result = play(scenario, state, two);
    expect(kinds(result)).not.toContain("move-held-back");
    expect(at(result, "blue-marines")).toBe("isle");
  });
});

describe("movement: the computer player (H5)", () => {
  it("offers routed moves, rail and rail-then-step included, and never plans a truck alone", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const guard = state.units[unit("red-guard")];
    const lorry = state.units[unit("red-lorry")];
    if (guard === undefined || lorry === undefined) throw new Error("fixture");
    expect(legalMoves(scenario, state, guard).find((move) => move.to === territory("harbor"))?.legs).toEqual([rail("highlands"), land("harbor")]);
    expect(legalMoves(scenario, state, lorry)).toEqual([]);
  });

  it("sends a free truck with a march, and cuts a march no truck can carry", () => {
    const open = load(openHighlands);
    const state = withSubs(initialGameState(open), { "west-hills": { rail: 0 } });
    const march = order("red", "red-guard", "westfold", [land("highlands"), land("harbor")]);
    const routed = withRoutes(open, state, faction("red"), [march]);
    expect(routed.map((planned) => planned.unitId)).toEqual(["red-guard", "red-lorry"]);
    expect(routed.every((planned) => planned.to === territory("harbor"))).toBe(true);
    const noTrucks = placed(state, { "red-lorry": "highlands" });
    expect(withRoutes(open, noTrucks, faction("red"), [march]).find((planned) => planned.unitId === unit("red-guard"))?.to).toBe("highlands");
  });

  it("takes the offered route for each destination: a neighbour by a step, so the departure is left for a ride", () => {
    const scenario = load();
    const state = withSubs(initialGameState(scenario), { "west-town-quarter": { rail: 1 } });
    const routed = withRoutes(scenario, state, faction("red"), [
      order("red", "red-guard", "westfold", [rail("highlands")]),
      order("red", "red-second", "westfold", [rail("highlands"), land("harbor")])
    ]);
    expect(routed.map((planned) => `${planned.unitId}>${planned.to}>${String(planned.legs?.length ?? 0)}`)).toEqual(["red-guard>highlands>0", "red-lorry>highlands>0", "red-second>harbor>2"]);
  });
});

describe("movement: what the planning screen says (X5)", () => {
  it("tags routes and sums up the army leaving", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    const routes = moveRoutes(scenario, state, faction("red"), territory("westfold"), [unit("red-guard"), unit("red-second")]);
    const harbor = routes.get(territory("harbor"));
    if (harbor === undefined) throw new Error("route");
    expect(routeTag(harbor, true)).toBe("Rail, then attack");
    // m8: the map plaque and the pane row use the same words.
    expect(routeTag(harbor, false)).toBe("Rail, then march");
    expect(routeChips(scenario, harbor, [], 1, undefined).map((chip) => chip.kind)).toEqual(["rail", "transit"]);
    expect(armyLeaving(scenario, state, faction("red"), territory("westfold"), [unit("red-guard"), unit("red-second")])?.line)
      .toBe("1 move this turn: no trucks (1 truck for these 2 units would give +1). Rail does not use moves.");
    const step = routes.get(territory("highlands"));
    if (step === undefined) throw new Error("route");
    expect(routeChips(scenario, step, [], 1, undefined).map((chip) => chip.text)).toEqual(["Mountain entry (highlands)"]);
  });
});

describe("movement: an amphibious assault in play (M5, D7)", () => {
  it("takes the amphibious modifier in the d20 battle for a coast with no friendly port", () => {
    const scenario = load();
    const state = placed(withSubs(initialGameState(scenario), { isle: { holder: faction("red") } }), { "red-rangers": "isle" });
    const result = play(scenario, { ...state, control: { ...state.control, [territory("isle")]: { factionId: faction("red"), kind: "controlled" } } }, [order("blue", "blue-marines", "harbor", [sea("isle")])]);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    expect(battle?.kind === "battle" ? battle.modifiers : []).toContainEqual({ kind: "amphibious", roll: -4 });
  });
});

describe("movement: the rideable network (X6)", () => {
  it("lights every station the units can reach within range, not only the shortest routes", () => {
    const scenario = load();
    const state = initialGameState(scenario);
    expect([...rideableNetwork(scenario, state, faction("red"), territory("westfold"))].sort()).toEqual(["highlands", "west-hills", "west-town-quarter"]);
    expect(rideableNetwork(scenario, withSubs(state, { "west-hills": { rail: 0 } }), faction("red"), territory("westfold")).size).toBe(0);
  });
});
