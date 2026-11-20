import { describe, expect, it } from "vitest";
import { validateAirMission, validateSack } from "../main/engine/air/validation";
import { standingHolder } from "../main/engine/d20/front";
import { pick, rollStream, type BattleDice } from "../main/engine/dice";
import { generalUnitDefinition } from "../main/engine/generals/identity";
import { builtInModuleRegistry } from "../main/engine/modules";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type {
  AirMission,
  AirMissionOrder,
  D20BattleOutcome,
  GameState,
  MoveOrder,
  PlayerSubmission,
  RaisedUnitDefinition,
  Scenario,
  SubTerritoryId,
  SubTerritoryState,
  TurnOutcome,
  TurnResolutionResult,
  UnitTypeId
} from "../main/engine/types";
import { holdWhole } from "./air/holdWhole";
import { type ArmySpec, battlefield, faction, move, spainD20, territory, unit } from "./support";

/**
 * Rules paths of the d20 front and standing battles with three factions (C3), the air missions
 * (grounding, anti-air, building hits) and the generals' step-9 part, on Spain as shipped.
 */

const scenario = spainD20();
const opening = initialGameState(scenario);

function loadedD20(faces: readonly number[]): BattleDice {
  return (index) => {
    let draws = 0;
    return () => {
      draws += 1;
      return draws === 1 ? ((faces[index] ?? 10) - 0.5) / 20 : 0;
    };
  };
}

function submit(...orders: readonly (MoveOrder | AirMissionOrder)[]): readonly PlayerSubmission[] {
  const factions = [...new Set(orders.map((order) => order.factionId))];
  return factions.map((factionId) => ({ factionId, orders: orders.filter((order) => order.factionId === factionId) }));
}

function mission(factionId: string, unitId: string, flown: AirMission): AirMissionOrder {
  return { factionId: faction(factionId), kind: "air-mission", mission: flown, unitId: unit(unitId) };
}

const battles = (result: TurnResolutionResult): readonly D20BattleOutcome[] =>
  result.outcomes.flatMap((outcome) => (outcome.kind === "battle" && outcome.dice === "d20" ? [outcome] : []));

const ofKind = <Kind extends TurnOutcome["kind"]>(result: TurnResolutionResult, kind: Kind) =>
  result.outcomes.filter((outcome): outcome is Extract<TurnOutcome, { kind: Kind }> => outcome.kind === kind);

const field = (armies: readonly ArmySpec[]) => battlefield(scenario, armies);

/** As `field`, with Andalucia the South's whole, so its armies may march out (C1). */
function southern(armies: readonly ArmySpec[]) {
  const placed = field(armies);
  return { scenario: placed.scenario, state: holdWhole(scenario, placed.state, territory("andalucia"), faction("south")) };
}

const grades = new Map(scenario.d20!.grades.map((grade) => [String(grade.id), grade]));

/** The first face whose single battle satisfies `wanted`, with its result. */
function firstFace(run: (face: number) => TurnResolutionResult, wanted: (battle: D20BattleOutcome, result: TurnResolutionResult) => boolean): { readonly battle: D20BattleOutcome; readonly result: TurnResolutionResult } {
  for (let face = 1; face <= 20; face += 1) {
    const result = run(face);
    const [battle] = battles(result);
    if (battle !== undefined && wanted(battle, result)) return { battle, result };
  }
  throw new Error(`no face gave the wanted battle: ${Array.from({ length: 20 }, (_, face) => battles(run(face + 1)).map((battle) => `${battle.site.kind}/${battle.attackerFactionId}/${battle.grade}/${battle.column}/${battle.score}`).join("+")).join(" ")}`);
}

function withSite(state: GameState, id: string, changes: Partial<SubTerritoryState>): GameState {
  const site = state.subTerritories[id as SubTerritoryId];
  if (site === undefined) throw new Error(`no sub-territory ${id}`);
  return { ...state, subTerritories: { ...state.subTerritories, [id]: { ...site, ...changes } } };
}

describe("territory battles with three factions (M19, C3)", () => {
  it("makes the capital holder the standing entrant of an empty territory, whatever its attack", () => {
    // Extremadura: Badajoz, its capital, is the Republic's; Caceres the North's.
    const { scenario: board, state } = southern([
      { faction: "republic", id: "r1", territory: "castilla-la-mancha", type: "militia-column" },
      { faction: "north", id: "n1", territory: "castilla-y-leon", type: "infantry-regiment" },
      { faction: "south", id: "s1", territory: "andalucia", type: "colonial-veterans" }
    ]);
    const result = resolveTurn(board, state, submit(
      move("republic", "r1", "castilla-la-mancha", "extremadura"), move("north", "n1", "castilla-y-leon", "extremadura"), move("south", "s1", "andalucia", "extremadura")
    ), 3, loadedD20([10, 10]));
    const fought = battles(result);
    expect(fought.map((battle) => [battle.site.kind, battle.attackerFactionId, battle.defender.armies.map((army) => army.unitId)])).toEqual([
      ["entry", "north", ["r1"]],
      ["entry", "south", ["r1"]]
    ]);
  });

  it("sends an ousted standing entrant back where it came from", () => {
    // The South (attack 7, fatigued) stands; the North (6, with Mola) attacks it below 1:1.
    const placed = southern([
      { faction: "north", id: "n1", territory: "castilla-y-leon", type: "colonial-veterans" },
      { faction: "south", id: "s1", territory: "andalucia", type: "colonial-veterans" },
      { faction: "south", fullStrength: 300, id: "s2", strength: 100, territory: "andalucia", type: "militia-column" }
    ]);
    const { scenario: board } = placed;
    const mola = opening.units[unit("north-general-mola")]!;
    const state: GameState = { ...placed.state, units: { ...placed.state.units, [mola.id]: { ...mola, territoryId: territory("castilla-y-leon") }, [unit("s1")]: { ...placed.state.units[unit("s1")]!, fatigue: 2 }, [unit("s2")]: { ...placed.state.units[unit("s2")]!, fatigue: 2 } } };
    const orders = submit(move("north", "n1", "castilla-y-leon", "extremadura"), move("north", "north-general-mola", "castilla-y-leon", "extremadura"),
      move("south", "s1", "andalucia", "extremadura"), move("south", "s2", "andalucia", "extremadura"));
    const { battle, result } = firstFace((face) => resolveTurn(board, state, orders, 3, loadedD20([face])),
      (fought, played) => grades.get(fought.grade)?.ground === "all" && played.finalState.units[unit("s1")] !== undefined);
    expect([battle.site.kind, battle.attackerFactionId]).toEqual(["entry", "north"]);
    expect(result.finalState.units[unit("s1")]?.territoryId).toBe("andalucia");
    expect(result.finalState.units[unit("n1")]?.territoryId).toBe("extremadura");
  });

  it("falls back to the last controller when the capital holder is not among the factions", () => {
    const north = { ...opening, control: { ...opening.control, [territory("andalucia")]: { factionId: faction("north"), kind: "controlled" as const } } };
    expect(standingHolder(scenario, opening, territory("andalucia"), [faction("south"), faction("north")])).toBe("south");
    expect(standingHolder(scenario, north, territory("andalucia"), [faction("republic"), faction("north")])).toBe("north");
    expect(standingHolder(scenario, opening, territory("andalucia"), [faction("republic"), faction("north")])).toBeUndefined();
  });
});

describe("standing battles (M27, C2, C3)", () => {
  it("has the capital holder defend when three factions share a territory, though its attack is the greatest", () => {
    const { scenario: board, state } = field([
      { faction: "republic", id: "r1", territory: "andalucia", type: "infantry-regiment" },
      { faction: "republic", id: "r2", territory: "andalucia", type: "infantry-regiment" },
      { faction: "north", id: "n1", territory: "andalucia", type: "infantry-regiment" },
      ...["s1", "s2", "s3"].map((id): ArmySpec => ({ faction: "south", id, territory: "andalucia", type: "colonial-veterans" }))
    ]);
    const [standing] = battles(resolveTurn(board, state, [], 3, loadedD20([10])));
    expect(standing?.site.kind).toBe("standing");
    expect(standing?.attackerFactionId).toBe("republic");
    expect(standing?.defender.armies.map((army) => army.unitId)).toEqual(["s1", "s2", "s3"]);
  });

  it("settles equal standing attacks with a seeded tie-break", () => {
    const { scenario: board, state } = field([
      { faction: "republic", id: "r1", territory: "andalucia", type: "infantry-regiment" },
      { faction: "south", id: "s1", territory: "andalucia", type: "infantry-regiment" }
    ]);
    const [standing] = battles(resolveTurn(board, state, [], 3));
    expect(standing?.site).toMatchObject({ kind: "standing", tieBreaks: [{ factionIds: ["republic", "south"], role: "attack" }] });
  });

  it("leaves the territory empty when the defender is ousted and the attackers break up", () => {
    // Six worn veterans, each just above the break-up share, against a lone truck column.
    const { scenario: board, state } = field([
      ...["s1", "s2", "s3", "s4", "s5", "s6"].map((id): ArmySpec => ({ faction: "south", fullStrength: 1000, id, strength: 105, territory: "andalucia", type: "colonial-veterans" })),
      { faction: "republic", id: "truck", territory: "andalucia", type: "truck-column" }
    ]);
    const { battle } = firstFace((face) => resolveTurn(board, state, [], 3, loadedD20([face])),
      (fought) => grades.get(fought.grade)?.ground === "all" && (grades.get(fought.grade)?.attacker.lossPercent ?? 0) >= 10);
    expect(battle.site).toMatchObject({ kind: "standing", occupation: { kind: "left-empty" } });
  });
});

describe("fatigue and rest without a partition module (D20-8)", () => {
  it("reads contested ground from shared armies: no quiet turn there, a quiet one elsewhere", () => {
    const none = builtInModuleRegistry.require("partition", "none");
    const plain: Scenario = { ...scenario, modules: scenario.modules.map((module) => (module.area === "partition" ? none : module)), rules: { ...scenario.rules, partition: "none" } };
    const { scenario: board, state } = battlefield(plain, [
      { faction: "republic", id: "r1", territory: "madrid", type: "infantry-regiment", demoralized: true },
      { faction: "north", id: "n1", territory: "madrid", type: "truck-column" },
      { faction: "republic", id: "r2", territory: "valencia", type: "infantry-regiment", demoralized: true }
    ]);
    const tired: GameState = { ...state, units: { ...state.units, [unit("r1")]: { ...state.units[unit("r1")]!, fatigue: 2 }, [unit("r2")]: { ...state.units[unit("r2")]!, fatigue: 2 } } };
    const result = resolveTurn(board, tired, [], 3);
    expect(result.finalState.units[unit("r1")]).toMatchObject({ fatigue: 2, morale: { demoralized: true } });
    expect(result.finalState.units[unit("r2")]).toMatchObject({ fatigue: 0, morale: { demoralized: false } });
  });
});

describe("air missions (U2, U3)", () => {
  const raid = (subTerritoryId: string) => mission("republic", "rep-breguet-bombers", { kind: "raid", subTerritoryId: subTerritoryId as SubTerritoryId });
  const buildingHitSeed = (() => {
    for (let seed = 1; seed < 200; seed += 1) if (pick(rollStream(seed, "raid", 1, 0), 20) >= 17) return seed;
    throw new Error("no building-hit seed");
  })();

  it("grounds aircraft in Mud without a paved airfield", () => {
    const muddy: GameState = { ...opening, weather: { outcomes: { meseta: "mud" } as never, roll: 10 } };
    const result = resolveTurn(scenario, muddy, submit(raid("burgos")), 3);
    expect(ofKind(result, "grounded")).toEqual([{ kind: "grounded", order: raid("burgos"), reason: "weather" }]);
    expect(ofKind(result, "raid")).toEqual([]);
    expect(result.finalState.units[unit("rep-breguet-bombers")]?.territoryId).toBe("madrid");
  });

  it("ignores the raider's own anti-air in the target territory", () => {
    const definition: RaisedUnitDefinition = { factionId: faction("republic"), fullStrength: 300, id: unit("rep-flak"), name: "Flak", type: "anti-air-battery" as UnitTypeId };
    const own: GameState = {
      ...opening,
      raised: { ...opening.raised, [definition.id]: definition },
      units: { ...opening.units, [definition.id]: { factionId: faction("republic"), fatigue: 0, id: definition.id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory("castilla-y-leon") } }
    };
    const [flown] = ofKind(resolveTurn(scenario, own, submit(raid("burgos")), 7), "raid");
    expect(flown?.roll).toBe(pick(rollStream(7, "raid", 1, 0), 20));
  });

  it("downgrades a paved airfield to an airfield on a building hit", () => {
    const paved = withSite(opening, "burgos", { buildings: ["paved-airfield" as never] });
    const result = resolveTurn(scenario, paved, submit(raid("burgos")), buildingHitSeed);
    expect(ofKind(result, "raid")[0]).toMatchObject({ buildingId: "paved-airfield", result: "building-hit" });
    expect(result.finalState.subTerritories["burgos" as SubTerritoryId]?.buildings).toEqual(["airfield"]);
  });

  it("drops the highest development level where there is no building, and does nothing at level 0", () => {
    const bare = withSite(opening, "burgos", { buildings: [], development: { farms: 2, mines: 1 } as never });
    const hit = resolveTurn(scenario, bare, submit(raid("burgos")), buildingHitSeed);
    expect(ofKind(hit, "raid")[0]).toMatchObject({ developmentId: "farms", result: "building-hit" });
    expect(hit.finalState.subTerritories["burgos" as SubTerritoryId]?.development).toEqual({ farms: 1, mines: 1 });
    const empty = withSite(opening, "burgos", { buildings: [], development: { farms: 0 } as never });
    const missed = resolveTurn(scenario, empty, submit(raid("burgos")), buildingHitSeed);
    expect(ofKind(missed, "raid")[0]).not.toHaveProperty("developmentId");
    expect(missed.finalState.subTerritories["burgos" as SubTerritoryId]?.development).toEqual({ farms: 0 });
  });

  it("reports support over a territory where no battle was fought", () => {
    const support = mission("republic", "rep-breguet-bombers", { kind: "support", territoryId: territory("madrid") });
    expect(ofKind(resolveTurn(scenario, opening, submit(support), 3), "air-support")).toEqual([{ kind: "air-support", order: support, territoryId: "madrid" }]);
  });
});

describe("replacement generals (D7, D27.7)", () => {
  const pending = (state: GameState, factionId: string, generalId: string): GameState => ({
    ...state,
    generals: { ...state.generals, [faction(factionId)]: { nextIndex: 2, pending: [{ arrivesOnTurn: 1, generalId: generalId as never }] } }
  });

  it("stays pending while the faction holds no territory to appear in", () => {
    const southless: GameState = { ...opening, units: Object.fromEntries(Object.entries(opening.units).filter(([, value]) => value.factionId !== "south")), subTerritories: Object.fromEntries(Object.entries(opening.subTerritories).map(([id, site]) => [id, site.holder === "south" ? { ...site, holder: faction("republic") } : site])) };
    const result = resolveTurn(scenario, pending(southless, "south", "jose-varela"), [], 3);
    expect(ofKind(result, "replacement-arrived")).toEqual([]);
    expect(result.finalState.generals[faction("south")]?.pending).toEqual([{ arrivesOnTurn: 1, generalId: "jose-varela" }]);
  });

  it("does not bring in a general already on the board", () => {
    const rojo = generalUnitDefinition(scenario, unit("general-vicente-rojo"));
    if (rojo === undefined) throw new Error("no Rojo");
    const present: GameState = {
      ...pending(opening, "republic", "vicente-rojo"),
      raised: { [rojo.id]: rojo },
      units: { ...opening.units, [rojo.id]: { factionId: faction("republic"), fatigue: 0, id: rojo.id, morale: { demoralized: false, quietTurns: 0 }, strength: rojo.fullStrength, territoryId: territory("valencia") } }
    };
    const result = resolveTurn(scenario, present, [], 3);
    expect(ofKind(result, "replacement-arrived")).toEqual([]);
    expect(result.finalState.units[rojo.id]?.territoryId).toBe("valencia");
  });
});

describe("air mission and sack validation (U2, U5)", () => {
  const raid = (unitId: string, subTerritoryId: string) => mission("republic", unitId, { kind: "raid", subTerritoryId: subTerritoryId as SubTerritoryId });

  it("refuses a mission without the air module, for an unknown unit, without an airfield, to an unknown or distant target", () => {
    const noAir: Scenario = { ...scenario, rules: { ...scenario.rules, air: "none" } };
    expect(validateAirMission(noAir, opening, raid("rep-breguet-bombers", "burgos")).ok).toBe(false);
    expect(validateAirMission(scenario, opening, raid("rep-nobody", "burgos")).ok).toBe(false);
    const grounded = withSite(withSite(opening, "madrid", { buildings: [] }), "henares", { buildings: [] });
    expect(validateAirMission(scenario, grounded, raid("rep-breguet-bombers", "burgos"))).toEqual({ ok: false, reason: "The aircraft has no airfield to fly from." });
    expect(validateAirMission(scenario, opening, raid("rep-breguet-bombers", "atlantis")).ok).toBe(false);
    const fighters = scenario.index.unitTypes.get("fighter-squadron" as UnitTypeId)!;
    const shortRange: Scenario = { ...scenario, index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes, [fighters.id, { ...fighters, air: { ...fighters.air!, range: 1 } }]]) } };
    const far = mission("republic", "rep-ni52-fighters", { kind: "intercept", territoryId: territory("valencia") });
    expect(validateAirMission(scenario, opening, far)).toEqual({ ok: true });
    expect(validateAirMission(shortRange, opening, far)).toEqual({ ok: false, reason: "The target is out of range." });
  });

  it("sacks only one's own general", () => {
    const sack = (factionId: string, unitId: string) => ({ factionId: faction(factionId), kind: "sack" as const, unitId: unit(unitId) });
    expect(validateSack(scenario, opening, sack("republic", "rep-general-miaja"))).toEqual({ ok: true });
    expect(validateSack(scenario, opening, sack("republic", "rep-nobody")).ok).toBe(false);
    expect(validateSack(scenario, opening, sack("north", "rep-general-miaja")).ok).toBe(false);
    expect(validateSack(scenario, opening, sack("republic", "rep-wad-ras-1")).ok).toBe(false);
  });
});
