import { describe, expect, it } from "vitest";
import { alarmAt, pressingRivals, stepsShort } from "../main/ai/alarm";
import { assess, type Assessment } from "../main/ai/assessment";
import { bestAttackOn, type AttackContext } from "../main/ai/attacks";
import { generateComputerSubmission } from "../main/ai/computerPlayer";
import { createPlan } from "../main/ai/plan";
import { estimateAttack } from "../main/engine/combat";
import { generalUnitDefinition } from "../main/engine/generals/identity";
import { seededRandom } from "../main/engine/random";
import { type GameState, isMoveOrder, type Scenario, type UnitState } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { heldWhole, into, oneShortOwners, ordersOf, type Placement } from "./aiBoards";
import { armyIn, faction, spain, territory, tiny, unit, withUnits } from "./support";
import { pinned } from "./pinned";

// D6: how the computer player meets a rival one or two steps from winning, human or not.

const north = faction("north");
const republic = faction("republic");
const viewOf = (scenario: Scenario, state: GameState, factionId = north): Assessment => assess(scenario, state, factionId);
const base = ({ profile }: Assessment, cities: number, objective = false): number =>
  profile.stakes.territory + cities * profile.stakes.city + (objective ? profile.stakes.objective : 0);
const citiesOf = (scenario: Scenario, id: string): number => scenario.cities.filter((city) => city.territoryId === id && city.countsForVictory).length;

/** Two Northern regiments in Galicia, which the Republic would win by taking, beside a Republican regiment in Asturias. */
const border: Placement = [
  ["north-zamora-29", "north", "galicia"],
  ["north-san-marcial-22", "north", "galicia"],
  ["rep-santander-column", "republic", "asturias"],
  ["rep-madrid-security", "republic", "madrid"]
];

/** Every other border held: no empty ground to walk into, and no army of the North's without a place to guard. */
const held: Placement = [
  ...border,
  ["rep-basque-column", "republic", "cantabria"], ["rep-covadonga-4", "republic", "cantabria"],
  ["rep-vitoria-8", "republic", "pais-vasco"], ["rep-sevilla-34", "republic", "pais-vasco"],
  ["rep-castilla-3", "republic", "castilla-la-mancha"], ["rep-otumba-9", "republic", "castilla-la-mancha"],
  ["rep-guadalajara-10", "republic", "catalunya"], ["rep-wad-ras-1", "republic", "catalunya"],
  ["rep-catalan-columns", "republic", "valencia"], ["rep-durruti-column", "republic", "extremadura"],
  ["north-san-quintin-25", "north", "castilla-y-leon"], ["north-america-23", "north", "navarra"],
  ["north-aragon-17", "north", "aragon"], ["north-flandes-5", "north", "la-rioja"]
];

describe("striking a leader one step from victory (D6)", () => {
  it("weighs the leader's ground as much as its own deciding ground, at one step and at two", () => {
    const { profile } = viewOf(tiny(), withUnits(tiny(), []), faction("blue"));
    expect(alarmAt(profile, 1)).toBe(profile.victoryAlarm.critical);
    expect(alarmAt(profile, 2)).toBe(1.5);
    expect(alarmAt(profile, 3)).toBe(0);
  });

  it("attacks the leader's ground at 1:1 and above instead of holding, in either scenario", () => {
    for (const scenario of [spain(), pinned(spain())]) {
      const state = heldWhole(scenario, oneShortOwners, held);
      const view = viewOf(scenario, state);
      expect(view.isCritical(territory("galicia"))).toBe(true);
      const { attack, defence } = estimateAttack(scenario, state, north, ["north-zamora-29", "north-san-marcial-22"].map(unit), territory("asturias")) as { attack: number; defence: number };
      expect(attack).toBeGreaterThanOrEqual(defence);
      for (const seed of [1, 2, 3]) {
        const orders = ordersOf(scenario, state, "north", seed);
        const struck = into(orders, "asturias");
        const odds = estimateAttack(scenario, state, north, struck.map(unit), territory("asturias")) as { attack: number; defence: number };
        expect(odds.attack).toBeGreaterThanOrEqual(odds.defence);
        // The attack takes one territory off the leader's count, so it may open one to it, and no more.
        const left = new Set(orders.map((order) => order.unitId));
        const opened = Object.keys(oneShortOwners).filter((id) => view.isCritical(territory(id)) && !orders.some((order) => order.to === territory(id))
          && Object.values(state.units).every((entry) => entry.factionId !== north || entry.territoryId !== id || left.has(entry.id)));
        expect(opened.length).toBeLessThanOrEqual(1);
      }
    }
    // Tiny Front: Red is one territory short, its Highlands held at 1:1, and the Lowlands are nobody's.
    const scenario = { ...tiny(), victory: { ...tiny().victory, cityShare: 1 } };
    const start = withUnits(scenario, [["blue-marines", "blue", "harbor"], ["red-guard", "red", "highlands"]]);
    const state: GameState = { ...start, control: { ...start.control, [territory("lowlands")]: { kind: "contested", factionIds: [] } }, units: { ...start.units, [unit("red-guard")]: { ...armyIn(start, "red-guard"), strength: 400 } } };
    expect(into(ordersOf(scenario, state, "blue"), "highlands")).toEqual(["blue-marines"]);
  });

  it("lifts the pin on deciding ground only for an attack on the side that would win by taking it", () => {
    const scenario = pinned(spain());
    const state = heldWhole(scenario, { ...oneShortOwners, "castilla-y-leon": "south" }, [...border.slice(0, 1), ["rep-santander-column", "republic", "asturias"], ["rep-basque-column", "republic", "cantabria"], ["south-legion", "south", "castilla-y-leon"]]);
    const view = viewOf(scenario, state);
    const plan = createPlan(view, Object.values(state.units).filter((entry) => entry.factionId === north));
    const zamora = armyIn(state, "north-zamora-29");
    expect(view.isCritical(territory("galicia"))).toBe(true);
    expect(view.strikesThreat(territory("galicia"), territory("asturias"))).toBe(true);
    expect(view.strikesThreat(territory("galicia"), territory("castilla-y-leon"))).toBe(false);
    expect(plan.exposure([zamora])).toBeUndefined();
    expect(plan.exposure([zamora], territory("castilla-y-leon"))).toBeUndefined();
    expect(plan.exposure([zamora], territory("asturias"))).toBeGreaterThan(0);
    // Another front of the leader's counts too: the threat need not stand there.
    expect(plan.exposure([zamora], territory("madrid"))).toBeGreaterThan(0);
  });

  it("alarms ground a third side holds, and ground it contests, when the leader would win by taking it", () => {
    const scenario = pinned(spain());
    const state = heldWhole(scenario, oneShortOwners, border);
    const south = viewOf(scenario, state, faction("south"));
    const raised = 1 + south.profile.victoryAlarm.critical;
    // The North's Galicia, in reach of the miners; not its Navarra, which no Republican reaches, nor critical (the South holds none of it).
    expect(south.stake(territory("galicia"))).toBe(base(south, citiesOf(scenario, "galicia")) * raised);
    expect(south.isCritical(territory("galicia"))).toBe(false);
    const safe = viewOf(scenario, heldWhole(scenario, oneShortOwners, border.slice(0, 2)), faction("south"));
    expect(safe.stake(territory("galicia"))).toBe(base(safe, citiesOf(scenario, "galicia")));
    // Ground the leader shares with a third side: raised, though it controls none of it whole.
    const shared: GameState = { ...state, control: { ...state.control, [territory("navarra")]: { factionIds: [north, republic], kind: "contested" } } };
    const other = viewOf(scenario, shared, faction("south"));
    expect(other.stake(territory("navarra"))).toBe(base(other, citiesOf(scenario, "navarra")) * raised);
    expect(other.spoils(territory("navarra"))).toBe(false);
    expect(other.spoils(territory("asturias"))).toBe(true);
  });

  it("alarms two territories the leader can take together when it is two short, with an army for each", () => {
    const scenario = pinned(spain());
    const owners = { ...oneShortOwners, extremadura: "south" };
    const two: Placement = [["rep-asturian-militia", "republic", "asturias"], ["rep-santander-column", "republic", "cantabria"]];
    const state = heldWhole(scenario, owners, two);
    expect(stepsShort(victoryProgress(scenario, state).find((entry) => entry.factionId === republic)!)).toBe(2);
    const view = viewOf(scenario, state);
    for (const id of ["galicia", "castilla-y-leon", "la-rioja"]) {
      expect(view.stake(territory(id)), id).toBe(base(view, citiesOf(scenario, id)) * (1 + alarmAt(view.profile, 2)));
      // It takes both to win, so neither pins an army.
      expect(view.isCritical(territory(id))).toBe(false);
    }
    const alone = viewOf(scenario, heldWhole(scenario, owners, two.slice(0, 1)));
    expect(alone.stake(territory("galicia"))).toBe(base(alone, citiesOf(scenario, "galicia")));
  });

  it("never leaves both of two deciding territories empty when the leader is two short, unless one opens to strike it", () => {
    const scenario = pinned(spain());
    const owners = { ...oneShortOwners, extremadura: "south" };
    const garrisons: Placement = [["north-zamora-29", "north", "galicia"], ["north-san-marcial-22", "north", "castilla-y-leon"], ["north-san-quintin-25", "north", "la-rioja"], ["north-america-23", "north", "navarra"]];
    const state = heldWhole(scenario, owners, [["rep-asturian-militia", "republic", "asturias"], ["rep-santander-column", "republic", "cantabria"], ...garrisons]);
    const assessment = viewOf(scenario, state);
    expect([...assessment.criticalWith(territory("galicia"))].sort()).toEqual(["castilla-y-leon", "la-rioja", "navarra"]);
    expect(assessment.criticalWith(territory("asturias"))).toEqual([]);
    // A pair reads the same from either side, and ground that would win alone is no half of one.
    for (const id of assessment.criticalWith(territory("galicia"))) expect(assessment.criticalWith(id), id).toContain(territory("galicia"));
    const oneShort = viewOf(scenario, heldWhole(scenario, oneShortOwners, [["rep-asturian-militia", "republic", "asturias"], ["rep-santander-column", "republic", "cantabria"], ...garrisons]));
    expect(oneShort.isCritical(territory("galicia"))).toBe(true);
    expect(oneShort.criticalWith(territory("galicia"))).toEqual([]);
    // One army in reach of both cannot take both.
    expect(viewOf(scenario, heldWhole(scenario, owners, [["rep-asturian-militia", "republic", "asturias"], ...garrisons])).criticalWith(territory("galicia"))).toEqual([]);
    const own = Object.values(state.units).filter((entry) => entry.factionId === north);
    const at = (id: string): UnitState => own.find((entry) => entry.id === id)!;
    const plan = createPlan(assessment, own);
    // One may go, since the leader needs both.
    expect(plan.exposure([at("north-zamora-29")])).toBeDefined();
    // Not both in the same attack, nor the second once the first has gone.
    expect(plan.exposure([at("north-zamora-29"), at("north-san-marcial-22")])).toBeUndefined();
    plan.commit(at("north-zamora-29"), territory("navarra"), true);
    expect(plan.exposure([at("north-san-marcial-22")])).toBeUndefined();
    expect(plan.exposure([at("north-san-marcial-22")], territory("ceuta"))).toBeUndefined();
    // The second may open to strike the leader, and then no other.
    expect(plan.exposure([at("north-san-marcial-22")], territory("asturias"))).toBeDefined();
    plan.commit(at("north-san-marcial-22"), territory("asturias"), false);
    expect(plan.opensCritical()).toBe(true);
    expect(plan.exposure([at("north-san-quintin-25")], territory("asturias"))).toBeUndefined();
  });

  it("steps into one of two empty deciding territories when the leader is two short", () => {
    const scenario = pinned(spain());
    const owners = { ...oneShortOwners, extremadura: "south" };
    const reachers: Placement = [["rep-asturian-militia", "republic", "asturias"], ["rep-santander-column", "republic", "cantabria"]];
    const state = heldWhole(scenario, owners, [...reachers, ["north-zamora-29", "north", "castilla-y-leon"], ["north-san-marcial-22", "north", "castilla-y-leon"], ["north-san-quintin-25", "north", "castilla-y-leon"]]);
    const decided = ["galicia", "castilla-y-leon", "la-rioja", "navarra"];
    expect(viewOf(scenario, state).criticalWith(territory("galicia"))).toContain(territory("la-rioja"));
    const moves = generateComputerSubmission(scenario, state, north, seededRandom(3)).orders.filter(isMoveOrder);
    // Three of the four stood empty. It fills two; the third army may open its own ground to strike the leader.
    expect(moves.filter((order) => decided.includes(order.to)).map((order) => order.to).sort()).toEqual(["galicia", "navarra"]);
  });

  it("counts a foothold that spoils the leader's territory in full, and its own losses less", () => {
    // 2:1 into a dug-in regiment: a fifth to take Asturias whole, a half to gain ground there.
    const plain = pinned(spain());
    const scenario: Scenario = { ...plain, d20: { ...plain.d20, modifiers: { ...plain.d20.modifiers, barricades: 0, worksPerTurn: 3 } } };
    const armies = ["north-zamora-29", "north-san-marcial-22", "north-san-quintin-25"];
    const placed: Placement = [...armies.map((id) => [id, "north", "galicia"] as const), ["rep-santander-column", "republic", "asturias"]];
    const dug = (state: GameState): GameState => ({ ...state, fortification: { [territory("asturias")]: { factionId: republic, level: 1 } } });
    const score = (owners: Readonly<Record<string, string>>) => {
      const state = dug(heldWhole(scenario, owners, placed));
      const estimate = estimateAttack(scenario, state, north, armies.map(unit), territory("asturias"));
      const assessment = viewOf(scenario, state);
      const own = Object.values(state.units).filter((entry) => entry.factionId === north);
      const context: AttackContext = {
        assessment, factionId: north, moveBias: () => 0, plan: createPlan(assessment, own), prize: () => 10,
        scenario, state, weights: assessment.profile.computer
      };
      return { assessment, estimate, score: bestAttackOn(context, territory("asturias"), own)?.score ?? 0 };
    };
    const near = score(oneShortOwners);
    expect(near.estimate).toMatchObject({ gainChance: 0.5, oddsLabel: "2:1", takeChance: 0.2 });
    expect(near.assessment.risk(territory("asturias"))).toBe(near.assessment.profile.victoryAlarm.riskFloor);
    expect(near.assessment.risk(territory("ceuta"))).toBe(1);
    expect(near.score).toBeGreaterThan(0);
    // Three steps from victory, the same prize at the same odds counts the foothold at half.
    const far = score({ ...oneShortOwners, catalunya: "south", extremadura: "south", murcia: "south", valencia: "south" });
    expect(far.assessment.spoils(territory("asturias"))).toBe(false);
    expect(far.score).toBeLessThan(near.score);
  });

  it("takes no general or truck column next door for a threat", () => {
    const scenario = pinned(spain());
    const empty = heldWhole(scenario, oneShortOwners, border.slice(0, 2));
    const truck = { ...scenario.units.find((entry) => entry.id === "rep-santander-column")!, id: unit("rep-trucks"), type: "truck-column" as never };
    const general = generalUnitDefinition(scenario, unit("general-vicente-rojo"))!;
    const at = (id: string): UnitState => ({ ...armyIn(withUnits(scenario, [["rep-santander-column", "republic", "asturias"]]), "rep-santander-column"), id: unit(id) });
    const state: GameState = { ...empty, raised: { ...empty.raised, [truck.id]: truck, [general.id]: general }, units: { ...empty.units, [truck.id]: at(truck.id), [general.id]: at(general.id) } };
    const view = viewOf(scenario, state);
    expect(view.isCritical(territory("galicia"))).toBe(false);
    expect(view.danger(territory("galicia"), 0)).toBe(0);
    expect(view.relief(territory("cantabria"))).toBeUndefined();
    expect(view.threatOrigins(territory("galicia")).size).toBe(0);
  });

  it("gives the same orders whoever plays the leader, and for the same seed", () => {
    const scenario = spain();
    const state = heldWhole(scenario, oneShortOwners, border);
    const plan = (actor: "computer" | "local-human") => {
      const played: Scenario = { ...scenario, factions: scenario.factions.map((entry) => (entry.id === republic ? { ...entry, defaultActor: actor } : entry)) };
      return generateComputerSubmission(played, state, north, seededRandom(7)).orders;
    };
    expect(plan("local-human")).toEqual(plan("computer"));
    expect(plan("computer")).toEqual(plan("computer"));
    expect(plan("computer").some(isMoveOrder)).toBe(true);
  });

  it("names the rivals it spends against: two steps short or nearer", () => {
    const scenario = pinned(spain());
    const pressing = (owners: Readonly<Record<string, string>>) => {
      const state = heldWhole(scenario, owners, border);
      return [...pressingRivals(scenario, state, north, viewOf(scenario, state).profile)];
    };
    expect(pressing(oneShortOwners)).toEqual([republic]);
    expect(pressing({ ...oneShortOwners, extremadura: "south" })).toEqual([republic]);
    expect(pressing({ ...oneShortOwners, catalunya: "south", extremadura: "south", valencia: "south" })).toEqual([]);
  });
});
