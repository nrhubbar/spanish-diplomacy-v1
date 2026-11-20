import type { PendingBattle } from "../battle";
import { type Armies, armiesIn, factionsOf, placeAt, removeArmies, replaceArmies, requireArmy } from "../board";
import { neighborsOf } from "../lookup";
import { settleOccupation } from "../phases/06-occupation";
import type { Phase, TurnDraft } from "../phases/draft";
import { retreatDestination, type Settled } from "../retreat";
import type {
  ContestedTurnOutcome,
  FactionId,
  GameState,
  Scenario,
  SubTerritoryChange,
  SubTerritoryId,
  SubTerritoryState,
  TerritoryId,
  UnitId,
  WithdrawOrder
} from "../types";
import { attackSources, flip, flipOrder, type Ground, groundTaken } from "./flips";
import { type Holdings, heldBy, holdersIn, isContested, controlFromHolders } from "./holders";
import { hasPath } from "./paths";

/**
 * The `provinces` partition module's parts of steps 6, 7 and 8 (tasks section 2): sub-territory
 * flips from battles (P4), whole-territory occupation (P3, M6), returns and retreats along the
 * path rule (P6, through the `retreatAllowed` hook), withdrawals (C1), the one-a-turn sweep in
 * contested ground (P3), rail damage ($8), and control derived from the holders (P2, P7).
 */

/** A battle's effect on the ground: who gains, from whom, how much, and from where it came. */
export interface GroundResult {
  readonly battleIndex: number;
  readonly gainer: FactionId;
  readonly ground: Ground;
  readonly losers: ReadonlySet<FactionId>;
  /** Where the attack came from; the battle territory itself for a standing battle. */
  readonly origins: readonly TerritoryId[];
  readonly territoryId: TerritoryId;
}

/**
 * P4: a battle's ground. A d20 battle states it (`ground`, from `m3r1-d20-combat`), and its
 * attacker gains it. With the d6 preset a taking result (the territory `taken`) counts as "all",
 * gained by the occupier. Only the defending factions lose ground.
 */
export function groundOf(pending: PendingBattle): GroundResult | undefined {
  const { battle, site } = pending;
  const losers = new Set(battle.defender.armies.map((army) => army.factionId));
  const origins = [...new Set(battle.engagement.attackers.map((combatant) => combatant.from))];
  const base = { battleIndex: battle.index, losers, origins, territoryId: site.territoryId };
  const stated = "ground" in battle ? (battle as { readonly ground?: Ground }).ground : undefined;
  if (stated !== undefined) {
    return stated === 0 ? undefined : { ...base, gainer: battle.engagement.attackerFactionId, ground: stated };
  }
  return site.occupation.kind === "taken" ? { ...base, gainer: site.occupation.factionId, ground: "all" } : undefined;
}

/** P4: applies battle ground, outer first from each attack's origin. */
export function applyGround(scenario: Scenario, holdings: Holdings, results: readonly GroundResult[]): { readonly changes: readonly SubTerritoryChange[]; readonly holdings: Holdings } {
  let current = holdings;
  const changes: SubTerritoryChange[] = [];
  for (const result of results) {
    const losers = new Set([...result.losers].filter((id) => id !== result.gainer));
    const inside = result.origins.includes(result.territoryId);
    const sources = attackSources(
      scenario,
      result.origins.filter((id) => id !== result.territoryId),
      inside ? heldBy(scenario, current, result.territoryId, result.gainer) : []
    );
    const ordered = flipOrder(scenario, current, result.territoryId, losers, sources);
    const flipped = flip(current, groundTaken(scenario, result.territoryId, ordered, result.ground), result.gainer, "battle", result.battleIndex);
    current = flipped.holdings;
    changes.push(...flipped.changes);
  }
  return { changes, holdings: current };
}

/** Units of each faction that entered a territory this turn (they stand there now and started elsewhere). */
function entrants(start: GameState, armies: Armies, territoryId: TerritoryId): readonly { readonly factionId: FactionId; readonly from: TerritoryId }[] {
  return armiesIn(armies, territoryId).flatMap((unit) => {
    const from = start.units[unit.id]?.territoryId;
    return from === undefined || from === territoryId ? [] : [{ factionId: unit.factionId, from }];
  });
}

/**
 * P3 (M6): one faction alone in a territory it entered this turn, where it held nothing and
 * other factions held all of it, takes all of it. A contested territory falls one sub-territory
 * a turn instead (the sweep, step 8).
 */
export function occupy(scenario: Scenario, start: GameState, armies: Armies, holdings: Holdings): { readonly changes: readonly SubTerritoryChange[]; readonly holdings: Holdings } {
  let current = holdings;
  const changes: SubTerritoryChange[] = [];
  for (const territory of scenario.territories) {
    const present = factionsOf(armiesIn(armies, territory.id));
    const [only] = present;
    if (present.length !== 1 || only === undefined) continue;
    const holders = holdersIn(scenario, current, territory.id);
    if (holders.length !== 1 || holders[0] === only) continue;
    if (!entrants(start, armies, territory.id).some((entry) => entry.factionId === only)) continue;
    const flipped = flip(current, heldBy(scenario, current, territory.id, holders[0] as FactionId), only, "occupation");
    current = flipped.holdings;
    changes.push(...flipped.changes);
  }
  return { changes, holdings: current };
}

/**
 * P3 (Q-MR-21): in each territory where one faction alone has armies and other factions still
 * hold ground, it takes one of their sub-territories a turn: nearest where its armies came from
 * (or its own ground there) first, the capital last. It applies on the turn the armies enter too.
 */
export function sweep(scenario: Scenario, start: GameState, armies: Armies, holdings: Holdings): { readonly changes: readonly SubTerritoryChange[]; readonly holdings: Holdings } {
  let current = holdings;
  const changes: SubTerritoryChange[] = [];
  for (const territory of scenario.territories) {
    const present = factionsOf(armiesIn(armies, territory.id));
    const [only] = present;
    if (present.length !== 1 || only === undefined) continue;
    const losers = new Set(holdersIn(scenario, current, territory.id).filter((id) => id !== only));
    if (losers.size === 0) continue;
    const origins = entrants(start, armies, territory.id).filter((entry) => entry.factionId === only).map((entry) => entry.from);
    const sources = attackSources(scenario, origins, heldBy(scenario, current, territory.id, only));
    const [next] = flipOrder(scenario, current, territory.id, losers, sources);
    if (next === undefined) continue;
    const flipped = flip(current, [next], only, "sweep");
    current = flipped.holdings;
    changes.push(...flipped.changes);
  }
  return { changes, holdings: current };
}

/**
 * $8 (Q-RAIL-4 note): when a territory becomes contested, rail in the sub-territories the
 * newcomers hold drops by the scenario's `railDamageOnContest`.
 */
export function railDamage(scenario: Scenario, start: GameState, holdings: Holdings): { readonly events: readonly ContestedTurnOutcome[]; readonly holdings: Holdings } {
  const drop = scenario.improvements?.railDamageOnContest ?? 0;
  if (drop <= 0) return { events: [], holdings };
  const next: Record<SubTerritoryId, SubTerritoryState> = { ...holdings };
  const events: ContestedTurnOutcome[] = [];
  for (const territory of scenario.territories) {
    if (isContested(scenario, start, territory.id) || holdersIn(scenario, holdings, territory.id).length < 2) continue;
    const before = new Set(holdersIn(scenario, start.subTerritories, territory.id));
    for (const sub of scenario.index.subTerritoriesByTerritory.get(territory.id) ?? []) {
      const state = next[sub.id];
      if (state === undefined || before.has(state.holder) || state.rail === 0) continue;
      const after = Math.max(0, state.rail - drop);
      next[sub.id] = { ...state, rail: after };
      events.push({ after, before: state.rail, kind: "rail-damaged", subTerritoryId: sub.id });
    }
  }
  return { events, holdings: events.length === 0 ? holdings : next };
}

/** P6: retreats that ended in surrender only because no path led out, reported as such. */
function pathSurrenders(scenario: Scenario, start: GameState, armies: Armies, settled: readonly Settled[]): readonly ContestedTurnOutcome[] {
  return settled.flatMap((entry): ContestedTurnOutcome[] => {
    if (entry.kind !== "surrendered") return [];
    const unit = start.units[entry.leaving.unitId];
    if (unit === undefined) return [];
    const from = entry.leaving.from;
    const blocked = neighborsOf(scenario, from).some(({ territoryId: to }) => {
      const control = start.control[to];
      return control?.kind === "controlled" && control.factionId === unit.factionId
        && !armiesIn(armies, to).some((other) => other.factionId !== unit.factionId)
        && !hasPath(scenario, start.subTerritories, unit.factionId, from, to);
    });
    return blocked ? [{ factionId: unit.factionId, from, kind: "path-surrender", unitId: unit.id }] : [];
  });
}

/** C1, P6: the turn's valid Withdraw orders (step 1 rejected the others). */
function validWithdrawals(draft: TurnDraft): readonly WithdrawOrder[] {
  const rejected = new Set(draft.orders.rejected.map((outcome) => outcome.order));
  return draft.input.submissions.flatMap((submission) => submission.orders.flatMap((order) =>
    order.kind === "withdraw" && !rejected.has(order) ? [order] : []));
}

/**
 * C1, P6: units that withdraw leave after the battles of step 5 (they defended where they
 * stood). Each goes to its destination unless another faction's army now stands there; then it
 * falls back like a retreat (M21, with the path rule), or surrenders.
 */
export function withdraw(scenario: Scenario, start: GameState, armies: Armies, orders: readonly WithdrawOrder[]): { readonly armies: Armies; readonly events: readonly ContestedTurnOutcome[] } {
  const going = orders.filter((order) => armies[order.unitId]?.territoryId === order.from);
  const leavingIds = new Set<UnitId>(going.map((order) => order.unitId));
  const staying = Object.values(armies).filter((unit) => !leavingIds.has(unit.id));
  const events: ContestedTurnOutcome[] = [];
  const moved = [];
  const surrendered: UnitId[] = [];
  for (const order of going) {
    const unit = requireArmy(armies, order.unitId);
    const blocked = staying.some((other) => other.territoryId === order.to && other.factionId !== unit.factionId);
    const to = blocked ? retreatDestination(scenario, start, staying, unit.factionId, order.from) : order.to;
    if (to === undefined) {
      surrendered.push(unit.id);
      events.push({ factionId: unit.factionId, from: order.from, kind: "path-surrender", unitId: unit.id });
    } else {
      moved.push(placeAt(unit, to));
      events.push({ kind: "withdrew", order: to === order.to ? order : { ...order, to } });
    }
  }
  return { armies: removeArmies(replaceArmies(armies, moved), surrendered), events };
}

function withHoldings(draft: TurnDraft, holdings: Holdings, changes: readonly SubTerritoryChange[]): TurnDraft {
  return changes.length === 0 && holdings === draft.systems.subTerritories
    ? draft
    : { ...draft, subTerritoryChanges: [...draft.subTerritoryChanges, ...changes], systems: { ...draft.systems, subTerritories: holdings } };
}

/** Step 6 under `provinces`: battle ground, returns and retreats (path rule), withdrawals, occupation. */
export const provincesOccupation: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const ground = applyGround(scenario, draft.systems.subTerritories, draft.front.battles.flatMap((pending) => groundOf(pending) ?? []));
  const settledBefore = draft.settled.length;
  const afterRetreats = settleOccupation(withHoldings(draft, ground.holdings, ground.changes));
  const surrenders = pathSurrenders(scenario, start, afterRetreats.armies, afterRetreats.settled.slice(settledBefore));
  const withdrawn = withdraw(scenario, start, afterRetreats.armies, validWithdrawals(afterRetreats));
  const occupied = occupy(scenario, start, withdrawn.armies, afterRetreats.systems.subTerritories);
  return withHoldings(
    { ...afterRetreats, armies: withdrawn.armies, events: [...afterRetreats.events, ...surrenders, ...withdrawn.events] },
    occupied.holdings,
    occupied.changes
  );
};

/** Step 7 under `provinces`: the standing battles' ground (the dice module fought them and settled their retreats). */
export const provincesStanding: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const ground = applyGround(scenario, draft.systems.subTerritories, draft.standing.flatMap((pending) => groundOf(pending) ?? []));
  const standingIndexes = new Set(draft.standing.map((pending) => pending.battle.index));
  const fromStanding = draft.settled.filter((entry) => "battleIndex" in entry.leaving.report && standingIndexes.has(entry.leaving.report.battleIndex));
  const surrenders = pathSurrenders(scenario, start, draft.armies, fromStanding);
  return withHoldings({ ...draft, events: [...draft.events, ...surrenders] }, ground.holdings, ground.changes);
};

/** Step 8 under `provinces`: the sweep, rail damage, then territory and city control from the holders. */
export const provincesControl: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const swept = sweep(scenario, start, draft.armies, draft.systems.subTerritories);
  const damaged = railDamage(scenario, start, swept.holdings);
  const next = withHoldings({ ...draft, events: [...draft.events, ...damaged.events] }, damaged.holdings, swept.changes);
  return { ...next, control: controlFromHolders(scenario, damaged.holdings, draft.control) };
};
