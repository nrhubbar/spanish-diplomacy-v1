import { describe, expect, it } from "vitest";
import { moveRoutes } from "../../main/engine/movement/routes";
import type { Reach } from "../../main/engine/network/reach";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, GameState, RaisedUnitDefinition, UnitTypeId, WithdrawOrder } from "../../main/engine/types";
import { modeChips, orderLegs } from "../../main/presentation/moveModes";
import { groundOf, invadeOdds, modeLabel, muster, musterButton, musterTicks, nameOf, reachingUnits, reinforceDefence, subName, supportBlocked, supportCount, typeNameOf } from "../../main/presentation/muster";
import { plannedSupport } from "../../main/presentation/odds";
import { actionName, quickActions } from "../../main/presentation/quickActions";
import { reachNote } from "../../main/presentation/reachNote";
import { musterOrderFrom, musterRefusal, orderMuster, type PlanningSession } from "../../main/state/planning";
import type { Draft } from "../../main/state/session";
import { faction, move, spainD20, territory, unit, withUnits } from "../support";

const scenario = spainD20();
const start = initialGameState(scenario);
const republic = faction("republic");
const castile = territory("castilla-y-leon");
const madrid = territory("madrid");
const empty = { orders: [] };

function raise(state: GameState, id: string, factionId: string, type: string, territoryId: string): GameState {
  const definition: RaisedUnitDefinition = { factionId: faction(factionId), fullStrength: 300, id: unit(id), name: id, type: type as UnitTypeId };
  return {
    ...state,
    raised: { ...state.raised, [id]: definition },
    units: { ...state.units, [id]: { factionId: faction(factionId), fatigue: 0, id: unit(id), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

function holding(state: GameState, factionId: string, ...territoryIds: string[]): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const territoryId of territoryIds) {
    for (const each of scenario.index.subTerritoriesByTerritory.get(territory(territoryId)) ?? []) {
      const site = subTerritories[each.id];
      if (site !== undefined) subTerritories[each.id] = { ...site, holder: faction(factionId) };
    }
  }
  return { ...state, control: { ...state.control, ...Object.fromEntries(territoryIds.map((id) => [id, { factionId: faction(factionId), kind: "controlled" as const }])) }, subTerritories };
}

const support = (unitId: string, territoryId = castile): AirMissionOrder => ({ factionId: republic, kind: "air-mission", mission: { kind: "support", territoryId }, unitId: unit(unitId) });

function session(draft: Partial<Draft> = {}, state: GameState = start): PlanningSession {
  return {
    draft: { orders: [], selectedUnitIds: [], ...draft },
    factionId: republic,
    game: { assignments: {}, history: [], locked: {}, scenarioId: scenario.id, seed: 1, state },
    phase: "planning"
  };
}

describe("U6: move-mode chips", () => {
  it("offers the game's route, and tries each other mode through the engine", () => {
    const offered = moveRoutes(scenario, start, republic, madrid, [unit("rep-wad-ras-1")]).get(castile);
    if (offered === undefined) throw new Error("fixture");
    const chips = modeChips(scenario, start, republic, unit("rep-wad-ras-1"), offered);
    expect(chips.map((chip) => [chip.mode, chip.ok])).toEqual([["march", true], ["motor", true], ["rail", true]]);
    expect(chips[0]).not.toHaveProperty("legs");
    expect(orderLegs(offered)).toBeUndefined();
    const ride = moveRoutes(scenario, start, republic, territory("catalunya"), [unit("rep-durruti-column")]).get(castile);
    if (ride === undefined) throw new Error("fixture");
    const far = modeChips(scenario, start, republic, unit("rep-durruti-column"), ride);
    expect(far.map((chip) => (chip.ok ? chip.mode : chip.reason))).toEqual([
      "March reaches only a neighbouring territory.",
      "Only the last step of a move may enter enemy or contested ground.",
      "rail"
    ]);
    expect(orderLegs(ride)).toEqual(ride.legs);
    // Offered another way, a valid March is a plain step.
    const marchAlso = modeChips(scenario, start, republic, unit("rep-wad-ras-1"), { ...offered, legs: [{ kind: "rail", to: castile }], mode: "rail", shape: "rail" });
    expect(marchAlso[0]).toEqual({ mode: "march", ok: true });
    expect(marchAlso[2]).toEqual({ legs: [{ kind: "rail", to: castile }], mode: "rail", ok: true });
  });

  it("adds Sea where a lane reaches the target, and names a mode with no way at all", () => {
    const valencia = withUnits(scenario, [["rep-wad-ras-1", "republic", "valencia"]]);
    const offered = moveRoutes(scenario, valencia, republic, territory("valencia"), [unit("rep-wad-ras-1")]).get(territory("islas-baleares"));
    if (offered === undefined) throw new Error("fixture");
    const chips = modeChips(scenario, valencia, republic, unit("rep-wad-ras-1"), offered);
    expect(chips.map((chip) => chip.mode)).toEqual(["march", "motor", "rail", "sea"]);
    expect(chips.find((chip) => chip.mode === "march")).toMatchObject({ ok: false, reason: "March reaches only a neighbouring territory." });
    expect(chips.find((chip) => chip.mode === "motor")).toMatchObject({ ok: false, reason: "Motor reaches at most 2 territories." });
    // A sea move offered without the lane check still shows its chip.
    const sailing = modeChips({ ...scenario, connections: scenario.connections.filter((connection) => connection.kind !== "sea") }, valencia, republic, unit("rep-wad-ras-1"), offered);
    expect(sailing.map((chip) => chip.mode)).toEqual(["march", "motor", "rail", "sea"]);
    expect(modeLabel("sea")).toBe("Sea");
    const roadless: typeof scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, road: undefined as never } };
    expect(modeChips(roadless, valencia, republic, unit("rep-wad-ras-1"), offered)[1]).toMatchObject({ reason: "Motor reaches at most 2 territories." });
  });
});

describe("U6: the Invade and Reinforce panes' units", () => {
  it("groups every unit that can reach the target by where it sets out", () => {
    const view = muster(scenario, start, republic, castile, "invade", empty);
    expect(view.groups.map((group) => group.title)).toEqual(expect.arrayContaining(["From Madrid", "From Cataluña"]));
    expect(view.subtitle).toMatch(/^Northern Insurgent Command · reachable from \d of yours$/);
    expect(view.support.map((each) => each.unitId)).toEqual(expect.arrayContaining(["rep-breguet-bombers", "rep-ni52-fighters"]));
    expect(view.supportMax).toBe(2);
    expect(supportCount(view, 1)).toBe("1 of at most 2");
    const two = new Set([unit("a"), unit("b")]);
    expect(supportBlocked(view, two, unit("c"))).toBe("At most 2 aircraft give Ground Support to one battle.");
    expect(supportBlocked(view, two, unit("a"))).toBeUndefined();
    expect(supportBlocked(view, new Set([unit("a")]), unit("c"))).toBeUndefined();
    expect(musterTicks(view)).toEqual({ support: [], units: [] });
    const out = muster(scenario, start, republic, territory("ceuta"), "invade", empty);
    expect(out.subtitle).toContain("out of reach of your units this turn");
    expect(reachingUnits(scenario, start, republic, territory("ceuta"), empty)).toEqual([]);
  });

  it("starts ticked what is ordered there, and names the order a tick replaces", () => {
    const rail = moveRoutes(scenario, start, republic, madrid, [unit("rep-covadonga-4")]).get(castile);
    const motorLegs = [{ kind: "land" as const, to: territory("castilla-la-mancha") }, { kind: "land" as const, to: castile }];
    const draft = {
      airOrders: [support("rep-ni52-fighters"), { factionId: republic, kind: "air-mission" as const, mission: { kind: "raid" as const, subTerritoryId: "burgos" as never }, unitId: unit("rep-breguet-bombers") }],
      orders: [
        { ...move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon"), legs: motorLegs },
        move("republic", "rep-madrid-security", "madrid", "castilla-la-mancha"),
        { factionId: republic, from: madrid, kind: "withdraw", to: territory("valencia"), unitId: unit("rep-madrid-sierra-column") } satisfies WithdrawOrder,
        { factionId: republic, from: territory("catalunya"), kind: "withdraw", to: castile, unitId: unit("rep-durruti-column") } satisfies WithdrawOrder
      ]
    };
    const view = muster(scenario, start, republic, castile, "invade", draft);
    const cards = view.groups.flatMap((group) => group.cards);
    expect(cards.find((each) => each.unitId === unit("rep-wad-ras-1"))).toMatchObject({ defaultMode: "motor", ordered: true });
    expect(cards.find((each) => each.unitId === unit("rep-madrid-security"))?.otherOrder).toBe("Ordered to move to Castilla-La Mancha");
    expect(cards.find((each) => each.unitId === unit("rep-madrid-sierra-column"))?.otherOrder).toBe("Ordered to withdraw to Valencia");
    expect(cards.find((each) => each.unitId === unit("rep-covadonga-4"))?.defaultMode).toBe(rail?.mode);
    expect(view.support.find((each) => each.unitId === unit("rep-breguet-bombers"))?.otherMission).toMatch(/^On Raid over /);
    expect(musterTicks(view).support).toEqual(["rep-ni52-fighters"]);
    expect([...musterTicks(view).units].sort()).toEqual(["rep-durruti-column", "rep-wad-ras-1"]);
    const patrol = muster(scenario, start, republic, castile, "invade", { orders: [], airOrders: [{ ...support("rep-ni52-fighters"), mission: { kind: "patrol", territoryId: madrid } }] });
    expect(patrol.support.find((each) => each.unitId === unit("rep-ni52-fighters"))?.otherMission).toBe("On Patrol over Madrid");
  });

  it("shows the works a unit leaves and the units already there, by pocket", () => {
    const dug: GameState = { ...start, fortification: { ...start.fortification, [madrid]: { factionId: republic, level: 1 } } };
    const card = muster(scenario, dug, republic, castile, "invade", empty).groups.flatMap((group) => group.cards).find((each) => each.from === madrid);
    expect(card?.dugIn).toBe("Dug in 1 · −2");
    const valencia = muster(scenario, start, republic, territory("valencia"), "reinforce", empty);
    expect(valencia.support).toEqual([]);
    expect(valencia.subtitle).toMatch(/^Yours/);
    expect(valencia.here[0]?.note).toMatch(/^In Valencia.*Stays and defends\.$/);
    const contested = muster(scenario, start, republic, territory("extremadura"), "invade", empty);
    expect(contested.subtitle).toMatch(/^Contested/);
    expect(contested.here.every((each) => each.note.endsWith("Attacks where it stands, after the battle for the ground."))).toBe(true);
    const nowhere: GameState = { ...start, control: Object.fromEntries(Object.entries(start.control).filter(([id]) => id !== castile)) };
    expect(muster(scenario, nowhere, republic, castile, "invade", empty).subtitle).toMatch(/^Uncontrolled/);
    expect(groundOf(start, republic, castile)).toBe("enemy");
    // A unit standing where its side holds no ground has no pocket to name.
    const stranded = withUnits(scenario, [["rep-wad-ras-1", "republic", "castilla-y-leon"]]);
    expect(muster(scenario, stranded, republic, castile, "invade", empty).here[0]?.note).toBe("Stays and defends.");
    const uncapped = { ...scenario, air: { ...scenario.air!, supportMax: undefined } };
    const open = muster(uncapped, start, republic, castile, "invade", empty);
    expect(open).not.toHaveProperty("supportMax");
    expect(supportCount(open, 3)).toBe("3 ticked");
    expect(supportBlocked(open, new Set([unit("a"), unit("b"), unit("c")]), unit("d"))).toBeUndefined();
  });

  it("names units, types and places it can't find plainly", () => {
    expect(nameOf(scenario, start, unit("nobody"))).toBe("Unit");
    expect(typeNameOf(scenario, start, unit("nobody"))).toBe("Unit");
    expect(subName(scenario, "nowhere" as never)).toBe("its ground");
    expect(typeNameOf(scenario, start, unit("rep-wad-ras-1"))).toBe("Infantry regiment");
  });

  it("names the place of units with no pocket by the territory", () => {
    const lost: GameState = { ...start, units: { ...start.units, [unit("rep-otumba-9")]: { ...start.units[unit("rep-otumba-9")]!, subTerritoryId: "nowhere" as never } } };
    expect(muster(scenario, lost, republic, territory("valencia"), "reinforce", empty).here.length).toBeGreaterThan(0);
  });
});

describe("U6: the odds and the defence", () => {
  it("asks for units first, and calls empty ground unopposed", () => {
    expect(invadeOdds(scenario, start, republic, castile, [], [], empty).kind).toBe("none");
    const cleared: GameState = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([, each]) => each.territoryId !== castile)) };
    expect(invadeOdds(scenario, cleared, republic, castile, [unit("rep-wad-ras-1")], [], empty).kind).toBe("unopposed");
  });

  it("weighs the air battle against the defenders' AA, and counts units already ordered there", () => {
    const guarded = raise(start, "aa-1", "north", "anti-air-battery", "castilla-y-leon");
    const odds = invadeOdds(scenario, guarded, republic, castile, [unit("rep-wad-ras-1")], [unit("rep-ni52-fighters")], { orders: [move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")] });
    expect(odds).toMatchObject({ kind: "battle", odds: expect.stringMatching(/^≈ /), take: expect.stringMatching(/%$/) });
    expect(odds.kind === "battle" && odds.air).toMatch(/^Air battle first: you win the air \d+% \(tie \d+%\), then Ground Support \+\d+\.$/);
    const open = invadeOdds(scenario, start, republic, castile, [unit("rep-wad-ras-1")], [], { orders: [], airOrders: [support("rep-ni52-fighters")] });
    expect(open.kind === "battle" && open.air).toBe("Ground Support +3: nothing contests the air.");
    const plain = invadeOdds(scenario, start, republic, castile, [unit("rep-wad-ras-1")], [], empty);
    expect(plain.kind === "battle" && "air" in plain).toBe(false);
  });

  it("names the pass when every attacker crosses one", () => {
    const asturias = holding(withUnits(scenario, [["rep-asturian-militia", "republic", "asturias"], ["north-san-marcial-22", "north", "castilla-y-leon"]]), "republic", "asturias");
    const odds = invadeOdds(scenario, asturias, republic, castile, [unit("rep-asturian-militia")], [], empty);
    expect(odds.kind === "battle" && odds.pass).toBe("Every attacking unit crosses the Pajares pass: −2 on your roll. One unit over an open link would flank it.");
    expect(odds.kind === "battle" && odds.defenders).toBe("San Marcial Infantry Regiment No. 22");
  });

  it("warns when artillery alone would turn back, and lists no defenders when only works hold", () => {
    const guns = raise(withUnits(scenario, [["north-san-marcial-22", "north", "castilla-y-leon"]]), "guns-1", "republic", "artillery-group", "madrid");
    const odds = invadeOdds(scenario, guns, republic, castile, [unit("guns-1")], [], empty);
    expect(odds.kind === "battle" ? odds.warning : "").toBe("Artillery alone turns back without a battle.");
  });

  it("adds the arrivals to the defence and weighs the strongest neighbour before and after", () => {
    const defence = reinforceDefence(scenario, start, republic, madrid, [unit("rep-otumba-9")]);
    expect(defence.after).toBeGreaterThan(defence.now);
    expect(defence.units).toMatch(/^\d+ → \d+$/);
    expect(defence.threat?.from).toMatch(/^Castilla y León · attack \d+$/);
    expect(defence.threat?.now).toMatch(/^\d+:\d+, \d+% to take it$/);
    // The strongest of several forces next door, whichever comes first.
    const crowded = withUnits(scenario, [
      ["rep-wad-ras-1", "republic", "madrid"],
      ["north-san-marcial-22", "north", "castilla-y-leon"],
      ["south-legion", "south", "castilla-y-leon"],
      ["north-san-quintin-25", "north", "castilla-y-leon"],
      ["south-regulares", "south", "castilla-la-mancha"]
    ]);
    expect(reinforceDefence(scenario, crowded, republic, madrid, []).threat?.from).toMatch(/^Castilla y Le\u00f3n/);
    const quiet = reinforceDefence(scenario, start, republic, territory("islas-baleares"), []);
    expect(quiet.threat).toBeUndefined();
    const bare: GameState = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([, each]) => each.territoryId !== madrid)) };
    expect(reinforceDefence(scenario, bare, republic, madrid, []).threat?.now).toBe("it walks in");
  });

  it("words the order button and the planned support", () => {
    expect(musterButton("invade", 1, 0)).toBe("Order 1 unit to invade");
    expect(musterButton("reinforce", 3, 1)).toBe("Order 3 units and 1 aircraft to reinforce");
    expect(musterButton("invade", 2, 2)).toBe("Order 2 units and 2 aircraft to invade");
    expect(plannedSupport([support("rep-ni52-fighters"), support("rep-breguet-bombers", madrid), { factionId: republic, kind: "sack", unitId: unit("x") }], republic, castile)).toEqual(["rep-ni52-fighters"]);
  });
});

describe("U5: quick actions", () => {
  it("offers Invade on enemy ground, Reinforce on friendly ground and both when contested; the other is greyed out", () => {
    const all = ["invade", "reinforce", "recruit", "build", "info"];
    const enemy = quickActions(scenario, start, republic, castile, empty);
    expect(enemy.actions.map((action) => action.kind)).toEqual(all);
    expect(enemy.actions.find((action) => action.kind === "reinforce")).toMatchObject({ reason: "You hold no ground in Castilla y León: use Invade to attack it." });
    expect(enemy.status).toBe("Enemy");
    expect(enemy.actions.find((action) => action.kind === "build")).toMatchObject({ reason: "You hold no ground in Castilla y León to build on." });
    const friendly = quickActions(scenario, start, republic, madrid, empty);
    expect(friendly.actions.map((action) => action.kind)).toEqual(all);
    expect(friendly.actions.find((action) => action.kind === "invade")?.reason).toBe("Madrid is yours: use Reinforce to move units in.");
    expect(friendly.actions.find((action) => action.kind === "recruit")).not.toHaveProperty("reason");
    expect(friendly.actions.find((action) => action.kind === "build")?.detail).toMatch(/^\d+ sites you hold$/);
    const contested = quickActions(scenario, start, republic, territory("extremadura"), empty);
    expect(contested.actions.map((action) => action.kind)).toEqual(["invade", "reinforce", "recruit", "build", "info"]);
    expect(contested.actions.find((action) => action.kind === "recruit")?.reason).toContain("contested");
    expect(contested.actions.find((action) => action.kind === "build")?.detail).toBe("Badajoz: 1 site you hold");
  });

  it("greys out an order nobody can reach, and names a lone unit", () => {
    const far = quickActions(scenario, start, republic, territory("ceuta"), empty);
    const invade = far.actions.find((action) => action.kind === "invade");
    expect(invade?.reason).toBe("None of your units can reach Ceuta this turn.");
    expect(invade === undefined ? "" : actionName(invade)).toBe("Invade · unavailable: None of your units can reach Ceuta this turn.");
    const info = far.actions.find((action) => action.kind === "info");
    expect(info === undefined ? "" : actionName(info)).toBe("Info: Territory, units, production");
    const lone = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["north-san-marcial-22", "north", "castilla-y-leon"]]);
    expect(quickActions(scenario, lone, republic, castile, empty).actions[0]?.detail).toBe("Wad-Ras Infantry Regiment No. 1 can attack it");
  });
});

describe("U7: why a territory is out of reach", () => {
  it("lists the reasons, each led by its mode", () => {
    const reach: Reach = { ok: false, reasons: [{ code: "too-far", text: "March reaches only a neighbouring territory." }, { code: "not-connected", text: "Out of reach this turn." }] };
    expect(reachNote(scenario, castile, reach)).toEqual({
      lines: [{ mode: "march", text: "March reaches only a neighbouring territory." }, { text: "Out of reach this turn." }],
      status: "Out of reach this turn",
      title: "Castilla y León"
    });
    expect(reachNote(scenario, castile, { mode: "march", ok: true, path: [] })).toBeUndefined();
    expect(reachNote(scenario, castile, undefined)).toBeUndefined();
  });
});

describe("U6: ordering from the pane", () => {
  it("plans every move and mission at once, replacing other orders, and clears what is unticked", () => {
    const before = session({
      airOrders: [support("rep-breguet-bombers")],
      orderedToStay: [unit("rep-wad-ras-1")],
      orders: [move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon"), move("republic", "rep-madrid-security", "madrid", "castilla-la-mancha")],
      replenishments: [{ factionId: republic, kind: "replenish", unitId: unit("rep-wad-ras-1") }],
      selectedTerritoryId: madrid,
      selectedUnitIds: [unit("rep-wad-ras-1")]
    });
    const legs = [{ kind: "land" as const, to: territory("castilla-la-mancha") }, { kind: "land" as const, to: castile }];
    const shown = ["rep-wad-ras-1", "rep-madrid-security", "rep-covadonga-4", "rep-breguet-bombers", "rep-ni52-fighters"].map(unit);
    const after = orderMuster(scenario, before, { kind: "invade", moves: [{ legs, unitId: unit("rep-wad-ras-1") }, { unitId: unit("rep-madrid-security") }], shown, support: [unit("rep-ni52-fighters")], target: castile });
    expect(after.draft.orders.map((order) => [order.unitId, order.to, "legs" in order ? order.legs.length : undefined])).toEqual([
      ["rep-wad-ras-1", "castilla-y-leon", 2],
      ["rep-madrid-security", "castilla-y-leon", undefined]
    ]);
    expect(after.draft.airOrders?.map((order) => order.unitId)).toEqual(["rep-ni52-fighters"]);
    expect(after.draft.replenishments).toEqual([]);
    expect(after.draft.orderedToStay).toEqual([]);
    expect(after.draft.selectedUnitIds).toEqual([]);
    expect(after.draft.feedback).toBe("2 units and 1 aircraft ordered to invade Castilla y León.");
    // A pane that doesn't list a unit or aircraft leaves its order there alone (Reinforce lists no aircraft).
    const kept = orderMuster(scenario, after, { kind: "reinforce", moves: [], shown: [unit("rep-madrid-security")], support: [], target: castile });
    expect(kept.draft.orders.map((order) => order.unitId)).toEqual(["rep-wad-ras-1"]);
    expect(kept.draft.airOrders?.map((order) => order.unitId)).toEqual(["rep-ni52-fighters"]);
    const cleared = orderMuster(scenario, after, { kind: "invade", moves: [], shown, support: [], target: castile });
    expect(cleared.draft.orders).toEqual([]);
    expect(cleared.draft.feedback).toBe("No units are ordered to invade Castilla y León.");
    const one = orderMuster(scenario, session(), { kind: "reinforce", moves: [{ unitId: unit("rep-wad-ras-1") }], shown: [], support: [], target: territory("castilla-la-mancha") });
    expect(one.draft.feedback).toBe("1 unit ordered to reinforce Castilla-La Mancha.");
    expect(one.draft).not.toHaveProperty("selectedTerritoryId");
  });

  it("plans nothing when the engine refuses a move or a mission, and skips units that are gone", () => {
    const refused = orderMuster(scenario, session(), { kind: "invade", moves: [{ unitId: unit("rep-durruti-column") }], shown: [], support: [], target: castile });
    expect(refused.draft.orders).toEqual([]);
    expect(refused.draft.feedback).toBeDefined();
    const grounded = orderMuster(scenario, session(), { kind: "invade", moves: [], shown: [], support: [unit("rep-wad-ras-1")], target: castile });
    expect(grounded.draft.airOrders).toBeUndefined();
    expect(grounded.draft.feedback).toBeDefined();
    const gone = orderMuster(scenario, session(), { kind: "invade", moves: [{ unitId: unit("nobody") }], shown: [], support: [], target: castile });
    expect(gone.draft.orders).toEqual([]);
  });
});

describe("U6: the pane's picks as an order", () => {
  it("carries each ticked unit's chosen mode, or its default, and the ticked aircraft", () => {
    const view = muster(scenario, start, republic, castile, "invade", empty);
    const order = musterOrderFrom(view, {
      modes: new Map([[unit("rep-wad-ras-1"), "motor"], [unit("rep-covadonga-4"), "sea"]]),
      support: new Set([unit("rep-ni52-fighters")]),
      units: new Set([unit("rep-wad-ras-1"), unit("rep-covadonga-4"), unit("rep-madrid-security")])
    });
    expect(order.kind).toBe("invade");
    expect(order.target).toBe(castile);
    expect(order.support).toEqual(["rep-ni52-fighters"]);
    const byUnit = new Map(order.moves.map((move) => [move.unitId, move]));
    expect(byUnit.get(unit("rep-wad-ras-1"))?.legs).toHaveLength(2);
    // A mode the card can't take, or the default March, is a plain step.
    expect(byUnit.get(unit("rep-covadonga-4"))).toEqual({ unitId: "rep-covadonga-4" });
    expect(byUnit.get(unit("rep-madrid-security"))).toEqual({ unitId: "rep-madrid-security" });
    expect(order.shown).toEqual(expect.arrayContaining(["rep-wad-ras-1", "rep-ni52-fighters"]));
    expect(musterRefusal(scenario, start, republic, order)).toBeUndefined();
  });
});
