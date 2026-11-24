import type { PendingBattle } from "../d20/battle";
import { onGroundBoard } from "../air/pieces";
import { type Armies, armiesIn, placeAt, removeArmies, replaceArmies, requireArmy, unitOrder } from "../board";
import { groundSides, loneSide } from "../control";
import { neighborsOf } from "../lookup";
import { settleOccupation } from "../phases/06-occupation";
import type { Phase, TurnDraft } from "../phases/draft";
import { type Leaving, retreatDestination, settleDepartures, type Settled } from "../retreat";
import type {
  ContestedTurnOutcome,
  FactionId,
  GameState,
  Scenario,
  SubTerritoryChange,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitState,
  WithdrawOrder
} from "../types";
import { hasFighter } from "../units/fighting";
import { attackDistances, flip, flipOrder, type Ground, groundTaken } from "./flips";
import { type Holdings, heldBy, holderOf, holdersIn, controlFromHolders, isContested, subTerritoriesOf } from "./holders";
import { hasPath } from "./paths";
import { armyAnchor, arrivalSite, type Pocket, pocketOfUnit, pocketsIn } from "./pockets";

/**
 * The `provinces` partition module's parts of steps 6, 7 and 8 (tasks section 2): sub-territory
 * flips from battles (P4), whole-territory occupation (P3, M6), returns and retreats along the
 * path rule (P6, R1: out of the army's pocket, through the `retreatAllowed` hook), withdrawals
 * (C1), the end-of-turn flip of ground one side is alone in (R2), the armies' pockets (R1), and
 * control derived from the holders (P2, P7).
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
 * P4: a battle's ground. The battle states it (`ground`), and its attacker gains it. Only the defending factions lose ground.
 */
function groundOf(pending: PendingBattle): GroundResult | undefined {
  const { battle, site } = pending;
  const losers = new Set(battle.defender.armies.map((army) => army.factionId));
  const origins = [...new Set(battle.engagement.attackers.map((combatant) => combatant.from))];
  const base = { battleIndex: battle.index, losers, origins, territoryId: site.territoryId };
  const stated = "ground" in battle ? (battle as { readonly ground?: Ground }).ground : undefined;
  if (stated !== undefined) {
    if (stated === 0) return undefined;
    // "all" goes to whoever occupies; nobody gains it when the attackers were destroyed too.
    if (stated === "all") return site.occupation.kind === "taken" ? { ...base, gainer: site.occupation.factionId, ground: "all" } : undefined;
    return { ...base, gainer: battle.engagement.attackerFactionId, ground: stated };
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
    const distance = attackDistances(
      scenario,
      result.territoryId,
      result.origins.filter((id) => id !== result.territoryId),
      inside ? heldBy(scenario, current, result.territoryId, result.gainer) : []
    );
    const ordered = flipOrder(scenario, current, result.territoryId, losers, distance);
    const flipped = flip(current, groundTaken(scenario, result.territoryId, ordered, result.ground), result.gainer, "battle", result.battleIndex);
    current = flipped.holdings;
    changes.push(...flipped.changes);
  }
  return { changes, holdings: current };
}

/**
 * Units of each faction that entered a territory this turn (they stand there now and started
 * elsewhere), each with where its last step came from: the staging territory of a multi-leg move
 * (`orders.origins`, as the battle ground reads it), else its start territory.
 */
function entrants(start: GameState, armies: Armies, territoryId: TerritoryId, origins: ReadonlyMap<UnitId, TerritoryId> = new Map()): readonly { readonly factionId: FactionId; readonly from: TerritoryId }[] {
  return armiesIn(armies, territoryId).flatMap((unit) => {
    const began = start.units[unit.id]?.territoryId;
    if (began === undefined || began === territoryId) return [];
    const staged = origins.get(unit.id);
    return [{ factionId: unit.factionId, from: staged !== undefined && staged !== territoryId ? staged : began }];
  });
}

/** D27.1: the faction has a unit there that can fight (a lone general, truck or anti-air battery takes no ground). */
function fightsThere(scenario: Scenario, start: GameState, armies: Armies, territoryId: TerritoryId, factionId: FactionId): boolean {
  return hasFighter(scenario, start.raised, armiesIn(armies, territoryId).filter((unit) => unit.factionId === factionId).map((unit) => unit.id));
}

/**
 * P3 (M6): one faction alone in a territory it entered this turn, where it held nothing and
 * other factions held all of it, takes all of it. A contested territory one side is left alone
 * in flips whole at step 8 instead (R2, `flipWhole`). D27.1: only a force with a unit that can
 * fight takes ground; another faction's general or truck there still keeps it from being alone.
 * Aircraft never count.
 */
export function occupy(scenario: Scenario, start: GameState, armies: Armies, holdings: Holdings): { readonly changes: readonly SubTerritoryChange[]; readonly holdings: Holdings } {
  let current = holdings;
  const changes: SubTerritoryChange[] = [];
  const sides = groundSides(scenario, start.raised, armies);
  for (const territory of scenario.territories) {
    const only = loneSide(sides, territory.id);
    if (only === undefined) continue;
    const holders = holdersIn(scenario, current, territory.id);
    if (holders.length !== 1 || holders[0] === only) continue;
    if (!entrants(start, armies, territory.id).some((entry) => entry.factionId === only)) continue;
    if (!fightsThere(scenario, start, armies, territory.id, only)) continue;
    const flipped = flip(current, heldBy(scenario, current, territory.id, holders[0] as FactionId), only, "occupation");
    current = flipped.holdings;
    changes.push(...flipped.changes);
  }
  return { changes, holdings: current };
}

/** R2: a territory that flipped whole this turn, and what it cost the other sides. */
export interface WholeFlip {
  readonly changes: readonly SubTerritoryChange[];
  readonly events: readonly ContestedTurnOutcome[];
  readonly holdings: Holdings;
}

/**
 * R2 (replacing Rev 1's one-a-turn sweep): at the end of the turn, a territory where only one
 * side has ground armies and other sides still hold ground flips whole to that side. Where both
 * sides were wiped out, or several sides still stand, the holders keep what they held. Aircraft
 * never count. D27.1: the side alone needs a unit that can fight; another side's general or
 * truck there still keeps it from being alone.
 */
export function flipWhole(scenario: Scenario, start: GameState, armies: Armies, holdings: Holdings): WholeFlip {
  let current = holdings;
  const changes: SubTerritoryChange[] = [];
  const events: ContestedTurnOutcome[] = [];
  const sides = groundSides(scenario, start.raised, armies);
  for (const territory of scenario.territories) {
    const only = loneSide(sides, territory.id);
    if (only === undefined || !fightsThere(scenario, start, armies, territory.id, only)) continue;
    const taken = subTerritoriesOf(scenario, territory.id).flatMap((sub) => {
      const holder = holderOf(scenario, current, sub.id);
      return holder !== undefined && holder !== only ? [sub.id] : [];
    });
    if (taken.length === 0) continue;
    const flipped = flip(current, taken, only, "sweep");
    current = flipped.holdings;
    changes.push(...flipped.changes);
    events.push({ factionId: only, kind: "territory-flipped", subTerritoryIds: flipped.changes.map((change) => change.subTerritoryId), territoryId: territory.id });
  }
  return { changes, events, holdings: current };
}

/**
 * R1: the pocket an army stood in at the start of the turn, on the start-of-turn holders. Only for
 * an army that stood in `territoryId` then; undefined for one that entered it this turn.
 */
function startPocket(scenario: Scenario, start: GameState, unitId: UnitId, territoryId: TerritoryId): Pocket | undefined {
  const began = start.units[unitId];
  return began?.territoryId === territoryId ? pocketOfUnit(scenario, start.subTerritories, began) : undefined;
}

/**
 * R1: where an army that stayed stands now: its anchor where that is still its side's and was in
 * its pocket, else the first sub-territory of its pocket in the part left that holds the most of
 * it (ties: scenario order). Undefined when nothing of its pocket is left.
 */
function survivingSite(pockets: readonly Pocket[], before: Pocket, anchor: SubTerritoryId | undefined): SubTerritoryId | undefined {
  const was = new Set(before.subTerritoryIds);
  if (anchor !== undefined && was.has(anchor) && pockets.some((pocket) => pocket.subTerritoryIds.includes(anchor))) return anchor;
  const overlap = (pocket: Pocket): number => pocket.subTerritoryIds.filter((id) => was.has(id)).length;
  const best = pockets.reduce<Pocket | undefined>((kept, pocket) => (kept === undefined || overlap(pocket) > overlap(kept) ? pocket : kept), undefined);
  return best?.subTerritoryIds.find((id) => was.has(id));
}

/**
 * R1: after the flips, each army in contested ground is placed in its pocket: an army that
 * arrived joins the pocket on the side of the border it crossed (`arrivalSite`); one that stayed
 * keeps what is left of its pocket. The place is stored on the army (`subTerritoryId`) only where
 * its anchor would not already find it, and dropped once the territory is no longer contested.
 * Armies whose pocket was split or lost ground are reported, one event per pocket.
 */
export function settlePockets(
  scenario: Scenario,
  start: GameState,
  armies: Armies,
  holdings: Holdings,
  origins: ReadonlyMap<UnitId, TerritoryId> = new Map()
): { readonly armies: Armies; readonly events: readonly ContestedTurnOutcome[] } {
  const updates: UnitState[] = [];
  const cut = new Map<string, { readonly pocket: Pocket; readonly unitIds: UnitId[] }>();
  for (const unit of Object.values(armies)) {
    if (!isContested(scenario, { control: {}, subTerritories: holdings }, unit.territoryId)) {
      if (unit.subTerritoryId !== undefined) updates.push(withoutAnchor(unit));
      continue;
    }
    if (!onGroundBoard(scenario, start.raised, unit.id)) continue;
    const pockets = pocketsIn(scenario, holdings, unit.territoryId, unit.factionId);
    const before = startPocket(scenario, start, unit.id, unit.territoryId);
    const anchor = armyAnchor(scenario, unit);
    const from = origins.get(unit.id) ?? start.units[unit.id]?.territoryId;
    const site = before !== undefined
      ? survivingSite(pockets, before, anchor)
      : from === undefined ? undefined : arrivalSite(scenario, holdings, from, unit.territoryId, unit.factionId);
    if (site === undefined) continue;
    // The site is the side's own ground, so one of its pockets holds it.
    const pocket = pockets.find((entry) => entry.subTerritoryIds.includes(site)) as Pocket;
    const placed = anchor === undefined ? pockets[0]?.subTerritoryIds.includes(site) === true : pocket.subTerritoryIds.includes(anchor);
    if (!placed) updates.push({ ...unit, subTerritoryId: site });
    if (before !== undefined && before.subTerritoryIds.some((id) => !pocket.subTerritoryIds.includes(id))) {
      const key = `${unit.factionId}|${pocket.subTerritoryIds.join(",")}`;
      const entry = cut.get(key) ?? { pocket, unitIds: [] };
      entry.unitIds.push(unit.id);
      cut.set(key, entry);
    }
  }
  const rank = unitOrder(scenario);
  const territoryRank = (id: TerritoryId): number => scenario.territories.findIndex((territory) => territory.id === id);
  const factionRank = (id: FactionId): number => scenario.factions.findIndex((faction) => faction.id === id);
  const subRank = (pocket: Pocket): number => scenario.subTerritories.findIndex((sub) => sub.id === pocket.subTerritoryIds[0]);
  const events = [...cut.values()]
    .sort((left, right) => territoryRank(left.pocket.territoryId) - territoryRank(right.pocket.territoryId)
      || factionRank(left.pocket.factionId) - factionRank(right.pocket.factionId)
      || subRank(left.pocket) - subRank(right.pocket))
    .map(({ pocket, unitIds }): ContestedTurnOutcome => ({
      factionId: pocket.factionId,
      kind: "pocket-cut",
      subTerritoryIds: pocket.subTerritoryIds,
      territoryId: pocket.territoryId,
      unitIds: [...unitIds].sort((left, right) => rank(left) - rank(right))
    }));
  return { armies: updates.length === 0 ? armies : replaceArmies(armies, updates), events };
}

function withoutAnchor(unit: UnitState): UnitState {
  return Object.fromEntries(Object.entries(unit).filter(([key]) => key !== "subTerritoryId")) as unknown as UnitState;
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
        && !hasPath(scenario, start, unit.factionId, from, to, [unit.id]);
    });
    return blocked ? [{ factionId: unit.factionId, from, kind: "path-surrender", men: entry.men, unitId: unit.id }] : [];
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
function withdraw(scenario: Scenario, start: GameState, armies: Armies, orders: readonly WithdrawOrder[]): { readonly armies: Armies; readonly events: readonly ContestedTurnOutcome[] } {
  const going = orders.filter((order) => armies[order.unitId]?.territoryId === order.from);
  const leavingIds = new Set<UnitId>(going.map((order) => order.unitId));
  const staying = Object.values(armies).filter((unit) => !leavingIds.has(unit.id));
  const events: ContestedTurnOutcome[] = [];
  const moved = [];
  const surrendered: UnitId[] = [];
  for (const order of going) {
    const unit = requireArmy(armies, order.unitId);
    const blocked = staying.some((other) => other.territoryId === order.to && other.factionId !== unit.factionId);
    const to = blocked ? retreatDestination(scenario, start, staying, unit.factionId, order.from, unit.id) : order.to;
    if (to === undefined) {
      surrendered.push(unit.id);
      events.push({ factionId: unit.factionId, from: order.from, kind: "path-surrender", men: unit.strength, unitId: unit.id });
    } else {
      moved.push(placeAt(unit, to));
      events.push({ kind: "withdrew", order: to === order.to ? order : { ...order, to } });
    }
  }
  return { armies: removeArmies(replaceArmies(armies, moved), surrendered), events };
}

/**
 * P5 (Q-PART-6), R1: defenders fall back inside the territory on a partial grade, but only into
 * what is left of their own pocket. An army whose pocket fell whole (judged on the start-of-turn
 * pocket; for one that entered this turn, its side's ground there) retreats under M21 (with the
 * P6 path out of that pocket, on the start-of-turn holders), even where its side holds another
 * pocket, reported in the battle that took its last ground. Units already leaving are not listed
 * twice.
 */
export function strandedDefenders(
  scenario: Scenario,
  start: GameState,
  armies: Armies,
  holdings: Holdings,
  results: readonly GroundResult[],
  leaving: readonly Leaving[]
): readonly Leaving[] {
  const listed = new Set<UnitId>(leaving.map((entry) => entry.unitId));
  const out: Leaving[] = [];
  const cutOff = (unit: UnitState, territoryId: TerritoryId): boolean => {
    const held = new Set(heldBy(scenario, holdings, territoryId, unit.factionId));
    const pocket = startPocket(scenario, start, unit.id, territoryId);
    return pocket === undefined ? held.size === 0 : !pocket.subTerritoryIds.some((id) => held.has(id));
  };
  for (const result of results) {
    if (subTerritoriesOf(scenario, result.territoryId).length === 0) continue;
    for (const loser of result.losers) {
      if (loser === result.gainer) continue;
      for (const unit of armiesIn(armies, result.territoryId)) {
        if (unit.factionId !== loser || listed.has(unit.id) || !cutOff(unit, result.territoryId)) continue;
        listed.add(unit.id);
        out.push({ from: result.territoryId, kind: "retreat", report: { battleIndex: result.battleIndex }, unitId: unit.id });
      }
    }
  }
  return out;
}

function withHoldings(draft: TurnDraft, holdings: Holdings, changes: readonly SubTerritoryChange[]): TurnDraft {
  return changes.length === 0 && holdings === draft.systems.subTerritories
    ? draft
    : { ...draft, subTerritoryChanges: [...draft.subTerritoryChanges, ...changes], systems: { ...draft.systems, subTerritories: holdings } };
}

/**
 * Step 6 under `provinces`: battle ground, returns and retreats (path rule) with the defenders
 * left without ground (P5), withdrawals, occupation.
 */
export const provincesOccupation: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const results = draft.front.battles.flatMap((pending) => groundOf(pending) ?? []);
  const ground = applyGround(scenario, draft.systems.subTerritories, results);
  const stranded = strandedDefenders(scenario, start, draft.armies, ground.holdings, results, draft.front.leaving);
  const settledBefore = draft.settled.length;
  const front = stranded.length === 0 ? draft.front : { ...draft.front, leaving: [...draft.front.leaving, ...stranded] };
  const afterRetreats = settleOccupation(withHoldings({ ...draft, front }, ground.holdings, ground.changes));
  const surrenders = pathSurrenders(scenario, start, afterRetreats.armies, afterRetreats.settled.slice(settledBefore));
  const withdrawn = withdraw(scenario, start, afterRetreats.armies, validWithdrawals(afterRetreats));
  const occupied = occupy(scenario, start, withdrawn.armies, afterRetreats.systems.subTerritories);
  return withHoldings(
    { ...afterRetreats, armies: withdrawn.armies, events: [...afterRetreats.events, ...surrenders, ...withdrawn.events] },
    occupied.holdings,
    occupied.changes
  );
};

/**
 * Step 7 under `provinces`: the standing battles' ground (the dice module fought them and settled
 * their retreats), then the retreat of any defender the ground left with nothing there (P5).
 */
export const provincesStanding: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const results = draft.standing.flatMap((pending) => groundOf(pending) ?? []);
  const ground = applyGround(scenario, draft.systems.subTerritories, results);
  const stranded = strandedDefenders(scenario, start, draft.armies, ground.holdings, results, []);
  const departures = settleDepartures(scenario, start, draft.armies, stranded);
  const settled = [...draft.settled, ...departures.settled];
  const standingIndexes = new Set(draft.standing.map((pending) => pending.battle.index));
  const fromStanding = settled.filter((entry) => "battleIndex" in entry.leaving.report && standingIndexes.has(entry.leaving.report.battleIndex));
  const surrenders = pathSurrenders(scenario, start, departures.armies, fromStanding);
  return withHoldings({ ...draft, armies: departures.armies, events: [...draft.events, ...surrenders], settled }, ground.holdings, ground.changes);
};

/**
 * Step 8 under `provinces`: the whole-territory flip (R2), the armies' pockets (R1), then
 * territory and city control from the holders. Rail damage ($8) is the economy's, at step 10
 * (`economy/queues.ts` `damageRail`, EB-6): it diffs the holders against the start of the turn,
 * which is the same rule.
 */
export const provincesControl: Phase = (draft) => {
  const { scenario, start } = draft.input;
  const flipped = flipWhole(scenario, start, draft.armies, draft.systems.subTerritories);
  const pockets = settlePockets(scenario, start, draft.armies, flipped.holdings, draft.orders.origins);
  const next = withHoldings(draft, flipped.holdings, flipped.changes);
  return {
    ...next,
    armies: pockets.armies,
    control: controlFromHolders(scenario, flipped.holdings, draft.control),
    events: [...next.events, ...flipped.events, ...pockets.events]
  };
};
