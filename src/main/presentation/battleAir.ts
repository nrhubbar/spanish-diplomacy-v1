import type { AirBattleOutcome, AirBattleRow, BattleOutcome, Scenario, TurnOutcome } from "../engine/types";
import { glyphs } from "./glyphs";
import { signed } from "./odds";
import type { RollLedgerData, RollLedgerRow } from "./rollLedger";
import { factionName, listNames, territoryName, unitName } from "./text";

/**
 * U10, R11: the air battle on a battle card, as the d20 battle's roll is shown: the one die, both
 * sides' aircraft and AA in one ledger (plus helps the attacker), the score, the table's rows with
 * the one it hit, who got Ground Support, who was driven off and who was lost. Pure; `screens/report/BattleAir.tsx` draws it.
 */

/** The air battle fought before a battle: the one over its territory with the same attacker. Meetings on the road have none. */
export function airBattleFor(outcomes: readonly TurnOutcome[], battle: BattleOutcome): AirBattleOutcome | undefined {
  const { site } = battle;
  if (site.kind === "meeting") return undefined;
  return outcomes.find((outcome): outcome is AirBattleOutcome =>
    outcome.kind === "air-battle" && outcome.territoryId === site.territoryId && outcome.input.attacker.factionId === battle.attackerFactionId);
}

/** One row of the air battle table, as the card lists it. */
export interface AirBandView {
  /** "Defenders' Ground Support; attackers lose one aircraft". */
  readonly effect: string;
  readonly hit: boolean;
  readonly name: string;
  /** "9-12". */
  readonly range: string;
}

export interface AirBattleView {
  readonly bands: readonly AirBandView[];
  /** "−2, kept within 0 to 20" when the score had to be kept on the table. */
  readonly clamp: string | undefined;
  readonly die: number;
  readonly ledger: RollLedgerData;
  /** What the air battle did to each side: its losses, and its Ground Support. */
  readonly results: readonly string[];
  readonly score: number;
}

type Role = "attacker" | "defender";

const missionNames = { patrol: "on Patrol", support: "on Ground Support" } as const;
const roleNames = { attacker: "attackers", defender: "defenders" } as const;

function ledgerOf(scenario: Scenario, { input, territoryId }: AirBattleOutcome): RollLedgerData {
  const rows = (role: Role, sign: 1 | -1): readonly RollLedgerRow[] => [
    ...input[role].aircraft.map((aircraft) => ({ label: `${unitName(scenario, aircraft.unitId)} ${missionNames[aircraft.mission]} ${glyphs.dot} ${roleNames[role]}`, value: sign * aircraft.airRoll })),
    ...(input[role].antiAir > 0 ? [{ label: `Anti-air in ${territoryName(scenario, territoryId)} ${glyphs.dot} ${roleNames[role]}`, value: sign * input[role].antiAir }] : [])
  ];
  const all = [...rows("attacker", 1), ...rows("defender", -1)];
  return { rows: all.filter((row) => row.value !== 0), total: all.reduce((sum, row) => sum + row.value, 0) };
}

/** "one aircraft", "2 aircraft". */
export function aircraftCount(count: number): string {
  return `${count === 1 ? "one" : String(count)} aircraft`;
}

/** Whose Ground Support a row gives, and what becomes of the other side's aircraft. */
function bandEffect({ aircraftLost, support }: AirBattleRow): string {
  const lost = (["attacker", "defender"] as const)
    .filter((role) => aircraftLost[role] > 0)
    .map((role) => `${roleNames[role]} lose ${aircraftCount(aircraftLost[role])}`);
  if (support === "none") return ["No Ground Support", ...(lost.length === 0 ? ["every aircraft returns home"] : lost)].join("; ");
  const [winner, loser] = support === "attacker" ? ["Attackers'", "defenders"] : ["Defenders'", "attackers"];
  return [`${winner} Ground Support`, ...(lost.length === 0 ? [`${loser} driven off`] : lost)].join("; ");
}

/** The table's rows, each with its range of scores and what it gives. */
export function airBands(table: readonly AirBattleRow[], score: number): readonly AirBandView[] {
  return table.map((row, index) => {
    const from = (table[index - 1]?.upTo ?? -1) + 1;
    return {
      effect: bandEffect(row),
      hit: score >= from && score <= row.upTo,
      name: row.name,
      range: from === row.upTo ? String(from) : `${String(from)}\u2013${String(row.upTo)}`
    };
  });
}

/** "+3 x 2 aircraft = +6": the support that counted, per aircraft when they add the same. */
function supportSum({ input, support }: AirBattleOutcome, role: Role): string {
  const { roll, unitIds } = support[role];
  const each = input[role].aircraft.filter((aircraft) => unitIds.includes(aircraft.unitId)).map((aircraft) => aircraft.supportRoll);
  const most = Math.max(...each);
  const count = `${String(unitIds.length)} aircraft`;
  return each.every((value) => value === most) ? `+${String(most)} ${glyphs.times} ${count} = +${String(roll)}` : `+${String(roll)} from ${count}`;
}

/** R11: what the air battle did to one side: the aircraft it lost, then its Ground Support or what became of its other aircraft. */
function sideResults(scenario: Scenario, outcome: AirBattleOutcome, role: Role): readonly string[] {
  const { aircraft } = outcome.input[role];
  const { support } = outcome.result.row;
  // A side can be several factions: each is named by its own aircraft.
  const owners = (some: typeof aircraft): readonly string[] => [...new Set(some.map((entry) => factionName(scenario, entry.factionId)))];
  const lost = aircraft.filter(({ unitId }) => outcome.aircraftLost.includes(unitId));
  const left = aircraft.filter(({ unitId }) => !outcome.aircraftLost.includes(unitId));
  const losses = lost.map((entry) => `${factionName(scenario, entry.factionId)} loses ${unitName(scenario, entry.unitId)}, shot down.`);
  if (support === role) {
    const counts = outcome.support[role].roll > 0
      ? `${listNames(owners(aircraft.filter(({ unitId }) => outcome.support[role].unitIds.includes(unitId))))}'s Ground Support counts: ${supportSum(outcome, role)} on the ${role === "attacker" ? "attack" : "defence"} roll.`
      : `${aircraft.length === 0 ? factionName(scenario, outcome.input[role].factionId) : listNames(owners(aircraft))} wins the air, but has no Ground Support to give.`;
    return [...losses, counts];
  }
  return [...losses, ...owners(left).map((name) => {
    const theirs = left.filter((entry) => factionName(scenario, entry.factionId) === name);
    const without = theirs.some((entry) => entry.mission === "support") ? " and give no Ground Support" : "";
    const other = lost.some((entry) => factionName(scenario, entry.factionId) === name) ? "other " : "";
    return `${name}'s ${other}aircraft ${support === "none" ? "return home" : "are driven off"}${without}.`;
  })];
}

/** The card's view of an air battle. */
export function airBattleView(scenario: Scenario, outcome: AirBattleOutcome): AirBattleView {
  const { die, modifier, score } = outcome.result;
  const raw = die + modifier;
  return {
    bands: airBands(scenario.air?.battleTable ?? [], score),
    clamp: raw === score ? undefined : `${raw < 0 ? signed(raw) : String(raw)}, kept within 0 to 20`,
    die,
    ledger: ledgerOf(scenario, outcome),
    results: (["attacker", "defender"] as const).flatMap((role) => sideResults(scenario, outcome, role)),
    score
  };
}
