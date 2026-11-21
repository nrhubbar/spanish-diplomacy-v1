import { armyValue, isSuccessful } from "../engine/combat";
import { type AirBattleOutcome, type BattleOutcome, battleResults, type BattleSide, type FactionId, type GameState, type Scenario, type TerritoryId, type TurnOutcome } from "../engine/types";
import { airBattleFor } from "./battleAir";
import { isBattle } from "./grades";

/**
 * Turn-report grouping and measures for battles (C14). Pure: every number comes from the
 * engine's battle outcomes and the turn's final state. The words are in `battleText.ts`.
 */

/**
 * Which rule a battle was fought under. A standing battle (M27) is an assault whose attackers
 * all fought from the battle territory itself, because none of them moved this turn.
 */
export type BattleKind = "assault" | "entry" | "meeting" | "standing";

export function battleKind(battle: BattleOutcome): BattleKind {
  const { site } = battle;
  if (site.kind !== "assault") return site.kind;
  return battle.attacker.armies.every((army) => army.from === site.territoryId) ? "standing" : "assault";
}

/** One fought-over place: every battle there this turn, in resolution order. */
export interface BattleGroup {
  readonly battles: readonly IndexedBattle[];
  readonly key: string;
  readonly kind: BattleKind;
}

/** A battle and its position among the turn's outcomes, which seeds its flavor line. */
export interface IndexedBattle {
  /** R11: the air battle fought before it, if any. */
  readonly air?: AirBattleOutcome;
  readonly battle: BattleOutcome;
  readonly index: number;
}

export function siteKey(battle: BattleOutcome): string {
  const { site } = battle;
  return site.kind === "meeting" ? `meeting:${[...site.between].sort().join(":")}` : `${site.kind}:${site.territoryId}`;
}

/**
 * Battles grouped by place (section 1.6: several attackers at one territory share a card), the
 * most consequential first: places that changed hands, then the heaviest losses, then the
 * order the engine resolved them in.
 */
export function groupBattles(outcomes: readonly TurnOutcome[]): readonly BattleGroup[] {
  const groups = new Map<string, IndexedBattle[]>();
  outcomes.forEach((outcome, index) => {
    if (!isBattle(outcome)) return;
    const key = siteKey(outcome);
    const air = airBattleFor(outcomes, outcome);
    groups.set(key, [...(groups.get(key) ?? []), { ...(air === undefined ? {} : { air }), battle: outcome, index }]);
  });
  const men = (group: BattleGroup) => menLost(group.battles.map((entry) => entry.battle));
  return [...groups]
    .map(([key, battles]): BattleGroup => ({ battles, key, kind: kindOf(battles) }))
    .sort((a, b) => Number(changedHands(b)) - Number(changedHands(a)) || men(b) - men(a) || firstIndex(a) - firstIndex(b));
}

function kindOf(battles: readonly IndexedBattle[]): BattleKind {
  const first = battles[0];
  if (first === undefined) throw new Error("Invariant violated: a battle group needs a battle.");
  return battleKind(first.battle);
}

function firstIndex(group: BattleGroup): number {
  return group.battles[0]?.index ?? 0;
}

/**
 * The battle that decided a place: the attack whose faction moved in, or else the attack that
 * came closest. Its result heads the card and its dispatch line tells the story.
 */
export function decisiveBattle(group: BattleGroup): IndexedBattle {
  const [first] = group.battles;
  if (first === undefined) throw new Error("Invariant violated: a battle group needs a battle.");
  const site = first.battle.site;
  const occupier = site.kind !== "meeting" && site.occupation.kind === "taken" ? site.occupation.factionId : undefined;
  const rank = (entry: IndexedBattle) => attackRank(entry.battle);
  return group.battles.find((entry) => entry.battle.attackerFactionId === occupier)
    ?? group.battles.reduce((best, entry) => (rank(entry) > rank(best) ? entry : best), first);
}

/** The territory a group was fought over, or undefined for a meeting on the road. */
export function groupTerritory(group: BattleGroup): TerritoryId | undefined {
  const site = group.battles[0]?.battle.site;
  return site === undefined || site.kind === "meeting" ? undefined : site.territoryId;
}

export function changedHands(group: BattleGroup): boolean {
  const site = group.battles[0]?.battle.site;
  return site !== undefined && site.kind !== "meeting" && site.occupation.kind !== "held";
}

export function menLost(battles: readonly BattleOutcome[]): number {
  return battles.reduce((sum, battle) => sum + battle.losses.reduce((men, loss) => men + loss.men, 0), 0);
}

/** Men a side lost in one battle. */
export function sideLosses(battle: BattleOutcome, side: BattleSide): number {
  const ids = new Set(side.armies.map((army) => army.unitId));
  return battle.losses.filter((loss) => ids.has(loss.unitId)).reduce((men, loss) => men + loss.men, 0);
}

/** The factions on one side, strongest contribution first. */
export function sideFactions(side: BattleSide): readonly FactionId[] {
  const totals = new Map<FactionId, number>();
  for (const army of side.armies) totals.set(army.factionId, (totals.get(army.factionId) ?? 0) + army.value);
  return [...totals].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** The faction a result happened to, whose colour rings its medallion. */
export function affectedFaction(battle: BattleOutcome): FactionId {
  if (defenderSuffered(battle)) return sideFactions(battle.defender)[0] ?? battle.attackerFactionId;
  return battle.attackerFactionId;
}

/** Whether the result fell on the defenders: a defender result on the d6; ground taken, or the defenders hit harder, on the d20. */
function defenderSuffered(battle: BattleOutcome): boolean {
  if (battle.dice === "d6") return battle.result.startsWith("defender-");
  if (battle.ground !== 0) return true;
  const defenders = new Set(battle.defender.armies.map((army) => army.unitId));
  const men = (defending: boolean) => battle.losses.filter((loss) => defenders.has(loss.unitId) === defending).reduce((sum, loss) => sum + loss.men, 0);
  return men(true) > men(false);
}

/** How well an attack went, for picking a card's lead: the d6 result's rank, or the d20 ground then score. */
function attackRank(battle: BattleOutcome): number {
  if (battle.dice === "d6") return battleResults.indexOf(battle.result);
  const ground = battle.ground === "all" ? 3 : battle.ground;
  return ground * 100 + battle.score;
}

/** Whether an attack succeeded (M16, M18): a successful d6 result, or a d20 grade that took the whole territory. */
export function attackSucceeded(battle: BattleOutcome): boolean {
  return battle.dice === "d6" ? isSuccessful(battle.result) : battle.ground === "all";
}

/** Attack value left to a claimant after its own losses (M18), from the turn's final state. */
export function attackLeft(scenario: Scenario, finalState: GameState, battle: BattleOutcome): number {
  return battle.attacker.armies.reduce((sum, army) => {
    const unit = finalState.units[army.unitId];
    return unit === undefined ? sum : sum + armyValue(scenario, unit, "attack");
  }, 0);
}

/** Successful attackers in a group: the claimants of section 1.6 step 2. */
export function claimants(group: BattleGroup): readonly BattleOutcome[] {
  return group.battles.map((entry) => entry.battle).filter(attackSucceeded);
}
