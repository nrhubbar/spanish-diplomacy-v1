import { isGroundUnit, territoriesWithin, unitDefinitionIn, unitKindIn, unitTypeIn } from "../engine/air/pieces";
import { validateAirMission } from "../engine/air/validation";
import { compareIds } from "../engine/board";
import { type AttackEstimate, estimateAttack } from "../engine/combat";
import { landNeighbors } from "../engine/movement/network";
import { moveRoutes, type MoveRoute } from "../engine/movement/routes";
import type { MoveMode } from "../engine/network/reach";
import { pocketOfArmy } from "../engine/partition/pockets";
import type { AirMissionOrder, FactionId, GameState, MoveOrder, SackOrder, Scenario, TerritoryId, SubTerritoryId, UnitId, UnitState, WithdrawOrder } from "../engine/types";
import { armyFigures, figuresWorks, menLabel, strengthShare, valuesLabel } from "./army";
import { glyphs } from "./glyphs";
import { type ModeChip, modeChips, modeNames } from "./moveModes";
import { chanceTone, type OddsTone, percent, plannedSupport, signed } from "./odds";
import { factionName, listNames, territoryName } from "./text";

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

/** One unit's card. */
export interface MusterCard {
  /** The mode its card starts on: the one it is ordered by already, else the one the game offers. */
  readonly defaultMode: MoveMode;
  /** R8: the works it leaves behind, as "Dug in 1 · −2", when it stands behind its side's works. */
  readonly dugIn?: string;
  readonly from: TerritoryId;
  readonly men: string;
  readonly modes: readonly ModeChip[];
  readonly name: string;
  /** Its other order this turn, which ticking it replaces, e.g. "Ordered: move to Murcia". */
  readonly otherOrder?: string;
  /** Already ordered to the target, so the card starts ticked. */
  readonly ordered: boolean;
  readonly share: number;
  readonly typeName: string;
  readonly unitId: UnitId;
  readonly values: string;
}

export interface MusterGroup {
  readonly cards: readonly MusterCard[];
  readonly from: TerritoryId;
  readonly title: string;
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

export interface Muster {
  readonly groups: readonly MusterGroup[];
  readonly here: readonly HereCard[];
  readonly kind: MusterKind;
  readonly subtitle: string;
  readonly support: readonly SupportCard[];
  /** The most aircraft whose Ground Support counts (the scenario's cap); absent means no cap. */
  readonly supportMax?: number;
  readonly target: TerritoryId;
}

/** A unit's name, raised in play or not. */
export function nameOf(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): string {
  return unitDefinitionIn(scenario, state.raised, unitId)?.name ?? "Unit";
}

/** A unit's type name, raised in play or not. */
export function typeNameOf(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): string {
  return unitTypeIn(scenario, state.raised, unitId)?.name ?? "Unit";
}

/** A sub-territory's name. */
export function subName(scenario: Scenario, id: SubTerritoryId): string {
  return scenario.index.subTerritories.get(id)?.name ?? "its ground";
}

/** The side's ground units that can reach `target` this turn, with the route the game offers each. */
export function reachingUnits(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, draft: MusterDraft): readonly { readonly route: MoveRoute; readonly unit: UnitState }[] {
  const planned = draft.orders.filter((order): order is MoveOrder => order.kind === "move");
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

function card(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, draft: MusterDraft, unit: UnitState, route: MoveRoute): MusterCard {
  const figures = armyFigures(scenario, state, unit);
  const works = figuresWorks(figures);
  const modes = modeChips(scenario, state, factionId, unit.id, route);
  const order = draft.orders.find((each) => each.unitId === unit.id && each.to === target);
  const orderedMode = order === undefined ? undefined : modes.find((chip) => chip.ok && legsKey(chip.legs) === legsKey(legsOfOrder(order)))?.mode;
  const otherOrder = otherOrderOf(scenario, draft, unit.id, target);
  return {
    defaultMode: orderedMode ?? route.mode,
    ...(works === undefined ? {} : { dugIn: `Dug in ${String(works.dugIn)} ${glyphs.dot} ${signed(-works.dugInRoll)}` }),
    from: unit.territoryId,
    men: `${menLabel(figures)} men`,
    modes,
    name: nameOf(scenario, state, unit.id),
    ...(otherOrder === undefined ? {} : { otherOrder }),
    ordered: order !== undefined,
    share: strengthShare(figures),
    typeName: typeNameOf(scenario, state, unit.id),
    unitId: unit.id,
    values: valuesLabel(figures.attack, figures.defence)
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
      return { name: nameOf(scenario, state, unit.id), note: `${place}${stays}`, unitId: unit.id, values: valuesLabel(figures.attack, figures.defence) };
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
        name: nameOf(scenario, state, unit.id),
        ...(mission === undefined || ordered ? {} : { otherMission: missionName(scenario, mission) }),
        ordered,
        typeName: typeNameOf(scenario, state, unit.id),
        unitId: unit.id
      };
    });
}

/** U6: the Invade or Reinforce pane's units for `target`. */
export function muster(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, kind: MusterKind, draft: MusterDraft): Muster {
  const ground = groundOf(state, factionId, target);
  const reaching = reachingUnits(scenario, state, factionId, target, draft);
  const groups = new Map<TerritoryId, MusterCard[]>();
  for (const { route, unit } of reaching) {
    const made = card(scenario, state, factionId, target, draft, unit, route);
    const cards = groups.get(unit.territoryId);
    if (cards === undefined) groups.set(unit.territoryId, [made]);
    else cards.push(made);
  }
  const sources = [...groups.keys()];
  const holder = state.control[target];
  const owner = holder?.kind === "controlled" ? factionName(scenario, holder.factionId) : holder === undefined ? "Uncontrolled" : "Contested";
  const reach = sources.length === 0 ? "out of reach of your units this turn" : `reachable from ${String(sources.length)} of yours`;
  return {
    groups: [...groups].map(([from, cards]) => ({ cards, from, title: `From ${territoryName(scenario, from)}` })),
    here: hereCards(scenario, state, factionId, target, ground),
    kind,
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

/** The units a pane starts with ticked: those already ordered there. */
export function musterTicks(view: Muster): { readonly support: readonly UnitId[]; readonly units: readonly UnitId[] } {
  return {
    support: view.support.filter((each) => each.ordered).map((each) => each.unitId),
    units: view.groups.flatMap((group) => group.cards.filter((each) => each.ordered).map((each) => each.unitId))
  };
}

/** The chips' plain names. */
export function modeLabel(mode: MoveMode): string {
  return modeNames[mode];
}

/** U6: the Invade pane's odds box. */
export type InvadeOdds =
  | { readonly kind: "none"; readonly text: string }
  | { readonly kind: "unopposed"; readonly text: string }
  | {
      readonly air?: string;
      readonly attack: number;
      readonly defence: number;
      readonly defenders: string;
      readonly kind: "battle";
      readonly odds: string;
      readonly pass?: string;
      readonly take: string;
      readonly tone: OddsTone;
      readonly warning?: string;
    };

/**
 * U6: the odds of the ticked units (and every other unit of the side already ordered there)
 * attacking `target`, with the ticked aircraft on Ground Support: the engine's estimate, which
 * includes the air battle (R11) and the pass (R6). Ticked units arrive together.
 */
export function invadeOdds(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, ticked: readonly UnitId[], support: readonly UnitId[], draft: MusterDraft): InvadeOdds {
  const others = draft.orders.filter((order) => order.kind === "move" && order.factionId === factionId && order.to === target).map((order) => order.unitId);
  const attackers = [...new Set([...ticked, ...others])];
  if (attackers.length === 0) return { kind: "none", text: "Tick the units to send, and the odds show here." };
  const estimate = estimateAttack(scenario, state, factionId, attackers, target, [...new Set([...support, ...plannedSupport(draft.airOrders ?? [], factionId, target)])]);
  if (estimate.kind !== "battle") return { kind: "unopposed", text: "Unopposed: no other side's units are there." };
  const defenders = estimate.defender.armies.map((army) => nameOf(scenario, state, army.unitId));
  const pass = estimate.modifiers.find((modifier) => modifier.kind === "pass");
  const air = airLine(estimate);
  const warning = "cannotAttack" in estimate && estimate.cannotAttack ? "Artillery alone turns back without a battle." : undefined;
  return {
    ...(air === undefined ? {} : { air }),
    attack: estimate.attacker.value,
    defence: estimate.defender.value,
    defenders: listNames(defenders),
    kind: "battle",
    odds: `${glyphs.approx} ${estimate.oddsLabel}`,
    ...(pass?.kind === "pass" ? { pass: `Every attacking unit crosses the ${pass.name} pass: ${signed(pass.roll)} on your roll. One unit over an open link would flank it.` } : {}),
    take: percent(estimate.takeChance),
    tone: chanceTone(estimate.takeChance),
    ...(warning === undefined ? {} : { warning })
  };
}

/** R11: the air battle as one sentence, when Ground Support is planned. */
function airLine(estimate: Extract<AttackEstimate, { readonly kind: "battle" }>): string | undefined {
  const { air } = estimate;
  if (air === undefined) return undefined;
  const bonus = signed(air.modifier.roll);
  if (air.odds === undefined) return `Ground Support ${bonus}: nothing contests the air.`;
  return `Air battle first: you win the air ${percent(air.odds.attackerWins)} (tie ${percent(air.odds.tie)}), then Ground Support ${bonus}.`;
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
  const what = units === 1 ? "1 unit" : `${String(units)} units`;
  const air = aircraft === 0 ? "" : ` and ${aircraft === 1 ? "1 aircraft" : `${String(aircraft)} aircraft`}`;
  return `Order ${what}${air} to ${kind}`;
}
