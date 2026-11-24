// Rev 2 network-engine: move modes on links (R5), passes in battle (R6), link works (R7), reach and order lines.
import { describe, expect, it } from "vitest";
import { projectCost, siteRefusal } from "../main/engine/economy/catalogue";
import { advanceQueues } from "../main/engine/economy/queues";
import { movementCombatModifiers, passModifiers } from "../main/engine/movement/hooks";
import { railCapacity, railLinks, railPlaces, railReach } from "../main/engine/movement/network";
import { describeRoute, hasRoom, moveRoutes, usageOf, validateRoute } from "../main/engine/movement/routes";
import { orderLine, pathPoints } from "../main/engine/network/lines";
import { afterWork, hasLinks, linkBetween, linkKey, linkModifiers, railOn, railRank, roadOn, roadRank, stationCap, workMisfit } from "../main/engine/network/links";
import { allFoot, marchCrossing, motorPath, startSubTerritories } from "../main/engine/network/paths";
import { reachFor } from "../main/engine/network/reach";
import { initialGameState } from "../main/engine/resolution";
import type { BuildProject, CombatModifier, GameState, LinkModifier, MoveLeg, MoveOrder, Scenario, SubTerritoryId } from "../main/engine/types";
import { validateMoveOrder } from "../main/engine/validation";
import { modifierName } from "../main/presentation/odds";
import { faction, play, spainWithAir, spainM2, territory, unit, withUnits } from "./support";
import { pinned } from "./pinned";

const scenario = pinned(spainWithAir());
const start = initialGameState(scenario);
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;
const land = (to: string): MoveLeg => ({ kind: "land", to: territory(to) });
const sea = (to: string): MoveLeg => ({ kind: "sea", to: territory(to) });
const order = (factionId: string, unitId: string, from: string, legs: readonly MoveLeg[]): MoveOrder => ({
  factionId: faction(factionId), from: territory(from), kind: "move", legs, to: legs[legs.length - 1]?.to ?? territory(from), unitId: unit(unitId)
});

/** The state with every sub-territory of the territories held by the faction. */
function holding(state: GameState, factionId: string, ...territoryIds: string[]): GameState {
  const subTerritories = { ...state.subTerritories };
  for (const territoryId of territoryIds) {
    for (const each of scenario.index.subTerritoriesByTerritory.get(territory(territoryId)) ?? []) {
      const site = subTerritories[each.id];
      if (site !== undefined) subTerritories[each.id] = { ...site, holder: faction(factionId) };
    }
  }
  return { ...state, subTerritories };
}

function withSite(state: GameState, id: string, change: Partial<GameState["subTerritories"][SubTerritoryId]>): GameState {
  const site = state.subTerritories[sub(id)];
  if (site === undefined) throw new Error(id);
  return { ...state, subTerritories: { ...state.subTerritories, [sub(id)]: { ...site, ...change } } };
}

/** A truck column raised in play, standing in `territoryId`. */
function withTruck(state: GameState, territoryId: string): GameState {
  const id = unit("rep-test-trucks");
  return {
    ...state,
    raised: { ...state.raised, [id]: { factionId: faction("republic"), fullStrength: 300, id, name: "Trucks", type: "truck-column" as never } },
    units: { ...state.units, [id]: { factionId: faction("republic"), fatigue: 0, id, morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory(territoryId) } }
  };
}

const codes = (reach: { readonly ok: boolean } | undefined): readonly string[] => (reach !== undefined && "reasons" in reach ? (reach.reasons as readonly { readonly code: string }[]).map((reason) => reason.code) : []);
const noRail: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, rail: undefined as never } };

const requireLink = (a: string, b: string) => {
  const found = linkBetween(scenario, sub(a), sub(b));
  if (found === undefined) throw new Error(`${a}|${b}`);
  return found;
};

describe("links as they stand (network/links.ts)", () => {
  const avila = requireLink("madrid", "avila");

  it("reads roads, rail and passes, with works built in play replacing the data", () => {
    expect(roadOn(start, avila)).toBe("track");
    expect(railOn(start, avila)).toBeUndefined();
    const built: GameState = { ...start, builtLinks: { [linkKey("madrid", "avila")]: [{ kind: "road", level: "main" }, { kind: "rail", level: "single" }] } };
    expect([roadOn(built, avila), railOn(built, avila)]).toEqual(["main", "single"]);
    expect(linkModifiers(avila)).toEqual([{ kind: "road", level: "track" }]);
    expect([roadRank(undefined), roadRank("track"), roadRank("main"), railRank(undefined), railRank("single"), railRank("main")]).toEqual([0, 1, 2, 0, 1, 2]);
    expect(hasLinks(scenario)).toBe(true);
  });

  it("caps a station at its best link, within the rail improvement's maximum", () => {
    expect(stationCap(scenario, start, sub("madrid"))).toBe(2);
    expect(stationCap(scenario, start, sub("cuenca"))).toBe(1);
    expect(stationCap(scenario, start, sub("mallorca"))).toBe(0);
    const noCap: Scenario = { ...scenario, improvements: undefined as never };
    expect(stationCap(noCap, start, sub("madrid"))).toBe(2);
  });

  it("applies each work only where it fits, and says why not", () => {
    const none: readonly LinkModifier[] = [];
    const single: readonly LinkModifier[] = [{ kind: "road", level: "track" }, { kind: "rail", level: "single" }];
    const main: readonly LinkModifier[] = [{ kind: "road", level: "main" }, { kind: "rail", level: "main" }];
    const tracksServe = { label: "Road", motorLevel: "track", motorRange: 2 } as const;
    const mainOnly = { ...tracksServe, motorLevel: "main" } as const;
    expect(afterWork(none, "new-rail", undefined)).toEqual([{ kind: "rail", level: "single" }]);
    expect(afterWork(none, "road-upgrade", tracksServe)).toEqual([{ kind: "road", level: "track" }]);
    expect(afterWork(single, "road-upgrade", mainOnly)).toEqual([{ kind: "rail", level: "single" }, { kind: "road", level: "main" }]);
    expect(afterWork(single, "rail-upgrade", undefined)).toEqual([{ kind: "road", level: "track" }, { kind: "rail", level: "main" }]);
    expect([workMisfit(single, "new-rail", undefined), workMisfit(none, "rail-upgrade", undefined), workMisfit(main, "rail-upgrade", undefined), workMisfit(main, "road-upgrade", undefined), workMisfit(none, "new-rail", undefined)])
      .toEqual(["There is a railway here already.", "Needs a railway first.", "This is a main line already.", "Trucks can use this road already.", undefined]);
    // Where every road takes trucks, a better one gives nothing, so only a link with no road takes the work.
    expect(workMisfit(single, "road-upgrade", tracksServe)).toBe("Trucks can use this road already.");
    expect(workMisfit(single, "road-upgrade", mainOnly)).toBeUndefined();
  });
});

describe("March and Motor along the links (R5)", () => {
  // The Republic holds Castilla y León whole and empty, so Motor may pass through it.
  const castile = holding(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]), "republic", "castilla-y-leon");

  it("leaves from the army's own ground, or the whole territory without the partition rules", () => {
    expect(startSubTerritories(scenario, start, faction("north"), territory("pais-vasco"))).toEqual(["alava"]);
    expect(startSubTerritories(scenario, start, faction("republic"), territory("madrid"), [unit("rep-wad-ras-1")])).toEqual(["madrid", "guadarrama", "henares"]);
    expect(startSubTerritories(scenario, start, faction("nobody"), territory("madrid"))).toEqual(["madrid", "guadarrama", "henares"]);
    expect(startSubTerritories(spainM2(), start, faction("north"), territory("pais-vasco"))).toHaveLength(3);
  });

  it("marches over a road, foot units over any link, and takes a pass last", () => {
    const madrid = startSubTerritories(scenario, start, faction("republic"), territory("madrid"));
    const march = marchCrossing(scenario, start, madrid, territory("castilla-y-leon"), false);
    // Madrid-Ávila (a track) flanks the Somosierra pass.
    expect(march).toMatchObject({ ok: true, step: { from: "madrid", mode: "march", to: "avila" } });
    const roadless: GameState = { ...start, builtLinks: { [linkKey("madrid", "avila")]: [], [linkKey("guadarrama", "avila")]: [] } };
    expect(marchCrossing(scenario, roadless, madrid, territory("castilla-y-leon"), false)).toMatchObject({ ok: true, step: { to: "segovia" } });
    const noRoads: GameState = { ...roadless, builtLinks: { ...roadless.builtLinks, [linkKey("guadarrama", "segovia")]: [{ kind: "pass", name: "Somosierra" }] } };
    expect(marchCrossing(scenario, noRoads, madrid, territory("castilla-y-leon"), false)).toEqual({ code: "not-foot", ok: false, reason: "Only foot units can cross where there is no road." });
    expect(marchCrossing(scenario, noRoads, madrid, territory("castilla-y-leon"), true)).toMatchObject({ ok: true, step: { to: "avila" } });
    expect(marchCrossing(scenario, start, madrid, territory("galicia"), true)).toMatchObject({ code: "not-connected", ok: false });
  });

  it("counts generals and aircraft as foot, artillery and trucks not", () => {
    const trucks = withTruck(start, "madrid");
    expect(allFoot(scenario, trucks, [unit("rep-wad-ras-1"), unit("rep-general-miaja"), unit("rep-ni52-fighters")])).toBe(true);
    expect(allFoot(scenario, trucks, [unit("rep-wad-ras-1"), unit("rep-test-trucks")])).toBe(false);
    expect(allFoot(scenario, trucks)).toBe(true);
  });

  it("runs Motor along main roads only, never over a pass", () => {
    const madrid = startSubTerritories(scenario, castile, faction("republic"), territory("madrid"));
    expect(motorPath(scenario, castile, madrid, [territory("castilla-y-leon"), territory("galicia")])).toEqual({ code: "pass-blocks-motor", ok: false, reason: "Motor can't cross the Somosierra pass." });
    const toValencia = motorPath(scenario, start, madrid, [territory("castilla-la-mancha"), territory("valencia")]);
    expect(toValencia.ok && toValencia.path.map(({ step }) => `${step.from}>${step.to}`)).toEqual(["madrid>cuenca", "cuenca>valencia"]);
    expect(motorPath(scenario, start, madrid, [territory("castilla-la-mancha"), territory("murcia")])).toEqual({ code: "no-road", ok: false, reason: "Motor needs a main road all the way." });
  });

  it("checks a Motor route's range, destination and roads", () => {
    const trucked = withTruck(withSite(castile, "madrid", { rail: 0 }), "madrid");
    const units = [unit("rep-wad-ras-1"), unit("rep-test-trucks")];
    const check = (state: GameState, legs: readonly MoveLeg[]) => describeRoute(scenario, state, faction("republic"), territory("madrid"), legs, false, undefined, units);
    // The main road through mountainous Cuenca costs no extra step (declog D13).
    expect(check(trucked, [land("castilla-la-mancha"), land("valencia")])).toMatchObject({ ok: true, route: { cost: 2, mode: "motor", path: [{ mode: "motor", to: "cuenca" }, { mode: "motor", to: "valencia" }], rough: [] } });
    expect(check(trucked, [land("castilla-la-mancha"), land("valencia"), land("catalunya")])).toMatchObject({ code: "too-far", ok: false });
    expect(check(trucked, [land("castilla-la-mancha"), land("extremadura")])).toEqual({ code: "contested", ok: false, reason: "Motor can't enter contested ground." });
    expect(check(trucked, [land("castilla-y-leon"), land("galicia")])).toMatchObject({ code: "pass-blocks-motor", ok: false });
    // Without the partition rules there are no pockets, and the links still carry the roads.
    expect(describeRoute(spainM2(), trucked, faction("republic"), territory("madrid"), [land("castilla-la-mancha"), land("valencia")], false, undefined, units).ok).toBe(true);
  });

  it("charges a mountain entry on the sub-territory the link enters", () => {
    const madrid = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]);
    // Madrid to Castilla-La Mancha enters Toledo (open); Granada is the mountain of Andalucía.
    expect(describeRoute(scenario, madrid, faction("republic"), territory("madrid"), [land("castilla-la-mancha")], false, undefined, [unit("rep-wad-ras-1")]))
      .toMatchObject({ ok: true, route: { cost: 1, mode: "march", rough: [] } });
  });
});

describe("routes without links or road rules", () => {
  const republic = faction("republic");
  const madrid = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]);

  it("steps by the territory connections where the scenario has no links", () => {
    const linkless: Scenario = { ...scenario, links: [] };
    expect(describeRoute(linkless, madrid, republic, territory("madrid"), [land("castilla-la-mancha")])).toMatchObject({ ok: true, route: { mode: "march", path: [] } });
    // Two steps price the mountain entry by the connections' entry sub-territories, as before links.
    const motor = describeRoute(linkless, madrid, republic, territory("madrid"), [land("castilla-la-mancha"), land("valencia")]);
    expect(motor).toMatchObject({ ok: true, route: { mode: "motor", path: [] } });
  });

  it("lets Motor use any link and any range where the scenario has no road rules", () => {
    const roadless: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, road: undefined as never } };
    const trucks = withTruck(holding(madrid, "republic", "castilla-y-leon"), "madrid");
    const units = [unit("rep-wad-ras-1"), unit("rep-test-trucks")];
    expect(describeRoute(roadless, trucks, republic, territory("madrid"), [land("castilla-la-mancha"), land("murcia")], false, undefined, units).ok).toBe(true);
    expect(describeRoute(roadless, trucks, republic, territory("madrid"), [land("castilla-la-mancha"), land("valencia"), land("catalunya")], false, undefined, units).ok).toBe(true);
    expect(marchCrossing(roadless, start, [sub("madrid")], territory("castilla-y-leon"), false).ok).toBe(true);
    expect(reachFor(roadless, madrid, republic, [unit("rep-wad-ras-1")]).get(territory("ceuta"))).toMatchObject({ reasons: [{ code: "too-far" }, { text: "Motor reaches at most 2 territories." }, { code: "no-rail" }] });
  });
});

describe("route capacity (M3, M5)", () => {
  it("skips a ride once the capital's train places are taken by other planned moves (D5)", () => {
    // Madrid's station is level 2 and has a rail yard.
    expect(railCapacity(scenario, start, sub("madrid"))).toBe(6);
    // Six units of one army, all bound for Valencia, take six places.
    const others = scenario.units.filter((each) => each.factionId === faction("republic") && each.id !== unit("rep-wad-ras-1") && railPlaces(scenario, start, [each.id]) === 1).slice(0, 6).map((each) => each.id);
    const madrid: GameState = { ...start, units: { ...start.units, ...withUnits(scenario, others.map((id) => [id, "republic", "madrid"] as const)).units } };
    const planned = others.map((id) => order("republic", id, "madrid", [{ kind: "rail", to: territory("valencia") }]));
    expect(planned).toHaveLength(6);
    expect(moveRoutes(scenario, madrid, faction("republic"), territory("madrid"), [unit("rep-wad-ras-1")]).get(territory("catalunya"))?.shape).toBe("rail");
    // Madrid's trains are full, so the army steps into Castilla-La Mancha and boards at Toledo.
    expect(moveRoutes(scenario, madrid, faction("republic"), territory("madrid"), [unit("rep-wad-ras-1")], planned).get(territory("catalunya"))?.shape).toBe("step-rail");
  });

  it("counts port landings and amphibious lanes, an army already counted going free", () => {
    const valencia = withUnits(scenario, [["rep-wad-ras-1", "republic", "valencia"], ["rep-covadonga-4", "republic", "valencia"]]);
    const check = describeRoute(scenario, valencia, faction("republic"), territory("valencia"), [sea("islas-baleares")]);
    if (!check.ok) throw new Error(check.reason);
    const route = check.route;
    const landed = usageOf([{ army: "first", places: 1, route }]);
    const amphibious = { ...route, sea: { departure: sub("valencia"), kind: "amphibious" as const } };
    const assaulted = usageOf([{ army: "first", places: 1, route: amphibious }]);
    expect(route.sea?.kind === "port" ? hasRoom(scenario, valencia, { army: "second", places: 1, route }, landed) : false).toBe(false);
    expect(hasRoom(scenario, valencia, { army: "first", places: 1, route }, landed)).toBe(true);
    expect(hasRoom(scenario, valencia, { army: "second", places: 1, route: amphibious }, assaulted)).toBe(false);
    expect(hasRoom(scenario, valencia, { army: "first", places: 1, route: amphibious }, assaulted)).toBe(true);
  });
});

describe("reach (network/reach.ts)", () => {
  it("gives each reachable territory its mode and links", () => {
    const madrid = reachFor(scenario, start, faction("republic"), [unit("rep-wad-ras-1")]);
    expect(madrid.get(territory("castilla-la-mancha"))).toEqual({ mode: "march", ok: true, path: [{ from: "madrid", mode: "march", to: "toledo" }] });
    const catalunya = madrid.get(territory("catalunya"));
    expect(catalunya?.ok === true && catalunya.mode).toBe("rail");
    expect(catalunya?.ok === true && catalunya.path.every((step) => step.mode === "rail")).toBe(true);
    // Toledo to Cáceres is a main road: with Extremadura held, trucks drive Madrid to Extremadura.
    const extremadura = holding(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]), "republic", "extremadura");
    const trucked = reachFor(noRail, withTruck(extremadura, "madrid"), faction("republic"), [unit("rep-wad-ras-1"), unit("rep-test-trucks")]);
    expect(trucked.get(territory("extremadura"))).toEqual({ mode: "motor", ok: true, path: [{ from: "madrid", mode: "motor", to: "toledo" }, { from: "toledo", mode: "motor", to: "caceres" }] });
  });

  it("says why, mode by mode, where the units cannot go", () => {
    const castile = holding(withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"]]), "republic", "castilla-y-leon");
    // Without rail, so only March and Motor answer.
    const alone = reachFor(noRail, castile, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("galicia"));
    expect(alone).toEqual({
      ok: false,
      reasons: [
        { code: "too-far", text: "March reaches only a neighbouring territory." },
        { code: "no-trucks", text: "Motor needs trucks for every unit." }
      ]
    });
    const trucked = reachFor(noRail, withTruck(castile, "madrid"), faction("republic"), [unit("rep-wad-ras-1"), unit("rep-test-trucks")]);
    expect(trucked.get(territory("galicia"))).toEqual({ ok: false, reasons: [{ code: "too-far", text: "March reaches only a neighbouring territory." }, { code: "pass-blocks-motor", text: "Motor can't cross the Somosierra pass." }] });
    expect(codes(reachFor(scenario, start, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("ceuta")))).toEqual(["too-far", "too-far", "no-rail"]);
    // No rail reason where the army could not board at all.
    expect(codes(reachFor(scenario, withSite(start, "madrid", { rail: 0 }), faction("republic"), [unit("rep-wad-ras-1")]).get(territory("ceuta")))).toEqual(["too-far", "too-far"]);
  });

  it("names a contested start, a demoralized army and a missing port", () => {
    expect(reachFor(scenario, start, faction("republic"), [unit("rep-asturian-militia")]).get(territory("cantabria"))).toEqual({
      ok: false, reasons: [{ code: "contested", text: "Not in contested ground: units here attack or withdraw." }]
    });
    const shaken = withUnits(scenario, [["rep-wad-ras-1", "republic", "madrid"], ["north-san-marcial-22", "north", "castilla-y-leon"]]);
    const army = shaken.units[unit("rep-wad-ras-1")];
    if (army === undefined) throw new Error("fixture");
    const demoralized: GameState = { ...shaken, units: { ...shaken.units, [army.id]: { ...army, morale: { demoralized: true, quietTurns: 0 } } } };
    expect(codes(reachFor(scenario, demoralized, faction("republic"), [army.id]).get(territory("castilla-y-leon")))[0]).toBe("enemy-ground");
    // Valencia to the Balearics without the port.
    const valencia = withSite(withUnits(scenario, [["rep-wad-ras-1", "republic", "valencia"]]), "valencia", { port: 0 });
    const noPort = reachFor(scenario, valencia, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("islas-baleares"));
    expect(codes(noPort)).toContain("no-port");
  });

  it("falls back to a plain reason when nothing else applies", () => {
    // Trucks alone may not advance into enemy ground, though every link allows it.
    expect(reachFor(noRail, withTruck(start, "madrid"), faction("republic"), [unit("rep-test-trucks")]).get(territory("castilla-y-leon"))).toEqual({ ok: false, reasons: [{ code: "not-connected", text: "Out of reach this turn." }] });
    // A territory with no capital has no station to board at.
    const territories = new Map([...scenario.index.territories].map(([id, entry]) => {
      const copy = { ...entry };
      if (id === territory("madrid")) Reflect.deleteProperty(copy, "capitalSubTerritoryId");
      return [id, copy] as const;
    }));
    const noCapital: Scenario = { ...scenario, index: { ...scenario.index, territories } };
    expect(codes(reachFor(noCapital, start, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("ceuta")))).not.toContain("no-rail");
    const islands: Scenario = { ...noRail, connections: noRail.connections.filter((connection) => !connection.between.includes(territory("islas-baleares"))) };
    expect(reachFor(islands, start, faction("republic"), [unit("rep-wad-ras-1")]).get(territory("islas-baleares"))).toMatchObject({ ok: false });
    const single = reachFor(spainM2(), start, faction("republic"), [unit("rep-wad-ras-1")]);
    expect(single.get(territory("castilla-la-mancha"))).toMatchObject({ mode: "march", ok: true });
  });
});

describe("rail on the links (R5)", () => {
  it("sets the range by the weakest link on the route, and closes wrecked stations", () => {
    const madrid = railReach(scenario, start, faction("republic"), territory("madrid"));
    expect(madrid.get(territory("catalunya"))).toMatchObject({ level: 2, range: 4 });
    // Cuenca's line from Madrid is single: range 2 from there.
    expect(madrid.get(territory("castilla-la-mancha"))).toMatchObject({ level: 2 });
    expect(railReach(scenario, withSite(start, "madrid", { rail: 0 }), faction("republic"), territory("madrid")).size).toBe(0);
    expect(railReach(noRail, start, faction("republic"), territory("madrid")).size).toBe(0);
  });

  it("draws every open rail link, built ones included", () => {
    const before = railLinks(scenario, start);
    expect(before.find((entry) => entry.a === sub("madrid") && entry.b === sub("cuenca"))?.level).toBe(1);
    const built: GameState = { ...start, builtLinks: { [linkKey("cuenca", "valencia")]: [{ kind: "road", level: "main" }, { kind: "rail", level: "single" }] } };
    expect(railLinks(scenario, built)).toHaveLength(before.length + 1);
    expect(railLinks(scenario, withSite(start, "cuenca", { rail: 0 })).some((entry) => entry.b === sub("cuenca"))).toBe(false);
  });
});

describe("passes in battle (R6)", () => {
  // The Republic holds Asturias whole; the North defends Castilla y León, reached from Asturias only over Pajares.
  const asturias = holding(withUnits(scenario, [
    ["rep-asturian-militia", "republic", "asturias"],
    ["rep-santander-column", "republic", "cantabria"],
    ["north-san-marcial-22", "north", "castilla-y-leon"]
  ]), "republic", "asturias");
  const context = (unitIds: readonly string[], state: GameState = asturias, on: Scenario = scenario) => ({
    attackerFactionId: faction("republic"), attackerUnitIds: unitIds.map(unit), defenderFactionIds: [faction("north")], diggingIn: false, scenario: on, state, territoryId: territory("castilla-y-leon")
  });

  it("gives the attacker -2 when every ground attacker crosses a pass, and loses it to a flank", () => {
    expect(passModifiers(context(["rep-asturian-militia"]))).toEqual([{ kind: "pass", name: "Pajares", roll: -2 }]);
    expect(passModifiers(context(["rep-asturian-militia", "rep-santander-column"]))).toEqual([]);
    expect(movementCombatModifiers(context(["rep-asturian-militia"]))).toEqual([{ kind: "pass", name: "Pajares", roll: -2 }]);
    // Already in the territory, or by another way: no pass crossed.
    expect(passModifiers(context(["north-san-marcial-22"]))).toEqual([]);
    const noUnits: Partial<ReturnType<typeof context>> = context(["rep-asturian-militia"]);
    delete noUnits.attackerUnitIds;
    expect(passModifiers(noUnits as Omit<ReturnType<typeof context>, "attackerUnitIds">)).toEqual([]);
  });

  it("keeps the bonus without flanking rules, and has none without pass rules", () => {
    const noFlank: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, pass: { ...scenario.linkModifiers.pass!, lostToFlanking: false } } };
    expect(passModifiers(context(["rep-asturian-militia", "rep-santander-column"], asturias, noFlank))).toHaveLength(1);
    const noPass: Scenario = { ...scenario, linkModifiers: { ...scenario.linkModifiers, pass: undefined as never } };
    expect(passModifiers(context(["rep-asturian-militia"], asturias, noPass))).toEqual([]);
  });

  it("lists the pass among the battle's modifiers when the attack is fought", () => {
    const result = play(scenario, asturias, [order("republic", "rep-asturian-militia", "asturias", [land("castilla-y-leon")])]);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    const modifiers: readonly CombatModifier[] = battle?.kind === "battle" ? battle.modifiers : [];
    expect(modifiers).toContainEqual({ kind: "pass", name: "Pajares", roll: -2 });
    expect(modifierName({ kind: "pass", name: "Pajares", roll: -2 })).toBe("Pajares pass");
    const flanked = play(scenario, asturias, [
      order("republic", "rep-asturian-militia", "asturias", [land("castilla-y-leon")]),
      order("republic", "rep-santander-column", "cantabria", [land("castilla-y-leon")])
    ]);
    const flankBattle = flanked.outcomes.find((outcome) => outcome.kind === "battle");
    expect(flankBattle?.kind === "battle" ? flankBattle.modifiers.some((modifier) => modifier.kind === "pass") : true).toBe(false);
  });
});

describe("link works (R7)", () => {
  const republic = faction("republic");
  const work = (kind: "new-rail" | "rail-upgrade" | "road-upgrade", a: string, b: string): BuildProject => ({ a: sub(a), b: sub(b), kind: "link", work: kind });

  it("prices them from the scenario and checks the link, both ends and the work", () => {
    expect(projectCost(scenario, work("new-rail", "cuenca", "valencia"))).toEqual({ cost: { funds: 24 }, turns: 8 });
    expect(siteRefusal(scenario, start, republic, sub("cuenca"), work("new-rail", "cuenca", "valencia"))).toBeUndefined();
    expect(siteRefusal(scenario, start, republic, sub("madrid"), work("new-rail", "cuenca", "valencia"))).toBe("Queue link works at one end of the link.");
    expect(siteRefusal(scenario, start, republic, sub("madrid"), work("new-rail", "madrid", "barcelona"))).toBe("Those sub-territories don't border each other.");
    expect(siteRefusal(scenario, start, republic, sub("guadarrama"), work("road-upgrade", "guadarrama", "segovia"))).toBe("Segovia is not yours.");
    expect(siteRefusal(scenario, start, republic, sub("ciudad-real"), work("road-upgrade", "ciudad-real", "cordoba"))).toMatch(/is not yours/u);
    expect(siteRefusal(scenario, start, republic, sub("madrid"), work("new-rail", "madrid", "cuenca"))).toBe("There is a railway here already.");
    expect(siteRefusal(scenario, start, republic, sub("madrid"), work("rail-upgrade", "madrid", "cuenca"))).toBeUndefined();
    const free: Scenario = { ...scenario, linkProjects: undefined as never };
    expect(siteRefusal(free, start, republic, sub("madrid"), work("rail-upgrade", "madrid", "cuenca"))).toBe("Not available in this scenario.");
  });

  it("refuses the other end's contested territory and a work the queue already covers", () => {
    // Jaén (Andalucía, contested) at the far end of Despeñaperros.
    expect(siteRefusal(scenario, start, republic, sub("ciudad-real"), work("road-upgrade", "ciudad-real", "jaen"))).toMatch(/Contested/u);
    const cuenca = start.subTerritories[sub("cuenca")];
    if (cuenca === undefined) throw new Error("fixture");
    const queued: GameState = { ...start, subTerritories: { ...start.subTerritories, [sub("cuenca")]: { ...cuenca, queue: [{ factionId: republic, paid: {}, progress: 0, project: work("new-rail", "valencia", "cuenca") }] } } };
    expect(siteRefusal(scenario, queued, republic, sub("valencia"), work("road-upgrade", "cuenca", "valencia"))).toBe("Trucks can use this road already.");
    // One work at a time on a link, at either end.
    expect(siteRefusal(scenario, queued, republic, sub("valencia"), work("new-rail", "cuenca", "valencia"))).toBe("Another work on this link is in the queue.");
  });

  it("changes the link when done, and raises the stations at its ends", () => {
    const madrid = start.subTerritories[sub("madrid")];
    if (madrid === undefined) throw new Error("fixture");
    const upgrade = work("rail-upgrade", "madrid", "cuenca");
    const queued: GameState = { ...start, subTerritories: { ...start.subTerritories, [sub("madrid")]: { ...madrid, queue: [{ factionId: republic, paid: {}, progress: 3, project: upgrade }] } } };
    const { events, systems } = advanceQueues(scenario, queued);
    expect(events).toContainEqual({ factionId: "republic", kind: "build-completed", project: upgrade, subTerritoryId: "madrid" });
    expect(systems.builtLinks?.[linkKey("madrid", "cuenca")]).toEqual([{ kind: "road", level: "main" }, { kind: "rail", level: "main" }]);
    expect(systems.subTerritories[sub("cuenca")]?.rail).toBe(2);
    expect(systems.subTerritories[sub("madrid")]).toEqual({ ...madrid, queue: [] });
    // A work that no longer fits (the line was upgraded first) changes nothing.
    const again = { ...systems, subTerritories: { ...systems.subTerritories, [sub("madrid")]: { ...madrid, queue: [{ factionId: republic, paid: {}, progress: 3, project: upgrade }] } } };
    expect(advanceQueues(scenario, again).systems.builtLinks).toEqual(systems.builtLinks);
  });

  it("waits while the far end is lost or contested", () => {
    const madrid = start.subTerritories[sub("madrid")];
    if (madrid === undefined) throw new Error("fixture");
    const upgrade = work("rail-upgrade", "madrid", "cuenca");
    const queued = withSite({ ...start, subTerritories: { ...start.subTerritories, [sub("madrid")]: { ...madrid, queue: [{ factionId: republic, paid: {}, progress: 3, project: upgrade }] } } }, "cuenca", { holder: faction("south") });
    const { events, systems } = advanceQueues(scenario, queued);
    expect(events).toEqual([]);
    expect(systems.builtLinks).toBeUndefined();
    expect(systems.subTerritories[sub("madrid")]?.queue[0]?.progress).toBe(3);
  });

  it("carries built links through a whole turn", () => {
    const built: GameState = { ...start, builtLinks: { [linkKey("cuenca", "valencia")]: [{ kind: "road", level: "main" }, { kind: "rail", level: "single" }] } };
    expect(play(scenario, built, []).finalState.builtLinks).toEqual(built.builtLinks);
  });
});

describe("Málaga's sea lane to Murcia (R3)", () => {
  const malaga = holding(withUnits(scenario, [["rep-vitoria-8", "republic", "andalucia"]]), "republic", "andalucia");
  const lane = order("republic", "rep-vitoria-8", "andalucia", [sea("murcia")]);

  it("validates a sea move even though a land border exists, and sails from Málaga", () => {
    expect(validateMoveOrder(scenario, malaga, lane)).toEqual({ ok: true });
    expect(validateRoute(scenario, malaga, lane)).toMatchObject({ ok: true, route: { mode: "sea", path: [{ from: "malaga", mode: "sea", to: "murcia" }], sea: { departure: "malaga", kind: "port" } } });
    const result = play(scenario, malaga, [lane]);
    expect(result.finalState.units[unit("rep-vitoria-8")]?.territoryId).toBe("murcia");
  });

  it("offers the sea when the army's ground has no land link to Murcia", () => {
    const cut = new Set(["almeria", "granada"].map((each) => linkKey(each, "murcia")));
    const links = new Map([...scenario.index.links].filter(([key]) => !cut.has(key)));
    const sealed: Scenario = { ...scenario, index: { ...scenario.index, links } };
    expect(moveRoutes(sealed, malaga, faction("republic"), territory("andalucia"), [unit("rep-vitoria-8")]).get(territory("murcia"))?.mode).toBe("sea");
    expect(moveRoutes(scenario, malaga, faction("republic"), territory("andalucia"), [unit("rep-vitoria-8")]).get(territory("murcia"))?.mode).toBe("march");
  });
});

describe("order lines (U8)", () => {
  it("lists the sub-territories a planned move passes", () => {
    expect(pathPoints([{ from: sub("a"), mode: "march", to: sub("b") }, { from: sub("c"), mode: "rail", to: sub("d") }, { from: sub("d"), mode: "rail", to: sub("e") }])).toEqual(["a", "b", "c", "d", "e"]);
    expect(orderLine(scenario, start, order("republic", "rep-wad-ras-1", "madrid", [land("castilla-la-mancha")]))).toEqual(["madrid", "toledo"]);
    const ride = orderLine(scenario, start, order("republic", "rep-wad-ras-1", "madrid", [{ kind: "rail", to: territory("catalunya") }]));
    expect(ride[0]).toBe("madrid");
    expect(ride[ride.length - 1]).toBe("barcelona");
    expect(orderLine(scenario, start, order("republic", "rep-wad-ras-1", "madrid", [land("galicia")]))).toEqual([]);
  });
});
