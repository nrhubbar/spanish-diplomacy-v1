import { describe, expect, it } from "vitest";
import { assess } from "../main/ai/assessment";
import { bestAttackOn } from "../main/ai/attacks";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { buildReserve, planBuilds } from "../main/ai/orders/build";
import { planRecruits } from "../main/ai/orders/recruit";
import { planReplenishment } from "../main/ai/orders/replenish";
import { createPlan } from "../main/ai/plan";
import { recruitBoard, siteBattles, worthOf } from "../main/ai/unitWorth";
import { movePlanningView } from "../main/ai/planningView";
import { incomeFor, territoryIncome } from "../main/engine/economy/income";
import { estimateAttack } from "../main/engine/combat";
import { requireAiProfile } from "../main/engine/lookup";
import { seededRandom } from "../main/engine/random";
import { initialGameState } from "../main/engine/resolution";
import type { AiProfile, GameState, RecruitOrder, Resources, Scenario, UnitTypeDefinition } from "../main/engine/types";
import { type DocumentTransform, loadScenario, scenarioSources } from "../sim/engine";
import { board, heldWhole, type Placement } from "./aiBoards";
import { pinned } from "./pinned";
import { faction, spain, spainId, spainWithAir, territory, unit, withUnits } from "./support";

// Rev 5: personas and the profile fields they use. A field left out plays as before (the byte-identity replay pins whole games).

const [republic, north, south] = [faction("republic"), faction("north"), faction("south")];
const scenario = spain();
const start = initialGameState(scenario);

/** Spain as shipped, loaded with these seats. */
const seated = (seats: Readonly<Record<string, string>>, change: DocumentTransform = (document) => document): Scenario =>
  loadScenario(scenarioSources(), spainId, (document) => {
    const raw = change(structuredClone(document)) as { ai: Record<string, unknown> };
    return { ...raw, ai: { ...raw.ai, seats } };
  });

/** The scenario with some fields of one faction's profile changed. */
function playing(on: Scenario, factionId: typeof republic, overrides: { readonly [Area in keyof AiProfile]?: Partial<AiProfile[Area]> }): Scenario {
  const profile = requireAiProfile(on, factionId);
  const changed = Object.fromEntries(Object.entries(overrides).map(([area, fields]) => [area, { ...profile[area as keyof AiProfile], ...fields }]));
  return { ...on, ai: { ...on.ai, profiles: { ...on.ai.profiles, [factionId]: { ...profile, ...changed } } } };
}

const context = (on: Scenario, state: GameState, factionId = republic) => ({ factionId, memory: {}, planned: [], random: seededRandom(1), scenario: on, state });
const funded = (state: GameState, factionId: typeof republic, funds = 200, manpower = 60): GameState => ({ ...state, treasuries: { ...state.treasuries, [factionId]: { funds, manpower } as Resources } });
const typeOf = (id: string): UnitTypeDefinition => scenario.unitTypes.find((type) => type.id === id)!;
const recruits = (on: Scenario, state: GameState, factionId = republic): readonly string[] => planRecruits(context(on, state, factionId)).map((order) => order.unitTypeId);

describe("personas by seat", () => {
  it("plays each faction's own profile without seats, and leaves no trace of them", () => {
    const plain = loadScenario(scenarioSources(), spainId);
    expect(plain.ai).toEqual({ profiles: plain.ai.profiles });
    expect(seated({}).ai).toEqual(plain.ai);
    expect(loadScenario(scenarioSources(), spainId, (document) => {
      const { ai, ...rest } = document as { ai: { profiles: unknown } };
      return { ...rest, ai: { profiles: ai.profiles } };
    }).ai).toEqual(plain.ai);
  });

  it("merges a seat's persona over that faction's own profile, field by field", () => {
    const plain = loadScenario(scenarioSources(), spainId);
    const change: DocumentTransform = (document) => {
      const raw = document as { ai: { personas: Record<string, unknown>; profiles: Record<string, AiProfile> } };
      const profile = raw.ai.profiles["north"]!;
      raw.ai.profiles["north"] = { ...profile, recruits: { ...profile.recruits, typeWorth: { "militia-column": 0.5, "tank-company": 2 } } };
      raw.ai.personas["picky"] = { name: "Picky", overrides: { computer: { caution: 0.1 }, recruits: { typeWorth: { "militia-column": 0 }, variety: 0.5 } } };
      return document;
    };
    const { ai } = seated({ north: "picky" }, change);
    const own = plain.ai.profiles[north]!;
    expect(ai.seats).toEqual({ north: "picky" });
    expect(ai.profiles[north]).toEqual({
      ...own,
      computer: { ...own.computer, caution: 0.1 },
      recruits: { ...own.recruits, typeWorth: { "militia-column": 0, "tank-company": 2 }, variety: 0.5 }
    });
    expect(ai.profiles[south]).toEqual(plain.ai.profiles[south]);
    expect(requireAiProfile(seated({ north: "picky" }, change), north).recruits.variety).toBe(0.5);
  });

  it("refuses seats and personas the scenario cannot play", () => {
    const persona = (overrides: object): DocumentTransform => (document) => {
      (document as { ai: { personas: Record<string, unknown> } }).ai.personas["test"] = { name: "Test", overrides };
      return document;
    };
    expect(() => seated({ green: "builder" })).toThrow(/ai\.seats: unknown faction "green" \(L3\)/);
    expect(() => seated({ north: "napoleon" })).toThrow(/ai\.seats\.north: unknown persona "napoleon" \(L3\)/);
    expect(() => seated({}, persona({ recruits: { variety: 2 } }))).toThrow(/variety/);
    expect(() => seated({}, persona({ recruits: { luck: 1 } }))).toThrow(/luck/);
    expect(() => seated({}, persona({ recruits: { typeWorth: { zeppelin: 1 } } }))).toThrow(/ai\.personas\.test\.overrides\.recruits\.typeWorth: unknown unit type "zeppelin" \(L3\)/);
    expect(() => seated({}, (document) => {
      (document as { ai: { profiles: Record<string, { recruits: Record<string, unknown> }> } }).ai.profiles["north"]!.recruits["typeWorth"] = { zeppelin: 1 };
      return document;
    })).toThrow(/ai\.profiles\.north\.recruits\.typeWorth: unknown unit type "zeppelin" \(L3\)/);
    // A part of a Build budget over a profile without one is no whole budget.
    expect(() => seated({ north: "test" }, (document) => {
      const raw = persona({ builds: { spendShare: 1 } })(document) as { ai: { profiles: Record<string, AiProfile> } };
      Reflect.deleteProperty(raw.ai.profiles["north"]!, "builds");
      return document;
    })).toThrow(/ai\.seats\.north: persona "test" makes builds\.reserveShare invalid: .*\(L30\)/);
    expect(() => seated({ north: "test" }, (document) => {
      delete (document as { ai: { personas?: unknown } }).ai.personas;
      return document;
    })).toThrow(/unknown persona "test"/);
  });

  it("ships a library any seat can play", () => {
    const { ai } = JSON.parse(JSON.stringify(raw())) as { ai: { personas: Record<string, { note?: string }>; seats: object } };
    expect(Object.keys(ai.personas).sort()).toEqual(["aggressor", "air-stacker", "builder", "city-hunter", "combined-arms", "denier", "elite-core", "no-build", "rush", "single-arm", "threshold-attacker", "turtle"]);
    expect(ai.seats).toEqual({});
    for (const [id, { note }] of Object.entries(ai.personas)) {
      expect(note, id).toBeTruthy();
      const on = seated({ north: id, republic: id, south: id });
      const state = initialGameState(on);
      for (const player of on.factions) expect(generateComputerSubmission(on, state, player.id, seededRandom(1)).orders.length, `${id} ${player.id}`).toBeGreaterThan(0);
    }
  });
});

/** The shipped scenario document, before loading. */
function raw(): unknown {
  let document: unknown;
  loadScenario(scenarioSources(), spainId, (shipped) => (document = shipped));
  return document;
}

describe("what a persona recruits", () => {
  it("never recruits a type worth nothing to it, aircraft and trucks included", () => {
    const on = seated({ republic: "single-arm" });
    const rich = funded(initialGameState(on), republic);
    const plain = recruits(loadScenario(scenarioSources(), spainId), rich);
    const foot = ["infantry-regiment", "militia-column", "colonial-veterans", "security-forces", "cavalry-regiment"];
    expect(plain.some((id) => !foot.includes(id))).toBe(true);
    expect(recruits(on, rich).length).toBeGreaterThan(0);
    expect(recruits(on, rich).every((id) => foot.includes(id))).toBe(true);
  });

  it("builds nothing to unlock a type it never recruits", () => {
    const unlocks = (on: Scenario) => planBuilds(context(on, funded(initialGameState(on), republic)))
      .filter((order) => order.project.kind === "building" && on.buildings.find((entry) => order.project.kind === "building" && entry.id === order.project.buildingId)?.effects.some((effect) => effect.kind === "airbase")).length;
    const keen = { builds: { developmentProjects: 0, itemsPerEmptyQueue: 9, maxOrdersPerTurn: 60, spendShare: 1 } } as const;
    expect(unlocks(playing(scenario, republic, keen))).toBeGreaterThan(0);
    const air = Object.fromEntries(scenario.unitTypes.filter((type) => type.air !== undefined).map((type) => [type.id, 0]));
    expect(unlocks(playing(playing(scenario, republic, keen), republic, { recruits: { typeWorth: air } }))).toBe(0);
  });

  it("multiplies a type's worth, one left out counting in full", () => {
    const worth = (on: Scenario, id: string) => {
      const assessment = assess(on, movePlanningView(on, start, republic), republic);
      const recruitsAt = recruitBoard(on, start, assessment);
      return worthOf(recruitsAt, typeOf(id), { funds: 100, manpower: 50 } as Resources, siteBattles(recruitsAt, territory("madrid"), []));
    };
    const keen = playing(scenario, republic, { recruits: { typeWorth: { "infantry-regiment": 3 } } });
    expect(worth(keen, "infantry-regiment")).toBe(3 * worth(scenario, "infantry-regiment"));
    expect(worth(keen, "militia-column")).toBe(worth(scenario, "militia-column"));
  });

  it("takes variety off a type by how much of the force it is, and nothing at 0", () => {
    const own: Placement = [["rep-vitoria-8", "republic", "madrid"], ["rep-sevilla-34", "republic", "madrid"], ["rep-castilla-3", "republic", "madrid"], ["rep-madrid-security", "republic", "madrid"]];
    const order = (id: string): RecruitOrder => ({ factionId: republic, kind: "recruit", territoryId: territory("madrid"), unitTypeId: typeOf(id).id });
    const kept = (variety: number | undefined, id: string, ordered: readonly RecruitOrder[] = [], placed = own) => {
      const on = playing(scenario, republic, { recruits: { variety } });
      const state = withUnits(on, placed);
      return siteBattles(recruitBoard(on, state, assess(on, movePlanningView(on, state, republic), republic)), territory("madrid"), ordered).kept(typeOf(id));
    };
    // The types that join battles and are open to the Republic.
    const types = scenario.unitTypes.filter((type) => type.recruit !== undefined && (type.recruit.factionIds?.includes(republic) ?? true)
      && ((type.kind === "ground" && type.attack > 0) || type.effects.some((effect) => effect.kind === "battle-support"))).length;
    const spread = (3 / 4) * types;
    expect(kept(undefined, "infantry-regiment")).toBe(1);
    expect(kept(0, "infantry-regiment")).toBe(1);
    expect(kept(0.8, "infantry-regiment")).toBeCloseTo(1 - (0.8 * spread) / (1 + spread), 12);
    expect(kept(0.8, "tank-company")).toBe(1);
    expect(kept(1, "infantry-regiment")).toBeGreaterThan(0);
    // What is ordered this turn counts, and a force of nothing favours nothing.
    expect(kept(0.8, "tank-company", [order("tank-company")])).toBeLessThan(1);
    expect(kept(0.8, "infantry-regiment", [], [["north-aragon-17", "north", "aragon"]])).toBe(1);
  });

  it("orders less of the type its force holds most, and no fewer types, with variety", () => {
    const rich = funded(start, republic);
    const orders = (variety: number) => recruits(playing(scenario, republic, { recruits: { variety } }), rich);
    const most = "infantry-regiment";
    const held = (id: string) => Object.values(start.units).filter((entry) => entry.factionId === republic && scenario.index.units.get(entry.id)?.type === id).length;
    expect(held(most)).toBeGreaterThan(held("cavalry-regiment"));
    const count = (variety: number) => orders(variety).filter((id) => id === most).length;
    expect(count(1)).toBeLessThan(count(0));
    expect(new Set(orders(1)).size).toBeGreaterThanOrEqual(new Set(orders(0)).size);
    expect(orders(0)).toEqual(recruits(scenario, rich));
  });

  it("recruits nothing more at its most units, and still replenishes", () => {
    const rich = funded(start, republic);
    const fighters = Object.values(start.units).filter((entry) => entry.factionId === republic).length;
    const limited = (maxUnits: number) => playing(scenario, republic, { recruits: { maxUnits } });
    expect(recruits(limited(fighters), rich)).toEqual([]);
    expect(recruits(limited(fighters + 3), rich).filter((id) => typeOf(id).kind === "ground" && typeOf(id).id !== "truck-column")).toHaveLength(3);
    expect(recruits(limited(999), rich)).toEqual(recruits(scenario, rich));
    const training: GameState["training"] = [{ factionId: republic, paid: {}, paused: false, territoryId: territory("madrid"), turnsLeft: 2, typeId: typeOf("infantry-regiment").id, unitId: unit("trainee") }];
    expect(recruits(limited(fighters + 1), { ...rich, training })).toEqual([]);
    const worn: GameState = { ...rich, units: Object.fromEntries(Object.entries(rich.units).map(([id, entry]) => [id, { ...entry, strength: Math.round(entry.strength / 2) }])) };
    expect(planReplenishment(context(limited(0), worn)).length).toBeGreaterThan(0);
  });

  it("recruits the trucks and aircraft a turn it is told to, one of each by default", () => {
    // The opening board with a rich Republic: Valencia's foot has an attack worth reaching by road.
    const roads = spainWithAir();
    const flush = funded(initialGameState(roads), republic, 200, 60);
    const trucks = (trucksPerTurn: number | undefined) => recruits(playing(roads, republic, { recruits: { trucksPerTurn } }), flush).filter((id) => id === "truck-column").length;
    expect([undefined, 0, 1].map(trucks)).toEqual([1, 0, 1]);
    expect(trucks(9)).toBeGreaterThanOrEqual(1);
    const airy = spainWithAir();
    const state = funded(initialGameState(airy), republic, 400, 100);
    const aircraft = (overrides: Partial<AiProfile["recruits"]>) => recruits(playing(airy, republic, { recruits: overrides }), state)
      .filter((id) => airy.unitTypes.find((type) => type.id === id)?.air !== undefined).length;
    expect(aircraft({})).toBeLessThanOrEqual(1);
    expect(aircraft({ aircraftPerTurn: 1 })).toBe(aircraft({}));
    const keen = { typeWorth: { "bomber-squadron": 50, "fighter-squadron": 50 } };
    expect(aircraft({ ...keen, aircraftPerTurn: 0 })).toBe(0);
    expect(aircraft({ ...keen, aircraftPerTurn: 1 })).toBe(1);
    expect(aircraft({ ...keen, aircraftPerTurn: 3 })).toBeGreaterThan(1);
  });
});

describe("what a persona attacks", () => {
  it("adds what a rival's territory pays to its stake, and nothing on its own, contested or unheld ground", () => {
    const state = heldWhole(scenario, { andalucia: "north", asturias: "republic", galicia: "republic" }, [["rep-vitoria-8", "republic", "madrid"]]);
    const contested: GameState = { ...state, control: { ...state.control, [territory("galicia")]: { factionIds: [north, republic], kind: "contested" } } };
    const stakes = (income: number | undefined, on = state) => {
      const { deniedShare, stake } = assess(playing(scenario, north, { stakes: { income } }), on, north);
      return { share: (id: string) => deniedShare(territory(id)), stake: (id: string) => stake(territory(id)) };
    };
    const [plain, zero, keen] = [stakes(undefined), stakes(0), stakes(2)];
    const paid = territoryIncome(scenario, state, territory("asturias"));
    // What contesting it stops is what the engine stops paying its holder.
    const without: GameState = { ...state, subTerritories: Object.fromEntries(Object.entries(state.subTerritories).map(([id, site]) => [id, scenario.index.subTerritories.get(id as never)?.territoryId === territory("asturias") ? { ...site, holder: north } : site])) };
    const total = (amounts: Resources) => Object.values(amounts).reduce((sum, value) => sum + value, 0);
    expect(paid).toBeCloseTo(total(incomeFor(scenario, state, republic).gross) - total(incomeFor(scenario, without, republic).gross), 9);
    expect(paid).toBeGreaterThan(0);
    expect(zero.stake("asturias")).toBe(plain.stake("asturias"));
    expect(keen.stake("asturias")).toBeGreaterThan(plain.stake("asturias"));
    expect(keen.share("asturias")).toBeCloseTo((keen.stake("asturias") - plain.stake("asturias")) / keen.stake("asturias"), 9);
    expect(keen.stake("andalucia")).toBe(plain.stake("andalucia"));
    expect([plain.share("asturias"), keen.share("andalucia")]).toEqual([0, 0]);
    expect(stakes(2, contested).stake("galicia")).toBe(stakes(undefined, contested).stake("galicia"));
    const split = scenario.index.subTerritoriesByTerritory.get(territory("galicia"))![0]!.id;
    expect(territoryIncome(scenario, { ...state, subTerritories: { ...state.subTerritories, [split]: { ...state.subTerritories[split]!, holder: south } } }, territory("galicia"))).toBe(0);
  });

  /** The Northern attack on Asturias from Galicia with up to three regiments, for `times` its stake. */
  function attackOn(on: Scenario, times: number) {
    const armies = ["north-zamora-29", "north-san-marcial-22", "north-san-quintin-25"];
    const state = heldWhole(on, Object.fromEntries(on.territories.map(({ id }) => [id, id === "asturias" ? "republic" : "north"])), [...armies.map((id) => [id, "north", "galicia"] as const), ["rep-santander-column", "republic", "asturias"]]);
    const assessment = assess(on, state, north);
    const own = Object.values(state.units).filter((entry) => entry.factionId === north);
    const plan = createPlan(assessment, own, () => false);
    const best = bestAttackOn({ assessment, factionId: north, moveBias: () => 0, plan, prize: (id) => times * assessment.stake(id), scenario: on, state, weights: assessment.profile.computer }, territory("asturias"), own);
    return { armies: best?.armies.length, estimate: estimateAttack(on, state, north, armies.map(unit), territory("asturias")), score: best?.score ?? 0, stake: assessment.stake(territory("asturias")) };
  }

  it("counts the income any ground stops in full, where part of the rest of a prize counts half", () => {
    const on = pinned(scenario);
    const [plain, zero, keen] = [undefined, 0, 1].map((income) => attackOn(playing(on, north, { stakes: { ...requireAiProfile(on, north).stakes, income } }), 2)) as [ReturnType<typeof attackOn>, ReturnType<typeof attackOn>, ReturnType<typeof attackOn>];
    if (keen.estimate.kind !== "battle") throw new Error("Asturias is defended.");
    expect([plain.armies, keen.armies]).toEqual([3, 3]);
    expect(zero).toEqual(plain);
    expect(keen.estimate.gainChance).toBeGreaterThan(keen.estimate.takeChance);
    expect(keen.score - plain.score).toBeCloseTo(2 * (keen.stake - plain.stake) * keen.estimate.gainChance, 9);
  });

  it("sends the least force that still scores best with thrift, and everything that helps without", () => {
    const on = pinned(scenario);
    const sent = (thrift: number | undefined, times = 2) => attackOn(playing(on, north, { offensive: { ...requireAiProfile(on, north).offensive, thrift } }), times);
    expect(sent(0)).toEqual(sent(undefined));
    expect([sent(0).armies, sent(0.5).armies]).toEqual([3, 2]);
    // Four points of attack a regiment.
    expect(sent(0.1).score).toBeCloseTo(sent(0).score - 0.1 * 12, 9);
    // Walking into empty ground costs nothing: the weakest army goes, whatever the thrift.
    const walk = (thrift: number) => {
      const empty = board(on, "north", ["asturias"], [["north-zamora-29", "north", "galicia"], ["rep-vitoria-8", "republic", "madrid"]], []);
      const thriftyOn = playing(on, north, { offensive: { thrift } });
      const state: GameState = { ...empty, control: { ...empty.control, [territory("asturias")]: { factionId: republic, kind: "controlled" } } };
      const assessment = assess(thriftyOn, state, north);
      const own = Object.values(state.units).filter((entry) => entry.factionId === north);
      return bestAttackOn({ assessment, factionId: north, moveBias: () => 0, plan: createPlan(assessment, own), prize: () => 10, scenario: thriftyOn, state, weights: assessment.profile.computer }, territory("asturias"), own)?.score;
    };
    expect(walk(5)).toBe(walk(0));
  });
});

describe("a persona that never builds", () => {
  it("orders no build of any kind and holds nothing back for one, for every side", () => {
    const rich = (on: Scenario): GameState => {
      const opening = initialGameState(on);
      const wrecked = Object.fromEntries(Object.entries(opening.subTerritories).map(([id, site]) => [id, { ...site, rail: Math.max(0, site.rail - 1) }]));
      return on.factions.reduce((state, player) => funded(state, player.id, 60, 60), { ...opening, subTerritories: wrecked });
    };
    const builds = (on: Scenario, state: GameState) => on.factions.map((player) => generateComputerSubmission(on, state, player.id, seededRandom(1)).orders.filter((order) => order.kind === "build").length);
    const plain = loadScenario(scenarioSources(), spainId);
    expect(builds(plain, rich(plain)).every((count) => count > 0)).toBe(true);
    for (const id of ["no-build", "rush"]) {
      const on = seated({ north: id, republic: id, south: id });
      expect(builds(on, rich(on))).toEqual([0, 0, 0]);
      expect(builds(on, initialGameState(on))).toEqual([0, 0, 0]);
      for (const player of on.factions) {
        expect(Object.values(buildReserve(context(on, rich(on), player.id), { funds: 60, manpower: 60 } as Resources)).every((amount) => amount === 0)).toBe(true);
      }
    }
  });
});
