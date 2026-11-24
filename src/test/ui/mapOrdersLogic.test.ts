import { describe, expect, it } from "vitest";
import { unitKindIn } from "../../main/engine/air/pieces";
import { estimateAttack } from "../../main/engine/combat";
import { type MoveRoute, moveRoutes } from "../../main/engine/movement/routes";
import { routesOfMoves } from "../../main/engine/movement/transit";
import { linkBetween, passName } from "../../main/engine/network/links";
import type { Reach } from "../../main/engine/network/reach";
import { initialGameState } from "../../main/engine/resolution";
import type { AirMissionOrder, GameState, RaisedUnitDefinition, TerritoryId, UnitId, UnitTypeId, WithdrawOrder } from "../../main/engine/types";
import { glows } from "../../main/map/view";
import { modeChips, orderLegs } from "../../main/presentation/moveModes";
import { defendersCount, groundOf, groupModes, type InvadeOdds, invadeOdds, modeLabel, muster, musterButton, type MusterCard, type MusterDraft, nameOf, reachingUnits, reinforceDefence, subName, supportBlocked, supportCount, typeNameOf } from "../../main/presentation/muster";
import { plannedSupport } from "../../main/presentation/odds";
import { actionName, quickActions } from "../../main/presentation/quickActions";
import { reachNote } from "../../main/presentation/reachNote";
import { musterOrderFrom, musterPicks, musterRefusal, orderMuster, type PlanningSession, planningMapView, tickedOnMap } from "../../main/state/planning";
import { type MusterChoices, noMusterChoices } from "../../main/state/paneSlice";
import type { Draft } from "../../main/state/session";
import { faction, move, spainWithAir, territory, unit, withUnits } from "../support";

const scenario = spainWithAir();
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

/** What the pane starts with ticked for a draft. */
function picksOf(draft: MusterDraft, choices = noMusterChoices): { readonly support: readonly UnitId[]; readonly units: readonly UnitId[] } {
  const picks = musterPicks(scenario, session({ airOrders: draft.airOrders ?? [], orders: [...draft.orders] }), castile, choices);
  return { support: [...picks.support], units: [...picks.units] };
}

describe("U6: what the Invade pane has ticked", () => {
  const ordered: MusterDraft = { airOrders: [support("rep-ni52-fighters")], orders: [move("republic", "rep-wad-ras-1", "madrid", "castilla-y-leon")] };
  const changes = { modes: {}, ticks: { [unit("rep-wad-ras-1")]: false, [unit("rep-covadonga-4")]: true, [unit("rep-breguet-bombers")]: true } };
  it("changes what is ordered there by the player's ticks, units and aircraft apart", () => {
    expect(picksOf(ordered)).toEqual({ support: ["rep-ni52-fighters"], units: ["rep-wad-ras-1"] });
    expect(picksOf(ordered, changes)).toEqual({ support: ["rep-ni52-fighters", "rep-breguet-bombers"], units: ["rep-covadonga-4"] });
  });

  it("marks them on the map while the pane is shown, aircraft only on Invade", () => {
    const planning = session({ airOrders: [...(ordered.airOrders ?? [])], orders: [...ordered.orders] });
    expect([...tickedOnMap(scenario, planning, { kind: "invade", target: castile }, noMusterChoices)]).toEqual(["rep-wad-ras-1", "rep-ni52-fighters"]);
    expect([...tickedOnMap(scenario, planning, { kind: "reinforce", target: castile }, noMusterChoices)]).toEqual(["rep-wad-ras-1"]);
    expect(tickedOnMap(scenario, planning, { kind: "thisTurn" }, changes).size).toBe(0);
    // A tick the pane no longer lists (gone, out of reach, another side's, no mission there) orders nothing.
    const unlisted = { modes: {}, ticks: { [unit("nobody")]: true, [unit("rep-madrid-security")]: true, [unit("north-san-marcial-22")]: true } };
    const stale: PlanningSession = { ...planning, draft: { ...planning.draft, airOrders: [support("rep-ni52-fighters"), support("rep-gone-fighters")], orders: [...planning.draft.orders, move("republic", "rep-gone", "madrid", "castilla-y-leon")] } };
    expect([...tickedOnMap(scenario, stale, { kind: "invade", target: castile }, unlisted)].sort()).toEqual(["rep-madrid-security", "rep-ni52-fighters", "rep-wad-ras-1"]);
    const ticked = tickedOnMap(scenario, planning, { kind: "invade", target: castile }, noMusterChoices);
    expect(planningMapView(scenario, planning, [], new Map(), ticked).tickedUnitIds).toBe(ticked);
    expect(planningMapView(scenario, planning, [], new Map())).not.toHaveProperty("tickedUnitIds");
    expect(glows({ selectedUnitIds: new Set(), tickedUnitIds: ticked }, unit("rep-wad-ras-1"))).toBe(true);
    expect(glows({ selectedUnitIds: new Set([unit("x")]) }, unit("x"))).toBe(true);
    expect(glows({ selectedUnitIds: new Set() }, unit("x"))).toBe(false);
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
    expect(picksOf(empty)).toEqual({ support: [], units: [] });
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
    expect(picksOf(draft).support).toEqual(["rep-ni52-fighters"]);
    expect([...picksOf(draft).units].sort()).toEqual(["rep-durruti-column", "rep-wad-ras-1"]);
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

describe("U6: one line for the modes a group can't take", () => {
  const cardWith = (name: string, modes: MusterCard["modes"]): MusterCard => ({ defaultMode: "rail", from: madrid, men: "1/1 men", modes, name, ordered: false, share: 1, unitId: unit(name), values: "1-1" });
  const rail = { mode: "rail" as const, ok: true as const };
  const noMarch = { mode: "march" as const, ok: false as const, reason: "Too far." };
  it("says what reaches it once, and names the units only when a reason isn't every unit's", () => {
    expect(groupModes([cardWith("One", [rail])])).toBeUndefined();
    expect(groupModes([cardWith("One", [noMarch, rail]), cardWith("Two", [noMarch, rail])])).toEqual({ only: "Only Rail reaches it.", question: "Why not March?", reasons: ["March: Too far."] });
    const mixed = groupModes([cardWith("One", [noMarch, { mode: "motor", ok: false, reason: "No trucks." }, rail]), cardWith("Two", [{ mode: "march", ok: true }, rail])]);
    expect(mixed).toEqual({ question: "Why not March or Motor?", reasons: ["March: Too far. (One)", "Motor: No trucks. (One)"] });
  });

  it("counts defenders as units, whatever their names hold", () => {
    const there = Object.values(start.units).filter((each) => each.territoryId === castile && unitKindIn(scenario, start.raised, each.id) === "ground");
    const view = muster(scenario, start, republic, castile, "invade", empty);
    expect(view.defenders.cards.map((each) => each.unitId).sort()).toEqual(there.map((each) => each.id).sort());
    expect(there.length).toBeGreaterThan(1);
    expect(defendersCount({ cards: view.defenders.cards.slice(0, 1), defence: 4 })).toBe("1 unit, 4 defence");
    expect(defendersCount({ cards: view.defenders.cards.slice(0, 2), defence: 9 })).toBe("2 units, 9 defence");
    expect(muster(scenario, start, republic, castile, "reinforce", empty).defenders).toEqual({ cards: [], defence: 0 });
  });
});

/** The militia of Asturias, with more of its side's units beside it, and a defender beyond the Pajares pass. */
function overThePass(...beside: readonly string[]): GameState {
  return holding(withUnits(scenario, [...["rep-asturian-militia", ...beside].map((id): [string, string, string] => [id, "republic", "asturias"]), ["north-san-marcial-22", "north", "castilla-y-leon"]]), "republic", "asturias");
}

/** The Invade pane's odds for the units ticked, each with its chosen mode, as the pane works them out. */
function paneOdds(state: GameState, target: TerritoryId, modes: MusterChoices["modes"]): Extract<InvadeOdds, { readonly kind: "battle" }> {
  const picks = musterPicks(scenario, session({}, state), target, { modes, ticks: Object.fromEntries(Object.keys(modes).map((id) => [id, true])) });
  const order = musterOrderFrom(muster(scenario, state, republic, target, "invade", empty), picks);
  const odds = invadeOdds(scenario, state, republic, target, order.moves, order.support, empty);
  if (odds.kind !== "battle") throw new Error("Expected a battle.");
  return odds;
}

describe("U6: the odds and the defence", () => {
  it("asks for units first, and calls empty ground unopposed", () => {
    expect(invadeOdds(scenario, start, republic, castile, [], [], empty).kind).toBe("none");
    const cleared: GameState = { ...start, units: Object.fromEntries(Object.entries(start.units).filter(([, each]) => each.territoryId !== castile)) };
    expect(invadeOdds(scenario, cleared, republic, castile, [{ unitId: unit("rep-wad-ras-1") }], [], empty).kind).toBe("unopposed");
  });

  it("weighs the air battle against the defenders' AA, and counts units already ordered there", () => {
    const guarded = raise(start, "aa-1", "north", "anti-air-battery", "castilla-y-leon");
    const odds = invadeOdds(scenario, guarded, republic, castile, [{ unitId: unit("rep-wad-ras-1") }], [unit("rep-ni52-fighters")], { orders: [move("republic", "rep-covadonga-4", "madrid", "castilla-y-leon")] });
    expect(odds).toMatchObject({ kind: "battle", odds: expect.stringMatching(/^≈ /), take: expect.stringMatching(/%$/) });
    expect(odds.kind === "battle" && odds.air).toMatch(/^Air battle first: you win the air \d+% \(tie \d+%\), then Ground Support \+\d+\.$/);
    const open = invadeOdds(scenario, start, republic, castile, [{ unitId: unit("rep-wad-ras-1") }], [], { orders: [], airOrders: [support("rep-ni52-fighters")] });
    expect(open.kind === "battle" && "air" in open).toBe(false);
    expect(open.kind === "battle" && open.ledger.rows).toContainEqual({ label: "Ground Support, 1 aircraft", value: 3 });
    const plain = invadeOdds(scenario, start, republic, castile, [{ unitId: unit("rep-wad-ras-1") }], [], empty);
    expect(plain.kind === "battle" && "air" in plain).toBe(false);
  });

  it("names the pass when every attacker crosses one", () => {
    const asturias = holding(withUnits(scenario, [["rep-asturian-militia", "republic", "asturias"], ["north-san-marcial-22", "north", "castilla-y-leon"]]), "republic", "asturias");
    const odds = invadeOdds(scenario, asturias, republic, castile, [{ unitId: unit("rep-asturian-militia") }], [], empty);
    expect(odds.kind === "battle" && odds.ledger.rows).toContainEqual({ label: "Pajares pass, crossed by every unit", value: -2 });
    expect(odds.kind === "battle" && odds.defenders).toBe("1 unit");
  });

  it("judges the pass on the way each unit is to travel, and the ledger sums to the engine's roll", () => {
    const asturias = holding(withUnits(scenario, [["rep-asturian-militia", "republic", "asturias"], ["north-san-marcial-22", "north", "castilla-y-leon"]]), "republic", "asturias");
    const militia = unit("rep-asturian-militia");
    const offered = moveRoutes(scenario, asturias, republic, territory("asturias"), [militia]).get(castile);
    if (offered === undefined) throw new Error("Expected a route over the pass.");
    const kinds = (planned?: MoveRoute): readonly string[] => {
      const estimate = estimateAttack(scenario, asturias, republic, [militia], castile, [], planned === undefined ? undefined : new Map([[militia, planned]]));
      return estimate.kind === "battle" ? estimate.modifiers.map((each) => each.kind) : [];
    };
    const sailed = { ...offered, path: offered.path.map((step) => ({ ...step, mode: "sea" as const })) };
    // With no way chosen, a March over the pass is inferred; a chosen way by sea misses it, and one to another territory is neither.
    expect(kinds()).toContain("pass");
    expect(kinds(offered)).toContain("pass");
    expect(kinds(sailed)).not.toContain("pass");
    expect(kinds({ ...offered, to: madrid })).not.toContain("pass");
    expect(kinds({ ...offered, sea: { kind: "amphibious" } as never })).toContain("amphibious");
    const odds = invadeOdds(scenario, asturias, republic, castile, [{ unitId: militia }], [], empty);
    const estimate = estimateAttack(scenario, asturias, republic, [militia], castile);
    const ledger = odds.kind === "battle" ? odds.ledger : undefined;
    expect(ledger?.total).toBe(estimate.kind === "battle" ? estimate.rollModifier : undefined);
    expect(ledger?.total).toBe(ledger?.rows.reduce((sum, row) => sum + row.value, 0));
    // A move with no route has no entry, so its way is inferred.
    const order = { ...move("republic", "rep-asturian-militia", "asturias", "castilla-y-leon") };
    expect([...routesOfMoves(scenario, asturias, [order]).keys()]).toEqual([militia]);
    expect(routesOfMoves(scenario, asturias, [{ ...order, legs: [{ kind: "rail", to: territory("murcia") }], to: territory("murcia") }]).size).toBe(0);
    // Units that are gone are left out.
    expect(invadeOdds(scenario, asturias, republic, castile, [{ unitId: unit("nobody") }], [], empty).kind).toBe("none");
  });

  it("changes the estimate by the way a ticked unit travels: over a pass, or by rail through it", () => {
    const infantry = ["rep-wad-ras-1", "rep-covadonga-4", "rep-otumba-9"];
    const state = overThePass(...infantry);
    const ids = ["rep-asturian-militia", ...infantry].map(unit);
    const sent = (mode: "march" | "rail") => paneOdds(state, castile, Object.fromEntries(ids.map((id) => [id, mode])));
    const over = sent("march");
    const through = sent("rail");
    const pass = { label: "Pajares pass, crossed by every unit", value: -2 };
    expect(over.ledger.rows).toContainEqual(pass);
    expect(through.ledger.rows).not.toContainEqual(pass);
    expect(over.ledger.total).toBe(through.ledger.total - 2);
    expect(over.take).not.toBe(through.take);
    // One ticked unit that goes by rail takes the pass away from the attack.
    expect(paneOdds(state, castile, { ...Object.fromEntries(ids.map((id) => [id, "march"])), [unit("rep-wad-ras-1")]: "rail" }).ledger.rows).not.toContainEqual(pass);
  });

  it("changes the estimate by a ticked unit that lands from the sea against a defended shore", () => {
    const baleares = territory("islas-baleares");
    const otumba = unit("rep-otumba-9");
    const state = holding(holding(withUnits(scenario, [["rep-otumba-9", "republic", "valencia"], ["north-san-marcial-22", "north", "islas-baleares"]]), "republic", "valencia"), "north", "islas-baleares");
    const odds = paneOdds(state, baleares, { [otumba]: "sea" });
    expect(odds.ledger.rows).toContainEqual({ label: "Amphibious assault", value: -4 });
    const route = routesOfMoves(scenario, state, [move("republic", "rep-otumba-9", "valencia", "islas-baleares")]).get(otumba);
    if (route === undefined) throw new Error("Expected a sea route.");
    expect(route.sea?.kind).toBe("amphibious");
    const ashore = { ...route };
    delete (ashore as { sea?: unknown }).sea;
    const unlanded = estimateAttack(scenario, state, republic, [otumba], baleares, [], new Map([[otumba, ashore]]));
    expect(odds.ledger.total).toBe(unlanded.kind === "battle" ? unlanded.rollModifier - 4 : undefined);
  });

  it("drops the pass for a unit the pane sends by a way that misses it", () => {
    // Each attacker and way that crosses no pass, found from the shipped map: the pane's ledger agrees with the route.
    let crossing = 0;
    let missing = 0;
    // The opening, and the militia of Asturias, which a March takes over the Pajares pass.
    for (const [state, target] of [start, overThePass()].flatMap((each) => scenario.territories.map(({ id }) => [each, id] as const))) {
      const view = muster(scenario, state, republic, target, "invade", empty);
      for (const card of view.groups.flatMap((group) => group.cards)) {
        for (const chip of card.modes) {
          if (!chip.ok) continue;
          const odds = invadeOdds(scenario, state, republic, target, [{ ...(chip.legs === undefined ? {} : { legs: chip.legs }), unitId: card.unitId }], [], empty);
          if (odds.kind !== "battle") continue;
          const route = routesOfMoves(scenario, state, [{ factionId: republic, from: card.from, kind: "move", ...(chip.legs === undefined ? {} : { legs: chip.legs }), to: target, unitId: card.unitId }]).get(card.unitId);
          const step = route?.path.findLast((each) => scenario.index.subTerritories.get(each.to)?.territoryId === target);
          const link = step === undefined || step.mode === "sea" ? undefined : linkBetween(scenario, step.from, step.to);
          const entersByPass = step !== undefined && scenario.index.subTerritories.get(step.from)?.territoryId !== target && link !== undefined && passName(link) !== undefined;
          const named = odds.ledger.rows.some((row) => / pass, crossed by every unit$/.test(row.label));
          expect(named).toBe(entersByPass);
          if (named) crossing += 1;
          else missing += 1;
        }
      }
    }
    expect(crossing).toBeGreaterThan(0);
    expect(missing).toBeGreaterThan(0);
    expect(crossing + missing).toBeGreaterThan(5);
  });

  it("warns when artillery alone would turn back, and lists no defenders when only works hold", () => {
    const guns = raise(withUnits(scenario, [["north-san-marcial-22", "north", "castilla-y-leon"]]), "guns-1", "republic", "artillery-group", "madrid");
    const odds = invadeOdds(scenario, guns, republic, castile, [{ unitId: unit("guns-1") }], [], empty);
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
    expect(musterRefusal(scenario, session(), order)).toBeUndefined();
  });
});
