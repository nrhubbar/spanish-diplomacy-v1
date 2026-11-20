import type {
  ArmyLoss,
  BattleArmy,
  D6BattleOutcome,
  BattleResult,
  BattleSite,
  CombatModifier,
  Retreat,
  TurnOutcome
} from "../main/engine/types";
import { faction, move, territory, unit } from "./support";

/**
 * Hand-built battle outcomes for presentation tests. They follow the D6BattleOutcome contract but
 * are not produced by the resolver, so their numbers are illustrative, not engine-exact.
 */

export function army(unitId: string, factionId: string, from: string, value: number): BattleArmy {
  return { factionId: faction(factionId), from: territory(from), unitId: unit(unitId), value };
}

export function side(...armies: readonly BattleArmy[]) {
  return { armies, value: armies.reduce((sum, entry) => sum + entry.value, 0) };
}

export function loss(unitId: string, men: number, destroyed = false): ArmyLoss {
  return { destroyed, men, unitId: unit(unitId) };
}

export function retreat(unitId: string, from: string, to: string): Retreat {
  return { from: territory(from), to: territory(to), unitId: unit(unitId) };
}

export const dugIn = (level: number): CombatModifier => ({ kind: "dug-in", level, roll: -level });

export const resistance: CombatModifier = {
  factionId: faction("republic"),
  kind: "faction",
  modifierId: "popular-resistance",
  name: "Popular resistance",
  role: "defence",
  roll: -1
};

interface BattleInput {
  readonly attacker: ReturnType<typeof side>;
  readonly attackerFactionId: string;
  readonly column: number;
  readonly defender: ReturnType<typeof side>;
  readonly demoralized?: readonly string[];
  readonly die: number;
  readonly losses?: readonly ArmyLoss[];
  readonly modifiers?: readonly CombatModifier[];
  readonly oddsLabel: string;
  readonly result: BattleResult;
  readonly retreats?: readonly Retreat[];
  readonly site: BattleSite;
  readonly surrendered?: readonly string[];
}

export function battle(input: BattleInput): D6BattleOutcome {
  const modifiers = input.modifiers ?? [];
  const raw = modifiers.reduce((sum, modifier) => sum + modifier.roll, input.die);
  return {
    dice: "d6",
    attacker: input.attacker,
    attackerFactionId: faction(input.attackerFactionId),
    column: input.column,
    defender: input.defender,
    demoralizedUnitIds: (input.demoralized ?? []).map(unit),
    die: input.die,
    kind: "battle",
    losses: input.losses ?? [],
    modifiers,
    oddsLabel: input.oddsLabel,
    result: input.result,
    retreats: input.retreats ?? [],
    row: Math.min(6, Math.max(0, raw)),
    site: input.site,
    surrenderedUnitIds: (input.surrendered ?? []).map(unit)
  };
}

const clmDefenders = side(army("rep-wad-ras-1", "republic", "castilla-la-mancha", 6));
const clmTaken: BattleSite = { kind: "assault", occupation: { factionId: faction("south"), kind: "taken" }, territoryId: territory("castilla-la-mancha") };

/** Section 1.6: two factions attack Castilla-La Mancha at once; only the south succeeds. */
export const threeSidedAssault: readonly D6BattleOutcome[] = [
  battle({
    attacker: side(army("north-san-quintin-25", "north", "castilla-y-leon", 4)),
    attackerFactionId: "north",
    column: 0,
    defender: clmDefenders,
    demoralized: ["north-san-quintin-25"],
    die: 5,
    modifiers: [dugIn(1), resistance, { halvings: 1, kind: "odds-halving", roll: -1 }],
    oddsLabel: "1:2",
    result: "attacker-demoralized",
    site: clmTaken
  }),
  battle({
    attacker: side(army("south-granada-6", "south", "andalucia", 4), army("south-lepanto-5", "south", "andalucia", 4)),
    attackerFactionId: "south",
    column: 1,
    defender: clmDefenders,
    die: 6,
    losses: [loss("rep-wad-ras-1", 550, true), loss("south-granada-6", 450)],
    modifiers: [dugIn(1), resistance],
    oddsLabel: "1:1",
    result: "defender-exchange",
    site: clmTaken
  })
];

/** An ordinary two-sided assault on dug-in, defended Madrid that costs the attacker men. */
export const madridRepulsed: D6BattleOutcome = battle({
  attacker: side(army("north-san-marcial-22", "north", "castilla-y-leon", 4), army("north-la-victoria-28", "north", "castilla-y-leon", 4)),
  attackerFactionId: "north",
  column: 1,
  defender: side(army("rep-covadonga-4", "republic", "madrid", 6)),
  die: 2,
  losses: [loss("north-san-marcial-22", 700, true), loss("north-la-victoria-28", 350)],
  modifiers: [dugIn(2), resistance],
  oddsLabel: "1:1",
  result: "attacker-attrition",
  site: { kind: "assault", occupation: { kind: "held" }, territoryId: territory("madrid") }
});

/** C9: a head-on swap between Navarra and the Basque Country. */
export const roadMeeting: D6BattleOutcome = battle({
  attacker: side(army("north-america-23", "north", "navarra", 4)),
  attackerFactionId: "north",
  column: 1,
  defender: side(army("rep-basque-column", "republic", "pais-vasco", 4)),
  demoralized: ["rep-basque-column"],
  die: 4,
  oddsLabel: "1:1",
  result: "defender-demoralized",
  site: { between: [territory("navarra"), territory("pais-vasco")], kind: "meeting", winner: faction("north") }
});

/** M27: armies of two factions still in Asturias fight where they stand. */
export const standingBattle: D6BattleOutcome = battle({
  attacker: side(army("north-milan-32", "north", "asturias", 4), army("north-simancas-40", "north", "asturias", 4)),
  attackerFactionId: "north",
  column: 2,
  defender: side(army("rep-asturian-militia", "republic", "asturias", 4)),
  demoralized: ["rep-asturian-militia", "north-simancas-40"],
  die: 3,
  modifiers: [resistance],
  oddsLabel: "2:1",
  result: "both-demoralized",
  site: { kind: "assault", occupation: { kind: "held" }, territoryId: territory("asturias") }
});

/** Section 1.6 step 3: two factions enter empty Extremadura; the stronger stands as defender. */
export const contestedEntry: D6BattleOutcome = battle({
  attacker: side(army("rep-vitoria-8", "republic", "andalucia", 4)),
  attackerFactionId: "republic",
  column: 1,
  defender: side(army("south-cadiz-33", "south", "andalucia", 4)),
  die: 1,
  losses: [loss("rep-vitoria-8", 785, true)],
  oddsLabel: "1:1",
  result: "attacker-eliminated",
  site: { kind: "entry", occupation: { factionId: faction("south"), kind: "taken" }, territoryId: territory("extremadura") }
});

/** A surrender after a lost battle: the defenders had nowhere to go. */
export const surrenderAfterBattle: D6BattleOutcome = battle({
  attacker: side(army("south-legion", "south", "andalucia", 6), army("south-regulares", "south", "andalucia", 6)),
  attackerFactionId: "south",
  column: 3,
  defender: side(army("rep-sevilla-34", "republic", "murcia", 3)),
  demoralized: ["rep-sevilla-34"],
  die: 5,
  modifiers: [resistance],
  oddsLabel: "4:1",
  result: "defender-demoralized",
  site: { kind: "assault", occupation: { factionId: faction("south"), kind: "taken" }, territoryId: territory("murcia") },
  surrendered: ["rep-sevilla-34"]
});

/** Every kind of battle card and status, for the Spain scenario. */
export function spainShowcaseOutcomes(): readonly TurnOutcome[] {
  return [
    roadMeeting,
    ...threeSidedAssault,
    madridRepulsed,
    standingBattle,
    contestedEntry,
    surrenderAfterBattle,
    { kind: "reinforcement-arrived", order: move("republic", "rep-otumba-9", "valencia", "castilla-la-mancha") },
    { factionId: faction("republic"), kind: "recovered", territoryId: territory("valencia"), unitId: unit("rep-guadalajara-10") },
    {
      cause: { holdingFactionIds: [faction("south")], kind: "held" },
      kind: "bounced-move",
      order: move("republic", "rep-durruti-column", "catalunya", "aragon"),
      retreatedTo: territory("valencia")
    }
  ];
}
