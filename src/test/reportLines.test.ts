import { describe, expect, it } from "vitest";
import { raisedUnitId } from "../main/engine/recruitment/rules";
import { initialGameState } from "../main/engine/resolution";
import type {
  AirMissionOrder,
  BuildingId,
  BuildProject,
  DevelopmentId,
  GeneralId,
  ResourceId,
  Resources,
  SubTerritoryId,
  SystemOutcome,
  UnitTypeId,
  WeatherId,
  WeatherZoneId
} from "../main/engine/types";
import { describeSystemOutcome, isSystemOutcome } from "../main/presentation/systemText";
import { describeOutcome } from "../main/presentation/text";
import { faction, move, spainWithAir, territory, unit } from "./support";

const scenario = spainWithAir();
const state = initialGameState(scenario);
const republic = faction("republic");
const south = faction("south");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const amount = (funds: number, manpower = 0): Resources => ({ ["funds" as ResourceId]: funds, ["manpower" as ResourceId]: manpower });
const militia = raisedUnitId(republic, "militia-column" as UnitTypeId, 3);
const bomber: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "raid", subTerritoryId: sub("sevilla") }, unitId: unit("rep-breguet-bombers") };
const factory: BuildProject = { buildingId: "factory" as BuildingId, kind: "building" };
const farms: BuildProject = { developmentId: "farms" as DevelopmentId, kind: "development" };
const line = (outcome: SystemOutcome, viewer = republic) => describeSystemOutcome(outcome, { scenario, state, viewer });

describe("report lines carry the outcome's data (m3r1 contract follow-ups)", () => {
  it("name the unit, the place and the amounts for recruitment (R2-R7, C8)", () => {
    expect(line({ factionId: republic, kind: "training-completed", territoryId: territory("catalunya"), typeId: "militia-column" as UnitTypeId, unitId: militia }))
      .toBe("Militia column No. 3 finished training at Barcelona. It can move next turn.");
    expect(line({ kind: "training-started", order: { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as UnitTypeId }, paid: amount(2, 3), turnsLeft: 1, unitId: militia }))
      .toBe("Militia column No. 3 began training at Barcelona for 2 Funds and 3k Manpower; ready in 1 turn.");
    expect(line({ factionId: republic, kind: "training-paused", territoryId: territory("catalunya"), unitId: militia })).toContain("while Catalu\u00f1a is contested");
    expect(line({ factionId: republic, kind: "training-refunded", reason: "The capital fell while the unit was training; its payment is lost.", refund: {}, territoryId: territory("catalunya"), typeId: "militia-column" as UnitTypeId }))
      .toBe("A Militia column at Barcelona was not raised. The capital fell while the unit was training; its payment is lost.");
    expect(line({ kind: "replenish-applied", men: 700, order: { factionId: republic, kind: "replenish", unitId: militia }, paid: amount(1, 1), recovered: true }))
      .toBe("Militia column No. 3 took in 700 men for 1 Funds and 1k Manpower and recovered its morale.");
    expect(line({ kind: "replenish-cancelled", order: { factionId: republic, kind: "replenish", unitId: militia }, reason: "The unit fought a battle.", refund: amount(1) }))
      .toBe("Militia column No. 3 was not replenished: The unit fought a battle. 1 Funds refunded.");
  });

  it("name projects, sub-territories and amounts for the economy, keeping a forfeit's payment to its payer ($1-$8)", () => {
    expect(line({ kind: "build-queued", order: { factionId: republic, kind: "build", project: factory, subTerritoryId: sub("girona") }, paid: amount(10), position: 0 }))
      .toBe("Republican Government paid 10 Funds for Factory at Girona; work starts this turn.");
    expect(line({ factionId: republic, kind: "build-progressed", progress: 1, project: farms, subTerritoryId: sub("girona"), turns: 3 })).toBe("Farms at Girona: 1 of 3 turns done.");
    expect(line({ factionId: republic, kind: "build-completed", project: farms, subTerritoryId: sub("lleida") })).toBe("Republican Government raised Farms to level 2 at Lleida.");
    expect(line({ factionId: republic, kind: "build-completed", project: factory, subTerritoryId: sub("girona") })).toBe("Republican Government built a Factory at Girona.");
    const forfeit: SystemOutcome = { kind: "build-forfeited", lost: amount(6), newHolder: south, previousHolder: republic, project: factory, subTerritoryId: sub("malaga") };
    expect(line(forfeit, republic)).toContain("; the 6 Funds paid for it is lost.");
    expect(line(forfeit, south)).toBe("Factory at M\u00e1laga passed, unfinished, from Republican Government to Southern Insurgent Command.");
    expect(line({ factionId: republic, kind: "build-refunded", project: factory, reason: "captured", refund: amount(6), subTerritoryId: sub("malaga") }))
      .toBe("Factory at M\u00e1laga was not built. The sub-territory changed hands before work began. 6 Funds refunded.");
    expect(line({ cut: amount(1, 3), cutSubTerritoryIds: [sub("barcelona")], factionId: republic, kind: "income", paid: amount(14, 27) }))
      .toBe("Republican Government's income from territories held whole: +14 Funds \u00b7 +27k Manpower, after raids cut 1 Funds and 3k Manpower.");
  });

  it("name the target, the raider and what was hit for air missions (U2-U4)", () => {
    const raid = { aircraftLost: [], kind: "raid", order: bomber, roll: 15, subTerritoryId: sub("sevilla") } as const;
    expect(line({ ...raid, buildingId: "airfield" as BuildingId, result: "building-hit" })).toMatch(/^Raid on Sevilla by Republican Government's .+: Airfield hit\.$/u);
    // Andaluc\u00eda is contested from turn 1, so it pays nobody and a raid there cuts nothing ($2, as raidIncomeDelta).
    expect(line({ ...raid, result: "income-cut" })).toMatch(/: no income to cut while Andaluc\u00eda is contested\.$/u);
    expect(line({ ...raid, result: "income-cut", subTerritoryId: sub("navarra") })).toMatch(/^Raid on Navarra by .+: income cut by 2k Manpower next turn\.$/u);
    expect(describeSystemOutcome({ ...raid, result: "income-cut" }, { scenario })).toMatch(/: income cut next turn\.$/u);
    expect(line({ ...raid, aircraftLost: [unit("rep-breguet-bombers")], result: "air-eliminated" })).toMatch(/: the raider was shot down\.$/u);
    expect(line({ ...raid, aircraftLost: [unit("rep-ni52-fighters")], result: "nothing-hit" })).toMatch(/: nothing hit; 1 aircraft lost to fighters\.$/u);
    expect(line({ ...raid, developmentId: "farms" as DevelopmentId, result: "building-hit" })).toMatch(/: Farms down a level\.$/u);
    expect(line({ kind: "grounded", order: bomber, reason: "weather" })).toMatch(/was grounded by the weather\.$/u);
    expect(line({ kind: "recon", order: bomber, territoryId: territory("andalucia"), untilTurn: 3 })).toMatch(/reconnaissance over Andaluc\u00eda; .* until turn 3\.$/u);
  });

  it("name units and places for contested ground, moves, morale, weather and generals", () => {
    expect(line({ kind: "withdrew", order: { factionId: republic, from: territory("andalucia"), kind: "withdraw", to: territory("murcia"), unitId: unit("rep-wad-ras-1") } }))
      .toBe("Republican Government: Wad-Ras Infantry Regiment No. 1 withdrew from Andaluc\u00eda to Murcia through its own sub-territories.");
    expect(line({ after: 1, before: 2, kind: "rail-damaged", subTerritoryId: sub("cordoba") })).toBe("Fighting damaged the rail at C\u00f3rdoba: level 2 to 1.");
    expect(line({ factionId: republic, from: territory("madrid"), kind: "move-transit", legs: [{ kind: "rail", to: territory("valencia") }], to: territory("valencia"), unitIds: [unit("rep-wad-ras-1")] }))
      .toBe("Republican Government: Wad-Ras Infantry Regiment No. 1 travelled Madrid \u2192 Valencia (rail).");
    expect(line({ factionId: republic, from: territory("madrid"), kind: "move-held-back", reason: "rail-departures", to: territory("valencia"), unitIds: [unit("rep-wad-ras-1")] }))
      .toContain("stayed in Madrid; no rail departures were left at Madrid this turn.");
    expect(line({ byFactionIds: [south], factionId: republic, from: territory("madrid"), kind: "move-intercepted", stoppedAt: territory("castilla-la-mancha"), to: territory("andalucia"), unitIds: [unit("rep-wad-ras-1")] }))
      .toContain("as Southern Insurgent Command entered it; it will defend it.");
    expect(line({ demoralized: false, factionId: republic, fatigue: 2, kind: "fatigue", unitId: unit("rep-wad-ras-1") })).toBe("Wad-Ras Infantry Regiment No. 1 is tiring from the attack (fatigue 2).");
    expect(line({ factionId: republic, generalId: "jose-miaja" as GeneralId, kind: "rallied", territoryId: territory("madrid"), unitIds: [unit("rep-wad-ras-1")] })).toBe("Jos\u00e9 Miaja rallied 1 demoralized unit in Madrid.");
    expect(line({ kind: "weather-rolled", turnNumber: 2, weather: { outcomes: { ["meseta" as WeatherZoneId]: "rain" as WeatherId }, roll: 12 } })).toBe("Weather on turn 2: Meseta Rain.");
    expect(line({ arrivesOnTurn: 2, factionId: republic, generalId: "vicente-rojo" as GeneralId, kind: "replacement-due" })).toBe("Vicente Rojo has been called to command for Republican Government and arrives on turn 2.");
    expect(line({ generalId: "jose-miaja" as GeneralId, kind: "general-sacked", order: { factionId: republic, kind: "sack", unitId: unit("rep-general-miaja") } })).toBe("Republican Government relieved Jos\u00e9 Miaja of command.");
  });

  it("give every other kind a sentence of its own", () => {
    const held = { factionId: republic, from: territory("madrid"), kind: "move-held-back", to: territory("valencia"), unitIds: [unit("rep-wad-ras-1"), militia] } as const;
    expect(line({ ...held, reason: "allowance" })).toBe("Republican Government: Wad-Ras Infantry Regiment No. 1 and Militia column No. 3 stayed in Madrid; the route to Valencia is longer than it can move this turn.");
    expect(line({ ...held, reason: "port-landings" })).toContain("the port at Valencia had no room left this turn.");
    expect(line({ ...held, reason: "amphibious-lane" })).toContain("the sea lane to Valencia already carried a landing this turn.");
    expect(line({ factionId: republic, from: territory("andalucia"), kind: "path-surrender", unitId: unit("rep-wad-ras-1") })).toContain("was cut off in Andaluc\u00eda and surrendered");
    expect(line({ factionId: republic, generalId: "jose-miaja" as GeneralId, kind: "general-died", territoryId: territory("madrid"), unitId: unit("rep-general-miaja") })).toBe("Jos\u00e9 Miaja was killed when his army was broken in Madrid.");
    const general = move("republic", "rep-general-miaja", "madrid", "valencia");
    expect(line({ arrived: true, kind: "general-moved", order: general })).toMatch(/ went with his army to Valencia\.$/u);
    expect(line({ arrived: false, kind: "general-moved", order: general })).toMatch(/ stayed behind: his army did not reach Valencia\.$/u);
    expect(line({ factionId: republic, generalId: "vicente-rojo" as GeneralId, kind: "replacement-arrived", territoryId: territory("madrid"), unitId: unit("general-vicente-rojo") })).toBe("Vicente Rojo took command in Madrid.");
    expect(line({ factionId: south, interceptorIds: [], kind: "interception", lostUnitIds: [], raiderIds: [], territoryId: territory("andalucia") })).toBe("Southern Insurgent Command's fighters intercepted enemy aircraft over Andaluc\u00eda.");
    expect(line({ factionId: south, interceptorIds: [], kind: "interception", lostUnitIds: [unit("rep-breguet-bombers")], raiderIds: [], territoryId: territory("andalucia") })).toMatch(/, shooting down 1\.$/u);
    expect(line({ applied: true, battleIndex: 0, kind: "air-support", order: bomber, territoryId: territory("andalucia") })).toMatch(/ gave Ground Support in the battle for Andaluc\u00eda\.$/u);
    expect(line({ applied: false, battleIndex: 0, kind: "air-support", order: bomber, territoryId: territory("andalucia") })).toMatch(/ flew Ground Support for the battle for Andaluc\u00eda, but its support did not count\.$/u);
    expect(line({ kind: "air-support", order: bomber, territoryId: territory("andalucia") })).toMatch(/ flew Ground Support over Andaluc\u00eda, but no battle was fought there\.$/u);
    expect(line({ kind: "grounded", order: bomber, reason: "Out of range." })).toMatch(/ did not fly: Out of range\.$/u);
    expect(line({ factionId: republic, from: territory("catalunya"), kind: "aircraft-rebased", to: territory("valencia"), unitId: unit("rep-breguet-bombers") })).toMatch(/ lost its airfield in Catalu\u00f1a and flew to Valencia\.$/u);
    expect(line({ factionId: republic, from: territory("catalunya"), kind: "aircraft-lost", unitId: unit("rep-breguet-bombers") })).toMatch(/ was destroyed on the ground\.$/u);
    expect(line({ factionId: republic, kind: "frostbite", men: 125, territoryId: territory("aragon"), unitId: militia })).toBe("Militia column No. 3 lost 125 men to frostbite in Arag\u00f3n.");
    expect(line({ factionId: republic, heldUnitCount: 3, kind: "time-ran-out" })).toBe("Republican Government's time ran out: 3 units held.");
    expect(line({ demoralized: true, factionId: republic, fatigue: 3, kind: "fatigue", unitId: militia })).toContain("is demoralized");
    expect(line({ demoralized: false, factionId: republic, fatigue: 0, kind: "fatigue", unitId: militia })).toBe("Militia column No. 3 rested and is no longer fatigued.");
    expect(line({ factionId: republic, kind: "build-refunded", project: factory, reason: "Not enough Funds.", refund: {}, subTerritoryId: sub("girona") })).toBe("Factory at Girona was not built. Not enough Funds.");
    expect(line({ cut: {}, cutSubTerritoryIds: [], factionId: republic, kind: "income", paid: amount(14) })).toBe("Republican Government's income from territories held whole: +14 Funds.");
    expect(describeSystemOutcome({ factionId: republic, kind: "build-completed", project: farms, subTerritoryId: sub("lleida") }, { scenario })).toBe("Republican Government raised Farms by a level at Lleida.");
    expect(line({ kind: "build-queued", order: { factionId: republic, kind: "build", project: farms, subTerritoryId: sub("girona") }, paid: amount(6), position: 2 })).toContain("; 2 ahead of it in the queue.");
    expect(line({ kind: "weather-rolled", turnNumber: 2, weather: { outcomes: {}, roll: 12 } })).toBe("Turn 2's weather was rolled.");
    expect(line({ ...{ aircraftLost: [], kind: "raid", order: bomber, roll: 15, subTerritoryId: sub("sevilla") } as const, result: "building-hit" })).toMatch(/: nothing worth hitting\.$/u);
  });

  it("reach the report through describeOutcome with the viewer and the board", () => {
    const forfeit: SystemOutcome = { kind: "build-forfeited", lost: amount(6), newHolder: south, previousHolder: republic, project: factory, subTerritoryId: sub("malaga") };
    expect(isSystemOutcome(forfeit)).toBe(true);
    expect(isSystemOutcome({ kind: "successful-move", order: move("republic", "rep-wad-ras-1", "madrid", "valencia") })).toBe(false);
    expect(describeOutcome(scenario, forfeit, [], { state, viewer: south })).not.toContain("Funds");
    expect(describeOutcome(scenario, forfeit, [], { viewer: republic })).toContain("6 Funds");
  });
});
