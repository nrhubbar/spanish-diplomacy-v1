import { isGroundUnit, territoriesWithin, unitKindIn, unitTypeIn } from "../engine/air/pieces";
import { validateAirMission } from "../engine/air/validation";
import { compareIds } from "../engine/board";
import { requireSubTerritory } from "../engine/lookup";
import { estimateAttack } from "../engine/combat";
import { landNeighbors } from "../engine/movement/network";
import { bestGeneral } from "../engine/generals/command";
import { moveRoutes, type MoveRoute } from "../engine/movement/routes";
import { judgePlannedMoves } from "../engine/movement/transit";
import type { MoveMode } from "../engine/network/reach";
import { pocketOfArmy } from "../engine/partition/pockets";
import { type AirMissionOrder, type FactionId, type GameState, isMoveOrder, type MoveLeg, type MoveOrder, type SackOrder, type Scenario, type TerritoryId, type SubTerritoryId, type UnitId, type UnitState, type WithdrawOrder } from "../engine/types";
import { canFight, isTruckType } from "../engine/units/fighting";
import { armyFigures, figuresWorks, menLabel, strengthShare, valuesLabel } from "./army";
import { generalWords } from "./generals";
import { glyphs } from "./glyphs";
import { type ModeChip, modeNames, type ModeOption, modeOptions } from "./moveModes";
import { fitMuster } from "./musterFit";
import { attackEstimate, chanceTone, movesInto, moveTo, type OddsTone, percent, plannedSupport, signed } from "./odds";
import { type RollLedgerData, rollLedger, withPlannedAir } from "./rollLedger";
import { factionName, listNames, territoryName, unitName } from "./text";

/**
 * U6: the Invade and Reinforce panes as data: every unit that can reach the target, grouped by
 * the territory it leaves, with its move modes; the units already there; the aircraft that can
 * fly Ground Support; and the odds (Invade) or the defence (Reinforce) for the units ticked.
 * The components only draw this.
 */

export type MusterKind = "invade" | "reinforce";

/** What the planner has drafted so far, as the panes read it. */
export interface MusterDraft {
  readonly airOrders?: readonly (AirMissionOrder | SackOrder)[];
  readonly orders: readonly (MoveOrder | WithdrawOrder)[];
}

/** A unit's own figures, as every card of the pane shows them. */
export interface UnitFigures {
  /** R8: the works it stands behind, as "Dug in 1 · −2" (the change to an attacker's roll). */
  readonly dugIn?: string;
  readonly men: string;
  readonly name: string;
  /** Men as a share of full strength, 0 to 1. */
  readonly share: number;
  readonly unitId: UnitId;
  readonly values: string;
}

/** What the pane has ticked: units with their chosen modes, and aircraft. */
export interface MusterPicks {
  readonly modes: ReadonlyMap<UnitId, MoveMode>;
  /** Units unticked by hand, which nothing else takes along. */
  readonly off?: ReadonlySet<UnitId>;
  readonly support: ReadonlySet<UnitId>;
  /** In the order they were ticked: earlier ones keep their train places. */
  readonly units: ReadonlySet<UnitId>;
}

/** The card of a unit that can go. Its `dugIn` works are given up by leaving (R8). */
export interface MusterCard extends UnitFigures {
  /** Why it can't be ticked now: no mode has room for it, or no army goes its way. */
  readonly blocked?: string;
  /** It carries units by Motor and can't fight (a truck). */
  readonly carrier: boolean;
  /** The mode it goes by, or would go by when ticked. */
  readonly chosen: MoveMode;
  /** It can't go there alone: it goes with a unit that can fight, the same way. */
  readonly companion: boolean;
  readonly general: boolean;
  /** N10: what a general does to the battle roll, in the words his unit card uses. */
  readonly note?: string;
  /** Every mode it could take, with all its ways there. */
  readonly options: readonly ModeOption[];
  /** What it adds: attack (Invade) or defence (Reinforce); a general, his change to the roll. */
  readonly strength: number;
  /** The mode its card starts on: the one it is ordered by already, else the one the game offers. */
  readonly defaultMode: MoveMode;
  readonly from: TerritoryId;
  readonly modes: readonly ModeChip[];
  /** Its other order this turn, which ticking it replaces, e.g. "Ordered: move to Murcia". */
  readonly otherOrder?: string;
  /** Already ordered to the target, so the card starts ticked. */
  readonly ordered: boolean;
}

export interface MusterGroup {
  readonly cards: readonly MusterCard[];
  readonly from: TerritoryId;
  readonly title: string;
  /** The places used on the trains its units could board: "Rail: 3 of 4 places". */
  readonly trains: readonly string[];
}

/** A unit of the side already in the target: it stays where it stands. */
export interface HereCard {
  readonly name: string;
  readonly note: string;
  readonly unitId: UnitId;
  readonly values: string;
}

/** An aircraft that can fly Ground Support over the target. */
export interface SupportCard {
  readonly base: string;
  readonly name: string;
  /** Its other mission this turn, which ticking it replaces. */
  readonly otherMission?: string;
  /** Already on Ground Support over the target, so the card starts ticked. */
  readonly ordered: boolean;
  readonly typeName: string;
  readonly unitId: UnitId;
}

/** A unit the pane sends: the legs of its move, or none for a plain step (CT-6). */
export interface MusterMove {
  readonly legs?: readonly MoveLeg[];
  readonly unitId: UnitId;
}

/** The other sides' ground units in the target, with the sum of their defence. */
export interface MusterDefenders {
  readonly cards: readonly UnitFigures[];
  readonly defence: number;
}

export interface Muster {
  /** Invade only. */
  readonly defenders: MusterDefenders;
  readonly groups: readonly MusterGroup[];
  readonly here: readonly HereCard[];
  readonly kind: MusterKind;
  /** The units that go as the pane stands: those ticked that can, and the trucks they need. */
  readonly picks: MusterPicks;
  readonly subtitle: string;
  readonly support: readonly SupportCard[];
  /** The most aircraft whose Ground Support counts (the scenario's cap); absent means no cap. */
  readonly supportMax?: number;
  readonly target: TerritoryId;
}

/** A unit's type name, raised in play or not. */
export function typeNameOf(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): string {
  return unitTypeIn(scenario, state.raised, unitId)?.name ?? "Unit";
}

/** A sub-territory's name. */
export function subName(scenario: Scenario, id: SubTerritoryId): string {
  return requireSubTerritory(scenario, id).name;
}

/**
 * The planned moves that use room a unit going to `target` may need: all but rides to the target
 * itself, which the pane is there to change. Their trains are counted whole when it gives its
 * order (`boardingRefusal`, D5).
 */
function movesElsewhere(draft: MusterDraft, target: TerritoryId): readonly MoveOrder[] {
  return draft.orders.filter((order): order is MoveOrder => order.kind === "move" && !(order.to === target && (order.legs ?? []).some((leg) => leg.kind === "rail")));
}

/** The side's ground units that can reach `target` this turn, with the route the game offers each. */
export function reachingUnits(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, draft: MusterDraft): readonly { readonly route: MoveRoute; readonly unit: UnitState }[] {
  const planned = movesElsewhere(draft, target);
  return Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && unit.territoryId !== target && isGroundUnit(scenario, state.raised, unit.id))
    .sort((a, b) => compareIds(a.id, b.id))
    .flatMap((unit) => {
      const route = moveRoutes(scenario, state, factionId, unit.territoryId, [unit.id], planned).get(target);
      return route === undefined ? [] : [{ route, unit }];
    });
}

/** Ground the side holds in the target: "friendly", "contested" (it shares it) or "enemy". */
export type Ground = "friendly" | "contested" | "enemy";

export function groundOf(state: Pick<GameState, "control">, factionId: FactionId, territoryId: TerritoryId): Ground {
  const control = state.control[territoryId];
  if (control?.kind === "controlled" && control.factionId === factionId) return "friendly";
  return control?.kind === "contested" && control.factionIds.includes(factionId) ? "contested" : "enemy";
}

function otherOrderOf(scenario: Scenario, draft: MusterDraft, unitId: UnitId, target: TerritoryId): string | undefined {
  const order = draft.orders.find((each) => each.unitId === unitId);
  if (order === undefined || order.to === target) return undefined;
  return `${order.kind === "withdraw" ? "Ordered to withdraw" : "Ordered to move"} to ${territoryName(scenario, order.to)}`;
}

function legsOfOrder(order: MoveOrder | WithdrawOrder): MoveOrder["legs"] {
  return order.kind === "move" ? order.legs : undefined;
}

/** A unit's own cards for the list, and what sort of unit it is. */
interface Listed {
  readonly companion: boolean;
  readonly route: MoveRoute;
  readonly unit: UnitState;
}

/**
 * Every unit of the side that could go to `target`, with the route the game offers it. Room on
 * trains is judged later, as units are ticked (`fitMuster`). A unit on foot may reach it with the
 * transport in its territory, as Move lets it. Units that can't fight (generals, trucks, anti-air)
 * and don't reach it on their own are listed where a unit that can fight sets out, to go with it.
 */
function listedUnits(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, draft: MusterDraft): readonly Listed[] {
  const planned = movesElsewhere(draft, target).filter((order) => !(order.legs ?? []).some((leg) => leg.kind === "rail"));
  const units = Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && unit.territoryId !== target && unitKindIn(scenario, state.raised, unit.id) !== "air")
    .sort((a, b) => compareIds(a.id, b.id));
  const routeOf = (from: TerritoryId, unitIds: readonly UnitId[]): MoveRoute | undefined => moveRoutes(scenario, state, factionId, from, unitIds, planned).get(target);
  const carriersIn = (from: TerritoryId): readonly UnitId[] => units.filter((each) => each.territoryId === from && isCarrier(scenario, state, each.id)).map((each) => each.id);
  const leads = units.flatMap((unit): Listed[] => {
    const carriers = canFight(scenario, state.raised, unit.id) ? carriersIn(unit.territoryId) : [];
    const route = routeOf(unit.territoryId, [unit.id]) ?? (carriers.length === 0 ? undefined : routeOf(unit.territoryId, [unit.id, ...carriers]));
    return route === undefined ? [] : [{ companion: false, route, unit }];
  });
  const alone = new Set(leads.map(({ unit }) => unit.id));
  const companions = units.filter((unit) => !alone.has(unit.id) && !canFight(scenario, state.raised, unit.id) && !unit.morale.demoralized).flatMap((unit): Listed[] => {
    const lead = leads.find((each) => each.unit.territoryId === unit.territoryId && canFight(scenario, state.raised, each.unit.id));
    return lead === undefined ? [] : [{ companion: true, route: lead.route, unit }];
  });
  return [...leads, ...companions];
}

function isCarrier(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): boolean {
  const type = unitTypeIn(scenario, state.raised, unitId);
  return type !== undefined && isTruckType(type);
}

/** The modes a listed unit could take. A companion's are its own ways along the offered route's modes; Motor only where the transport there could carry it. */
function optionsFor(scenario: Scenario, state: GameState, factionId: FactionId, { companion, route, unit }: Listed): readonly ModeOption[] {
  const options = modeOptions(scenario, state, factionId, unit.id, route);
  if (companion) return options;
  const carriers = Object.values(state.units)
    .filter((each) => each.factionId === factionId && each.territoryId === unit.territoryId && each.id !== unit.id && isCarrier(scenario, state, each.id))
    .map((each) => each.id);
  return options.map((option) => {
    if (option.mode !== "motor") return option;
    const ways = option.ways.filter((legs) => {
      const orders = [unit.id, ...carriers].map((id) => moveTo(factionId, id, unit.territoryId, route.to, legs));
      return judgePlannedMoves(scenario, state, orders).every(({ cause }) => cause?.reason !== "allowance");
    });
    return { ...option, reason: option.ways.length > 0 ? "Motor needs trucks for every unit on foot, or cavalry, and dry roads." : option.reason, ways };
  });
}

function card(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, kind: MusterKind, draft: MusterDraft, listed: Listed): MusterCard {
  const { companion, route, unit } = listed;
  const options = optionsFor(scenario, state, factionId, listed);
  const order = draft.orders.find((each) => each.unitId === unit.id && each.to === target);
  const orderedKey = order === undefined ? undefined : legsKey(legsOfOrder(order));
  const orderedMode = options.find((option) => option.ways.some((way) => legsKey(way) === orderedKey))?.mode;
  const otherOrder = otherOrderOf(scenario, draft, unit.id, target);
  const role = kind === "invade" ? "attack" : "defence";
  const words = generalWords(scenario, state.raised, unit.id);
  const commander = bestGeneral(scenario, state.raised, [unit.id], role);
  const roll = commander === undefined ? 0 : commander.bonus + commander.traitRoll;
  const figures = armyFigures(scenario, state, unit);
  return {
    ...unitFigures(scenario, state, unit),
    carrier: isCarrier(scenario, state, unit.id),
    chosen: orderedMode ?? route.mode,
    companion,
    defaultMode: orderedMode ?? route.mode,
    from: unit.territoryId,
    general: commander !== undefined,
    // The way it is ordered by leads its mode, so the card shows that very order.
    modes: [],
    ...(words === undefined ? {} : { note: `General ${glyphs.dot} ${words.effect}` }),
    options: options.map((option) => ({ ...option, ways: [...option.ways].sort((a, b) => Number(legsKey(b) === orderedKey) - Number(legsKey(a) === orderedKey)) })),
    ...(otherOrder === undefined ? {} : { otherOrder }),
    ordered: order !== undefined,
    strength: commander === undefined ? figures[role] : roll
  };
}

function unitFigures(scenario: Scenario, state: GameState, unit: UnitState): UnitFigures {
  const figures = armyFigures(scenario, state, unit);
  const works = figuresWorks(figures);
  return {
    ...(works === undefined ? {} : { dugIn: `Dug in ${String(works.dugIn)} ${glyphs.dot} ${signed(-works.dugInRoll)}` }),
    men: `${menLabel(figures)} men`,
    name: unitName(scenario, unit.id),
    share: strengthShare(figures),
    unitId: unit.id,
    values: valuesLabel(figures.attack, figures.defence)
  };
}

/** The other sides' ground units in the target. */
function defendingUnits(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId): readonly UnitState[] {
  return Object.values(state.units)
    .filter((unit) => unit.factionId !== factionId && unit.territoryId === target && isGroundUnit(scenario, state.raised, unit.id))
    .sort((a, b) => compareIds(a.id, b.id));
}

function defendersOf(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId): MusterDefenders {
  const units = defendingUnits(scenario, state, factionId, target);
  return {
    cards: units.map((unit) => unitFigures(scenario, state, unit)),
    defence: units.reduce((sum, unit) => sum + armyFigures(scenario, state, unit).defence, 0)
  };
}

/** The Defenders group's count: "12 units, 39 defence". */
export function defendersCount({ cards, defence }: MusterDefenders): string {
  return `${unitCount(cards.length)}, ${String(defence)} defence`;
}

function unitCount(count: number): string {
  return count === 1 ? "1 unit" : `${String(count)} units`;
}

/** Why a group's units can't take some modes: one line for the whole group. */
export interface GroupModes {
  /** The one mode every unit of the group must take, when there is only one. */
  readonly only?: string;
  /** "Why not March or Motor?" */
  readonly question: string;
  /** One line per refusal, naming the units when it isn't every unit's: "March: ... (Durruti Column)". */
  readonly reasons: readonly string[];
}

export function groupModes(cards: readonly MusterCard[]): GroupModes | undefined {
  const blocked = new Map<MoveMode, Map<string, string[]>>();
  const open = new Set<MoveMode>();
  for (const { companion, modes, name } of cards) {
    for (const chip of companion ? [] : modes) {
      // A mode full for now (trains, trucks) is there; its own card says why it can't be taken.
      if (chip.ok || chip.full === true) {
        open.add(chip.mode);
        continue;
      }
      const reasons = blocked.get(chip.mode) ?? new Map<string, string[]>();
      reasons.set(chip.reason, [...(reasons.get(chip.reason) ?? []), name]);
      blocked.set(chip.mode, reasons);
    }
  }
  if (blocked.size === 0) return undefined;
  const [only] = open;
  return {
    ...(open.size === 1 && only !== undefined ? { only: `Only ${modeLabel(only)} reaches it.` } : {}),
    question: `Why not ${[...blocked.keys()].map(modeLabel).join(" or ")}?`,
    reasons: [...blocked].flatMap(([mode, reasons]) => [...reasons].map(([reason, names]) =>
      `${modeLabel(mode)}: ${reason}${names.length === cards.filter((each) => !each.companion).length ? "" : ` (${listNames(names)})`}`))
  };
}

function legsKey(legs: MoveOrder["legs"]): string {
  return (legs ?? []).map((leg) => `${leg.kind}:${leg.to}`).join(">");
}

/** The side's units already in the target, by the pocket they stand in (R1). */
function hereCards(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, ground: Ground): readonly HereCard[] {
  return Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && unit.territoryId === target && isGroundUnit(scenario, state.raised, unit.id))
    .sort((a, b) => compareIds(a.id, b.id))
    .map((unit) => {
      const figures = armyFigures(scenario, state, unit);
      const pocket = pocketOfArmy(scenario, state, unit.id);
      const place = pocket === undefined ? "" : `In ${listNames(pocket.subTerritoryIds.map((id) => subName(scenario, id)))}. `;
      const stays = ground === "contested" ? "Attacks where it stands, after the battle for the ground." : "Stays and defends.";
      return { name: unitName(scenario, unit.id), note: `${place}${stays}`, unitId: unit.id, values: valuesLabel(figures.attack, figures.defence) };
    });
}

function missionName(scenario: Scenario, order: AirMissionOrder): string {
  const names = { patrol: "Patrol", raid: "Raid", recon: "Recon", support: "Ground Support" } as const;
  const where = order.mission.kind === "raid" ? subName(scenario, order.mission.subTerritoryId) : territoryName(scenario, order.mission.territoryId);
  return `On ${names[order.mission.kind]} over ${where}`;
}

/** R10, R11: the side's aircraft that can fly Ground Support over the target (Invade only). */
function supportCards(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, draft: MusterDraft): readonly SupportCard[] {
  const flying = draft.airOrders ?? [];
  return Object.values(state.units)
    .filter((unit) => unit.factionId === factionId && unitKindIn(scenario, state.raised, unit.id) === "air")
    .sort((a, b) => compareIds(a.id, b.id))
    .filter((unit) => {
      const range = unitTypeIn(scenario, state.raised, unit.id)?.air?.range;
      return range !== undefined && territoriesWithin(scenario, unit.territoryId, range).has(target)
        && validateAirMission(scenario, state, { factionId, kind: "air-mission", mission: { kind: "support", territoryId: target }, unitId: unit.id }).ok;
    })
    .map((unit) => {
      const mission = flying.find((order): order is AirMissionOrder => order.kind === "air-mission" && order.unitId === unit.id);
      const ordered = mission?.mission.kind === "support" && mission.mission.territoryId === target;
      return {
        base: `From ${territoryName(scenario, unit.territoryId)}`,
        name: unitName(scenario, unit.id),
        ...(mission === undefined || ordered ? {} : { otherMission: missionName(scenario, mission) }),
        ordered,
        typeName: typeNameOf(scenario, state, unit.id),
        unitId: unit.id
      };
    });
}

/** U6: the Invade or Reinforce pane for `target`, as the units ticked (by default those ordered there) leave it. */
export function muster(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, kind: MusterKind, draft: MusterDraft, picks?: MusterPicks): Muster {
  const list = musterList(scenario, state, factionId, target, kind, draft);
  return fitMuster(scenario, state, factionId, list, picks ?? list.picks, draft);
}

/** The pane's units before any is ticked; `fitMuster` fits it to the units ticked. */
export function musterList(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, kind: MusterKind, draft: MusterDraft): Muster {
  const ground = groundOf(state, factionId, target);
  const groups = new Map<TerritoryId, MusterCard[]>();
  for (const listed of listedUnits(scenario, state, factionId, target, draft)) {
    const { unit } = listed;
    const made = card(scenario, state, factionId, target, kind, draft, listed);
    const cards = groups.get(unit.territoryId);
    if (cards === undefined) groups.set(unit.territoryId, [made]);
    else cards.push(made);
  }
  const sources = [...groups.keys()];
  const holder = state.control[target];
  const owner = holder?.kind === "controlled" ? factionName(scenario, holder.factionId) : holder === undefined ? "Uncontrolled" : "Contested";
  const reach = sources.length === 0 ? "out of reach of your units this turn" : `reachable from ${String(sources.length)} of yours`;
  return {
    defenders: kind === "invade" ? defendersOf(scenario, state, factionId, target) : { cards: [], defence: 0 },
    groups: [...groups].map(([from, cards]) => ({ cards, from, title: `From ${territoryName(scenario, from)}`, trains: [] })),
    here: hereCards(scenario, state, factionId, target, ground),
    kind,
    picks: {
      modes: new Map(),
      support: new Set(plannedSupport(draft.airOrders ?? [], factionId, target)),
      units: new Set(draft.orders.filter((order) => order.to === target).map((order) => order.unitId))
    },
    subtitle: `${ground === "friendly" ? "Yours" : owner} ${glyphs.dot} ${reach}`,
    support: kind === "invade" ? supportCards(scenario, state, factionId, target, draft) : [],
    ...(scenario.air?.supportMax === undefined ? {} : { supportMax: scenario.air.supportMax }),
    target
  };
}

/** The Ground Support group's count: "1 of at most 2", or "1 ticked" without a cap. */
export function supportCount(view: Pick<Muster, "supportMax">, ticked: number): string {
  return view.supportMax === undefined ? `${String(ticked)} ticked` : `${String(ticked)} of at most ${String(view.supportMax)}`;
}

/** Why an aircraft can't be ticked: the cap is reached and it isn't one of the ticked. */
export function supportBlocked(view: Pick<Muster, "supportMax">, ticked: ReadonlySet<UnitId>, unitId: UnitId): string | undefined {
  if (view.supportMax === undefined || ticked.has(unitId) || ticked.size < view.supportMax) return undefined;
  return `At most ${String(view.supportMax)} aircraft give Ground Support to one battle.`;
}

/** The chips' plain names. */
export function modeLabel(mode: MoveMode): string {
  return modeNames[mode];
}

/** What no estimate can know before the fight. */
export const notKnownYet = "Not known yet: the die, their moves, and whether their aircraft fly.";

/** The pane's moves as the orders they give; a unit that is gone gives none. */
export function moveOrders(state: Pick<GameState, "units">, factionId: FactionId, target: TerritoryId, moves: readonly MusterMove[]): readonly MoveOrder[] {
  return moves.flatMap(({ legs, unitId }): MoveOrder[] => {
    const from = state.units[unitId]?.territoryId;
    return from === undefined ? [] : [moveTo(factionId, unitId, from, target, legs)];
  });
}

/** U6: the Invade pane's odds box. */
export type InvadeOdds =
  | { readonly kind: "none"; readonly text: string }
  | { readonly kind: "unopposed"; readonly text: string }
  | {
      /** "15% chance to lose an aircraft in the air battle.", when there is one. */
      readonly airLoss?: string;
      readonly attack: number;
      readonly defence: number;
      readonly defenders: string;
      readonly kind: "battle";
      /** Every effect on the roll known before the fight, and their sum. */
      readonly ledger: RollLedgerData;
      readonly odds: string;
      readonly take: string;
      readonly tone: OddsTone;
      readonly warning?: string;
    };

/** Why a move into the target meets no battle: nobody is there, the player's own units fight there already, or it is the player's own ground. */
function noBattleText(kind: "reinforcement" | "unopposed", state: GameState, factionId: FactionId, target: TerritoryId): string {
  if (kind === "unopposed") return "Unopposed: no other side's units are there.";
  const standing = Object.values(state.units).some((unit) => unit.factionId === factionId && unit.territoryId === target);
  return standing ? "Your units already there fight for the ground; these join them." : "Your own ground: these units reinforce it.";
}

/**
 * U6: the odds of the ticked units (and every other unit of the side already ordered there)
 * attacking `target`, with the ticked aircraft on Ground Support: the engine's estimate, which
 * weighs the air battle (R11); its Ground Support is a row of the ledger. Passes (R6) and landings are judged on the way each unit is to
 * travel. Ticked units arrive together.
 */
export function invadeOdds(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, moves: readonly MusterMove[], support: readonly UnitId[], draft: MusterDraft): InvadeOdds {
  const ticked = new Set(moves.map((move) => move.unitId));
  const orders: readonly MoveOrder[] = [
    ...moveOrders(state, factionId, target, moves),
    ...movesInto(draft.orders.filter(isMoveOrder), factionId, target).filter((order) => !ticked.has(order.unitId))
  ];
  if (orders.length === 0) return { kind: "none", text: "Tick the units to send, and the odds show here." };
  const estimate = attackEstimate(scenario, state, factionId, target, orders, [...new Set([...support, ...plannedSupport(draft.airOrders ?? [], factionId, target)])]);
  if (estimate.kind !== "battle") return { kind: "unopposed", text: noBattleText(estimate.kind, state, factionId, target) };
  const lossChance = estimate.air?.lossChance ?? 0;
  const warning = "cannotAttack" in estimate && estimate.cannotAttack ? "Artillery alone turns back without a battle." : undefined;
  return {
    attack: estimate.attacker.value,
    defence: estimate.defender.value,
    defenders: unitCount(defendingUnits(scenario, state, factionId, target).length),
    kind: "battle",
    ledger: withPlannedAir(scenario, rollLedger(scenario, estimate.modifiers), estimate.air),
    ...(lossChance === 0 ? {} : { airLoss: `${percent(lossChance)} chance to lose an aircraft in the air battle.` }),
    odds: `${glyphs.approx} ${estimate.oddsLabel}`,
    take: percent(estimate.takeChance),
    tone: chanceTone(estimate.takeChance),
    ...(warning === undefined ? {} : { warning })
  };
}

/** U6: the Reinforce pane's defence box. */
export interface ReinforceDefence {
  readonly after: number;
  readonly now: number;
  /** The strongest enemy force next door and its odds against the defence, now and after. */
  readonly threat?: { readonly after: string; readonly from: string; readonly now: string };
  readonly units: string;
}

function defenceOf(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId): { readonly count: number; readonly value: number } {
  const units = Object.values(state.units).filter((unit) => unit.factionId === factionId && unit.territoryId === target && isGroundUnit(scenario, state.raised, unit.id));
  return { count: units.length, value: units.reduce((sum, unit) => sum + armyFigures(scenario, state, unit).defence, 0) };
}

/** The strongest neighbouring enemy force: its territory, faction and units. */
function strongestThreat(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId): { readonly factionId: FactionId; readonly from: TerritoryId; readonly unitIds: readonly UnitId[]; readonly value: number } | undefined {
  let best: { readonly factionId: FactionId; readonly from: TerritoryId; readonly unitIds: readonly UnitId[]; readonly value: number } | undefined;
  for (const from of landNeighbors(scenario, target)) {
    const byFaction = new Map<FactionId, UnitState[]>();
    for (const unit of Object.values(state.units)) {
      if (unit.territoryId !== from || unit.factionId === factionId || !isGroundUnit(scenario, state.raised, unit.id)) continue;
      byFaction.set(unit.factionId, [...(byFaction.get(unit.factionId) ?? []), unit]);
    }
    for (const [enemy, units] of byFaction) {
      const value = units.reduce((sum, unit) => sum + armyFigures(scenario, state, unit).attack, 0);
      if (best === undefined || value > best.value) best = { factionId: enemy, from, unitIds: units.map((unit) => unit.id), value };
    }
  }
  return best;
}

function threatOdds(scenario: Scenario, state: GameState, threat: NonNullable<ReturnType<typeof strongestThreat>>, target: TerritoryId): string {
  const estimate = estimateAttack(scenario, state, threat.factionId, threat.unitIds, target);
  return estimate.kind === "battle" ? `${estimate.oddsLabel}, ${percent(estimate.takeChance)} to take it` : "it walks in";
}

/**
 * U6: the defence of `target` now and once the ticked units arrive (they join where they
 * arrive), and the strongest neighbouring enemy force's odds against it before and after.
 */
export function reinforceDefence(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, ticked: readonly UnitId[]): ReinforceDefence {
  const moved = new Set(ticked);
  const arrived: GameState = {
    ...state,
    units: Object.fromEntries(Object.entries(state.units).map(([id, unit]) => {
      if (!moved.has(unit.id)) return [id, unit];
      const here: UnitState = { ...unit, territoryId: target };
      delete (here as { subTerritoryId?: unknown }).subTerritoryId;
      return [id, here];
    }))
  };
  const now = defenceOf(scenario, state, factionId, target);
  const after = defenceOf(scenario, arrived, factionId, target);
  const threat = strongestThreat(scenario, state, factionId, target);
  return {
    after: after.value,
    now: now.value,
    ...(threat === undefined ? {} : {
      threat: {
        after: threatOdds(scenario, arrived, threat, target),
        from: `${territoryName(scenario, threat.from)} ${glyphs.dot} attack ${String(threat.value)}`,
        now: threatOdds(scenario, state, threat, target)
      }
    }),
    units: `${String(now.count)} ${glyphs.arrow} ${String(after.count)}`
  };
}

/** The order button's words: "Order 4 units to invade". */
export function musterButton(kind: MusterKind, units: number, aircraft: number): string {
  const air = aircraft === 0 ? "" : ` and ${aircraft === 1 ? "1 aircraft" : `${String(aircraft)} aircraft`}`;
  return `Order ${unitCount(units)}${air} to ${kind}`;
}
