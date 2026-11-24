import { type AttackEstimate, estimateAttack } from "../engine/combat";
import { requireUnitState } from "../engine/lookup";
import type { MoveRoute } from "../engine/movement/routes";
import { routesOfMoves } from "../engine/movement/transit";
import type { AirMissionOrder, CombatModifier, FactionId, GameState, MoveLeg, MoveOrder, SackOrder, Scenario, TerritoryId, UnitId } from "../engine/types";
import { glyphs } from "./glyphs";
import { orderLegs } from "./moveModes";
import { signedTenths } from "./numbers";
import { weatherModifierName } from "./weatherName";

/**
 * C15: what a planned move would meet, for the destination highlights and the Orders pane.
 * The numbers come from the engine's `estimateAttack`; this module only adds the words. The
 * destinations are the engine's legal ones, so a demoralized army is never offered a hostile
 * territory (M23) and needs no case here.
 */
export type DestinationEstimate = AttackEstimate;

/**
 * N3: the estimate of one planned attack: every given move into `target`, on the legs it carries,
 * with these aircraft on Ground Support. The map's chips, This turn and the Invade pane all ask
 * here, so the same attack shows the same odds everywhere.
 */
export function attackEstimate(scenario: Scenario, state: GameState, factionId: FactionId, target: TerritoryId, moves: readonly MoveOrder[], support: readonly UnitId[]): DestinationEstimate {
  return estimateAttack(scenario, state, factionId, moves.map((move) => move.unitId), target, support, routesOfMoves(scenario, state, moves));
}

/**
 * A1: the odds at each destination count every army this faction would send there: the
 * selected armies, by the route offered for it (`routes`), plus the planned moves to that
 * destination, each army once, and (R11) the aircraft planned on Ground Support there. A selected
 * army that already has a planned order is counted once, where it is about to go.
 */
export function destinationEstimates(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  unitIds: readonly UnitId[],
  destinations: readonly TerritoryId[],
  plannedOrders: readonly MoveOrder[] = [],
  airOrders: readonly (AirMissionOrder | SackOrder)[] = [],
  routes?: ReadonlyMap<TerritoryId, MoveRoute>
): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const estimates = new Map<TerritoryId, DestinationEstimate>();
  if (unitIds.length === 0) return estimates;
  const selected = new Set(unitIds);
  for (const territoryId of destinations) {
    const route = routes?.get(territoryId);
    const moves = [
      ...unitIds.map((unitId) => moveTo(factionId, unitId, requireUnitState(state, unitId).territoryId, territoryId, route === undefined ? undefined : orderLegs(route))),
      ...movesInto(plannedOrders, factionId, territoryId).filter((order) => !selected.has(order.unitId))
    ];
    estimates.set(territoryId, attackEstimate(scenario, state, factionId, territoryId, moves, plannedSupport(airOrders, factionId, territoryId)));
  }
  return estimates;
}

/**
 * A1 (B.2): the combined odds of everything this faction has ordered to each destination of
 * its planned moves, in the order the destinations first appear.
 */
export function plannedEstimates(
  scenario: Scenario,
  state: GameState,
  factionId: FactionId,
  plannedOrders: readonly MoveOrder[],
  airOrders: readonly (AirMissionOrder | SackOrder)[] = []
): ReadonlyMap<TerritoryId, DestinationEstimate> {
  const destinations = new Set(plannedOrders.filter((order) => order.factionId === factionId).map((order) => order.to));
  const estimates = new Map<TerritoryId, DestinationEstimate>();
  for (const territoryId of destinations) {
    estimates.set(territoryId, attackEstimate(scenario, state, factionId, territoryId, movesInto(plannedOrders, factionId, territoryId), plannedSupport(airOrders, factionId, territoryId)));
  }
  return estimates;
}

/** A move order as planning gives it: no legs for a plain step (CT-6). */
export function moveTo(factionId: FactionId, unitId: UnitId, from: TerritoryId, to: TerritoryId, legs?: readonly MoveLeg[]): MoveOrder {
  return { factionId, from, kind: "move", ...(legs === undefined ? {} : { legs }), to, unitId };
}

/** R11: the faction's aircraft planned on Ground Support over `territoryId`, which the odds weigh by the air battle. */
export function plannedSupport(airOrders: readonly (AirMissionOrder | SackOrder)[], factionId: FactionId, territoryId: TerritoryId): readonly UnitId[] {
  return airOrders.flatMap((order) => (order.kind === "air-mission" && order.factionId === factionId && order.mission.kind === "support" && order.mission.territoryId === territoryId ? [order.unitId] : []));
}

/** The planned moves of `factionId` into `territoryId`. */
export function movesInto(plannedOrders: readonly MoveOrder[], factionId: FactionId, territoryId: TerritoryId): readonly MoveOrder[] {
  return plannedOrders.filter((order) => order.factionId === factionId && order.to === territoryId);
}

/** A chance as a whole percentage: 0.5 is "50%". */
export function percent(chance: number): string {
  return `${String(Math.round(chance * 100))}%`;
}

export type OddsTone = "good" | "even" | "poor" | "safe";

/** How a take chance reads at a glance; the words always carry the number too. */
export function chanceTone(chance: number): OddsTone {
  if (chance >= 2 / 3) return "good";
  return chance <= 1 / 3 ? "poor" : "even";
}

export interface OddsSummary {
  /** Short text for the map plaque: "\u2248 2:1 - 50%", "Reinforce", "Unopposed". */
  readonly chip: string;
  /** The same for the Orders pane, where there is room for the word: "Approx. 2:1 - 50%". */
  readonly label: string;
  /** The same in words, for accessible names: "Approximately 2:1, 50 percent to take it." */
  readonly sentence: string;
  readonly tone: OddsTone;
}

/**
 * A2: battle odds are an estimate (the defender may reinforce, another faction may join), so
 * they always read as approximate. Reinforcement and unopposed moves are not odds.
 */
export function oddsSummary(estimate: DestinationEstimate): OddsSummary {
  switch (estimate.kind) {
    case "reinforcement":
      return { chip: "Reinforce", label: "Reinforce", sentence: "Reinforcement: it always arrives and joins the defence.", tone: "safe" };
    case "unopposed":
      return { chip: "Unopposed", label: "Unopposed", sentence: "Unopposed: no other faction's units are there.", tone: "safe" };
    case "battle": {
      const odds = `${estimate.oddsLabel} ${glyphs.dot} ${percent(estimate.takeChance)}`;
      return {
        chip: `${glyphs.approx} ${odds}`,
        label: `Approx. ${odds}`,
        sentence: `Approximately ${estimate.oddsLabel}, ${String(Math.round(estimate.takeChance * 100))} percent to take it.`,
        tone: chanceTone(estimate.takeChance)
      };
    }
  }
}

/** A2: the one sentence behind the odds' "i". */
export const oddsCaveat = "The defender may reinforce, or another faction may attack too, so the real odds may differ.";

/** Signed roll change as printed, to a tenth (N5): "+1", "-2" (with a true minus sign), "0". */
export function signed(value: number): string {
  return value === 0 ? "0" : signedTenths(value);
}

/** A general's trait by its own name, read from the scenario when it is at hand. */
function traitName(traitId: Extract<CombatModifier, { readonly kind: "trait" }>["traitId"], scenario?: Scenario): string {
  return scenario?.generalTraits.find((trait) => trait.id === traitId)?.name ?? traitId.replace(/-/g, " ");
}

/**
 * A modifier by name, as the battle breakdown lists it. Defender bonuses read as the bonus
 * ("Dug in level 1 (+2)", "Popular resistance +1"); the roll column shows their effect on the die.
 */
/** A modifier's name; with the scenario, unit bonuses name their unit type (D5). */
export function modifierName(modifier: CombatModifier, scenario?: Scenario): string {
  switch (modifier.kind) {
    case "dug-in":
      // R8: the works' level in pips, then what it is worth for the defender on the die.
      return `Dug in level ${String(modifier.level)} (+${String(-modifier.roll)})`;
    case "faction":
      return `${modifier.name} +${String(Math.abs(modifier.roll))}`;
    case "odds-overflow":
      return "Odds beyond 6:1";
    case "odds-halving":
      return `Odds below 1:1 (${String(modifier.halvings)} ${modifier.halvings === 1 ? "halving" : "halvings"})`;
    case "general":
      return "General";
    case "trait":
      return `General's trait: ${traitName(modifier.traitId, scenario)}`;
    case "barricades":
      return "Barricades (city held)";
    case "unit-bonus":
      return scenario?.index.unitTypes.get(modifier.unitTypeId)?.name ?? "Supporting arms";
    case "fatigue":
      return modifier.role === "attack" ? "Fatigued" : "Defenders fatigued";
    case "weather":
      return weatherModifierName(modifier.weatherId);
    case "amphibious":
      return "Amphibious assault";
    case "pass":
      return `${modifier.name} pass`;
    case "air-support":
      return modifier.role === "attack" ? "Bomber support" : "Bomber support for the defender";
    case "building":
      return "Fortifications";
  }
}

/** A modifier as one phrase: defender bonuses by name, odds steps and the weather (D7) with their roll change. */
export function modifierPhrase(modifier: CombatModifier): string {
  return modifier.kind === "odds-overflow" || modifier.kind === "odds-halving" || modifier.kind === "weather"
    ? `${modifierName(modifier)} ${signed(modifier.roll)}`
    : modifierName(modifier);
}
