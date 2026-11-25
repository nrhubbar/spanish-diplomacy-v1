import { citiesIn } from "../engine/lookup";
import { deriveSeed } from "../engine/random";
import type { BattleOutcome, Scenario, TerritoryId, UnitId } from "../engine/types";
import { resultKeyOf } from "./grades";
import { type BattleGroup, changedHands, menLost, sideFactions, sideLosses } from "./battle";
import { glyphs } from "./glyphs";
import { fillLine, linePlaceholders, outcomeLine, outcomeText, type OutcomeValues } from "./outcomeText";
import { factionName, listNames, territoryName } from "./text";

/** Turn-report words for battles: places, flavor values, headlines, and the summary line (C14). */

const numberFormat = new Intl.NumberFormat("en-GB");

export function formatMen(men: number): string {
  return numberFormat.format(men);
}

/** "the road between Toledo and Madrid", for meeting battles fought between two territories. */
export function roadName(scenario: Scenario, between: readonly [TerritoryId, TerritoryId]): string {
  return `the road between ${listNames(between.map((id) => territoryName(scenario, id)))}`;
}

/** Where a battle was fought, as a place name for headings and flavor text. */
export function placeName(scenario: Scenario, battle: BattleOutcome): string {
  const { site } = battle;
  return site.kind === "meeting" ? roadName(scenario, site.between) : territoryName(scenario, site.territoryId);
}

/** The placeholder values `outcomeLine` needs for one battle (H's contract). */
export function flavorValues(scenario: Scenario, battle: BattleOutcome): OutcomeValues {
  const { site } = battle;
  const territoryId = site.kind === "meeting" ? undefined : site.territoryId;
  const city = territoryId === undefined ? undefined : citiesIn(scenario, territoryId)[0];
  const origins = [...new Set(battle.attacker.armies.map((army) => army.from))].filter((id) => id !== territoryId);
  const defenderIds = new Set(battle.defender.armies.map((army) => army.unitId));
  const retreat = battle.retreats.find((entry) => defenderIds.has(entry.unitId));
  return {
    attacker: factionName(scenario, battle.attackerFactionId),
    defender: listNames(sideFactions(battle.defender).map((id) => factionName(scenario, id))),
    losses: formatMen(sideLosses(battle, battle.attacker)),
    territory: placeName(scenario, battle),
    ...(city === undefined ? {} : { city: city.name }),
    ...(origins.length === 1 && origins[0] !== undefined ? { origin: territoryName(scenario, origins[0]) } : {}),
    ...(retreat === undefined ? {} : { retreat: territoryName(scenario, retreat.to) })
  };
}

/** A game's public id as a number, so its battle lines read the same on every screen. Nothing to do with its dice. */
export function flavorKey(gameId: string): number {
  return [...Array(gameId.length).keys()].reduce((hash, index) => (Math.imul(hash, 31) + gameId.charCodeAt(index)) >>> 0, 7);
}

/** A stable seed for a battle's flavor line, so a replay of the same game reads the same. */
export function flavorSeed(gameSeed: number, turnNumber: number, index: number): number {
  return deriveSeed(gameSeed, turnNumber, index);
}

/** Text that starts with a lower-case place phrase ("the road between...") reads as a sentence. */
export function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "8:1" for odds, but the table column caps at 6:1 and column 0 is everything below 1:1. */
export function columnLabel(column: number): string {
  return column === 0 ? "below 1:1" : `${String(column)}:1`;
}

/** Who holds the place now, in one line. */
export function occupationLine(scenario: Scenario, battle: BattleOutcome): string {
  const { site } = battle;
  if (site.kind === "meeting") {
    return site.winner === undefined
      ? "Neither side won the road; both returned."
      : `The ${factionName(scenario, site.winner)} won the road and continued its move.`;
  }
  const place = territoryName(scenario, site.territoryId);
  switch (site.occupation.kind) {
    case "held":
      return `${place} held by the ${listNames(sideFactions(battle.defender).map((id) => factionName(scenario, id)))}.`;
    case "taken":
      return `The ${factionName(scenario, site.occupation.factionId)} took ${place}.`;
    case "left-empty":
      return `${place} was left empty.`;
  }
}

/** Armies a battle destroyed, outright or by surrender. */
export function lostArmies(battle: BattleOutcome): readonly UnitId[] {
  return [...battle.losses.filter((loss) => loss.destroyed).map((loss) => loss.unitId), ...battle.surrenderedUnitIds];
}

/** The line at the top of the report: "3 battles - 1 territory taken - 1,240 men lost". */
export function battleSummary(groups: readonly BattleGroup[]): string {
  const battles = groups.flatMap((group) => group.battles.map((entry) => entry.battle));
  const count = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;
  const taken = groups.filter((group) => changedHands(group)).length;
  const men = menLost(battles);
  const destroyed = battles.reduce((sum, battle) => sum + lostArmies(battle).length, 0);
  const shaken = battles.reduce((sum, battle) => sum + battle.demoralizedUnitIds.length, 0);
  return [
    count(groups.length, "battle", "battles"),
    ...(taken > 0 ? [`${count(taken, "territory", "territories")} changed hands`] : []),
    ...(men > 0 ? [`${formatMen(men)} men lost`] : []),
    ...(destroyed > 0 ? [`${count(destroyed, "unit", "units")} destroyed`] : []),
    ...(shaken > 0 ? [`${count(shaken, "unit", "units")} demoralized`] : [])
  ].join(` ${glyphs.dot} `);
}

/** Words in a dispatch line that say someone now holds the place. */
const occupationClaim = /\b(took|taken|occupied|occupy|now hold|held every road|changed hands|overrun|fallen)\b/i;

/**
 * The card's one dispatch line. When the place was left empty (section 1.6: tied claimants all
 * returned), a line that says the attacker took or holds it would contradict the headline, so
 * only lines that claim no occupation are used, and a plain line stands in if none fits.
 */
export function cardFlavor(scenario: Scenario, battle: BattleOutcome, seed: number): string {
  const values = flavorValues(scenario, battle);
  const { site } = battle;
  const result = resultKeyOf(scenario, battle);
  if (site.kind === "meeting" || site.occupation.kind !== "left-empty") return sentenceCase(outcomeLine(result, values, seed));
  const fitting = outcomeText[result].lines.filter((line) =>
    !occupationClaim.test(line) && linePlaceholders(line).every((name) => Object.hasOwn(values, name)));
  const line = fitting[seed % Math.max(1, fitting.length)];
  return line === undefined
    ? `${sentenceCase(placeName(scenario, battle))} was left empty. The attackers who broke in were too evenly matched for any of them to hold it.`
    : sentenceCase(fillLine(line, values));
}
