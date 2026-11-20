import { isContested } from "../partition/holders";
import { hookedRecruitRequirements, hookedReplenishBonus } from "../hooks";
import { scaleResources } from "../resources";
import type {
  BuildingId,
  FactionId,
  GameState,
  RaisedUnitDefinition,
  RecruitOrder,
  ReplenishOrder,
  Resources,
  Scenario,
  SubTerritoryId,
  TerritoryId,
  UnitId,
  UnitState,
  UnitTypeDefinition,
  UnitTypeId,
  ValidationResult
} from "../types";

/**
 * The recruitment module's rules (R1-R7, C8), as pure questions about a scenario and a state.
 * The engine parts (`phases.ts`), the order validator, the Recruit tab and the computer player
 * all ask these, so the pane never offers what the engine would refuse.
 */

/** W6: the partition module's one test of contested ground (m3r1-sub-territories). */
export { isContested };

/** W3: the territory's capital sub-territory, when the scenario has sub-territories. */
export function capitalOf(scenario: Scenario, territoryId: TerritoryId): SubTerritoryId | undefined {
  return scenario.index.territories.get(territoryId)?.capitalSubTerritoryId;
}

/** R2: the faction controls the territory, and holds its capital sub-territory. */
export function holdsTerritory(scenario: Scenario, state: Pick<GameState, "control" | "subTerritories">, factionId: FactionId, territoryId: TerritoryId): boolean {
  const control = state.control[territoryId];
  if (control?.kind !== "controlled" || control.factionId !== factionId) return false;
  const capital = capitalOf(scenario, territoryId);
  return capital === undefined || state.subTerritories[capital]?.holder === factionId;
}

const territoryLabel = (scenario: Scenario, territoryId: TerritoryId): string => scenario.index.territories.get(territoryId)?.name ?? territoryId;
const subLabel = (scenario: Scenario, id: SubTerritoryId): string => scenario.index.subTerritories.get(id)?.name ?? id;
const buildingLabel = (scenario: Scenario, id: BuildingId): string => scenario.index.buildings.get(id)?.name ?? id;

/** R2, C1, C8: why the faction cannot recruit in this territory at all, or undefined when it can. */
export function recruitSiteProblem(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId): string | undefined {
  if (scenario.recruitment === undefined) return "Recruiting is not part of this scenario.";
  const name = territoryLabel(scenario, territoryId);
  if (isContested(scenario, state, territoryId)) return `${name} is contested. No new units can be recruited there.`;
  if (!holdsTerritory(scenario, state, factionId, territoryId)) return `You must hold ${name} to recruit there.`;
  return undefined;
}

/** The buildings standing in the territory's capital sub-territory now. */
export function capitalBuildings(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId): readonly BuildingId[] {
  const capital = capitalOf(scenario, territoryId);
  return capital === undefined ? [] : state.subTerritories[capital]?.buildings ?? [];
}

/** What locks one unit type, in words: one reason per missing condition. */
export interface TypeLock {
  /** R3: buildings the capital lacks, in the type's order. */
  readonly missingBuildings: readonly BuildingId[];
  readonly reasons: readonly string[];
}

/**
 * R2, R3: why the faction cannot recruit this type here, besides the site itself. Faction limits
 * and the capital's buildings are read from the state (buildings are captured intact, $5); other
 * areas add their reasons through the `recruitRequirements` hook.
 */
export function typeLock(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId, type: UnitTypeDefinition): TypeLock {
  const recruit = type.recruit;
  if (recruit === undefined) return { missingBuildings: [], reasons: [`${type.name} cannot be recruited.`] };
  const reasons: string[] = [];
  if (recruit.factionIds !== undefined && !recruit.factionIds.includes(factionId)) {
    reasons.push(`Not raised by the ${scenario.index.factions.get(factionId)?.name ?? factionId}.`);
  }
  const standing = new Set(capitalBuildings(scenario, state, territoryId));
  const missingBuildings = recruit.requires.filter((id) => !standing.has(id));
  const capital = capitalOf(scenario, territoryId);
  if (missingBuildings.length > 0) {
    const where = capital === undefined ? territoryLabel(scenario, territoryId) : subLabel(scenario, capital);
    reasons.push(`Needs ${listWords(missingBuildings.map((id) => `a ${buildingLabel(scenario, id)}`))} in ${where}.`);
  }
  if (capital !== undefined) {
    reasons.push(...hookedRecruitRequirements({ factionId, scenario, state, subTerritoryId: capital, territoryId, unitTypeId: type.id }));
  }
  return { missingBuildings, reasons };
}

/** D7: Recruit orders the territory may take this turn: the scenario's number plus its capital's `recruit-slots` buildings. */
export function recruitSlots(scenario: Scenario, state: Pick<GameState, "subTerritories">, territoryId: TerritoryId): number {
  const base = scenario.recruitment?.maxPerTerritory ?? 0;
  return capitalBuildings(scenario, state, territoryId).reduce((sum, id) => {
    const effects = scenario.index.buildings.get(id)?.effects ?? [];
    return sum + effects.reduce((extra, effect) => extra + (effect.kind === "recruit-slots" ? effect.extra : 0), 0);
  }, base);
}

/** The unit types every faction sees in the Recruit list, in scenario order (R2: every type is listed). */
export function recruitableTypes(scenario: Scenario): readonly UnitTypeDefinition[] {
  return scenario.unitTypes.filter((type) => type.recruit !== undefined);
}

/** R2, R3: static checks of one Recruit order against the start-of-turn state. Funds and the D7 limit are checked at reveal. */
export function validateRecruitOrder(scenario: Scenario, state: GameState, order: RecruitOrder): ValidationResult {
  const type = scenario.index.unitTypes.get(order.unitTypeId);
  if (type === undefined) return { ok: false, reason: "Unknown unit type." };
  if (!scenario.index.territories.has(order.territoryId)) return { ok: false, reason: "Unknown territory." };
  const site = recruitSiteProblem(scenario, state, order.factionId, order.territoryId);
  if (site !== undefined) return { ok: false, reason: site };
  const lock = typeLock(scenario, state, order.factionId, order.territoryId, type);
  return lock.reasons.length === 0 ? { ok: true } : { ok: false, reason: lock.reasons.join(" ") };
}

// R6: recruited units' ids and definitions. ---------------------------------------------------

const raisedPrefix = "r";
const raisedSeparator = "_";

/**
 * R6: a recruited unit's id: `r_<faction>_<type>_<serial>`, where the serial counts the
 * faction's units of that type raised or in training. Scenario ids are kebab-case, so the
 * underscore never occurs in them and the id parses back unambiguously.
 */
export function raisedUnitId(factionId: FactionId, typeId: UnitTypeId, serial: number): UnitId {
  return [raisedPrefix, factionId, typeId, String(serial)].join(raisedSeparator) as UnitId;
}

/** The next serial for a faction's type: one past every serial already raised or in training. */
export function nextRaisedSerial(state: Pick<GameState, "raised" | "training">, factionId: FactionId, typeId: UnitTypeId): number {
  const ids = [...Object.keys(state.raised), ...state.training.map((item) => item.unitId)];
  return ids.reduce((max, id) => {
    const parsed = parseRaisedId(id as UnitId);
    return parsed !== undefined && parsed.factionId === factionId && parsed.typeId === typeId ? Math.max(max, parsed.serial) : max;
  }, 0) + 1;
}

function parseRaisedId(id: UnitId): { readonly factionId: FactionId; readonly serial: number; readonly typeId: UnitTypeId } | undefined {
  const parts = id.split(raisedSeparator);
  if (parts.length !== 4 || parts[0] !== raisedPrefix) return undefined;
  const serial = Number(parts[3]);
  if (!Number.isInteger(serial) || serial < 1) return undefined;
  return { factionId: parts[1] as FactionId, serial, typeId: parts[2] as UnitTypeId };
}

/**
 * R6: the definition of a recruited unit, derived from its id alone: the type's name and
 * establishment, numbered by its serial. `GameState.raised` records the same definition; this
 * lets every lookup that has only the scenario name the unit. Undefined for other ids.
 */
export function raisedDefinition(scenario: Scenario, id: UnitId): RaisedUnitDefinition | undefined {
  const parsed = parseRaisedId(id);
  if (parsed === undefined || !scenario.index.factions.has(parsed.factionId)) return undefined;
  const type = scenario.index.unitTypes.get(parsed.typeId);
  if (type?.recruit === undefined) return undefined;
  return {
    factionId: parsed.factionId,
    fullStrength: type.recruit.establishment,
    id,
    name: `${type.name} No. ${String(parsed.serial)}`,
    type: type.id
  };
}

/**
 * R6: a recruited unit's place in "scenario order" tie-breaks (M26): after every scenario unit,
 * by serial, then type, then faction, in scenario order. Undefined for other ids.
 */
export function raisedOrder(scenario: Scenario, id: UnitId): number | undefined {
  const parsed = parseRaisedId(id);
  if (parsed === undefined) return undefined;
  const typeIndex = scenario.unitTypes.findIndex((type) => type.id === parsed.typeId);
  const factionIndex = scenario.factions.findIndex((entry) => entry.id === parsed.factionId);
  if (typeIndex < 0 || factionIndex < 0) return undefined;
  return scenario.units.length + ((parsed.serial * scenario.unitTypes.length + typeIndex) * scenario.factions.length + factionIndex);
}

// R5: Replenish. ----------------------------------------------------------------------------

/** R5: what a Replenish order would do for a unit now. */
export interface ReplenishQuote {
  /** Men it restores this turn. */
  readonly men: number;
  /** Price, paid at reveal and refunded if a battle cancels it. */
  readonly cost: Resources;
  /** R5, Q-MIS-b-2: it clears demoralization. */
  readonly recovers: boolean;
  /** The most men a Replenish restores per turn for this unit here (cap, with building bonuses). */
  readonly perTurn: number;
}

/** The type and full strength of any unit in play, raised or from the scenario. */
function unitBasics(scenario: Scenario, state: Pick<GameState, "raised">, unitId: UnitId): { readonly fullStrength: number; readonly type: UnitTypeDefinition } | undefined {
  const definition = state.raised[unitId] ?? scenario.index.units.get(unitId) ?? raisedDefinition(scenario, unitId);
  const type = definition === undefined ? undefined : scenario.index.unitTypes.get(definition.type);
  return definition === undefined || type === undefined ? undefined : { fullStrength: definition.fullStrength, type };
}

/**
 * R5, D7: men restored are capped per turn at `replenishShare` of the unit's full strength,
 * plus the `replenishBonus` hook's rate and cap shares (Hospital, Depot). The price is
 * `replenishCostShare` of the type's Recruit cost for the share of full strength restored, so
 * each value point costs half as much as recruiting it new. Rounded up per resource.
 */
export function replenishQuote(scenario: Scenario, state: GameState, unit: UnitState): ReplenishQuote | undefined {
  const rules = scenario.recruitment;
  const basics = unitBasics(scenario, state, unit.id);
  if (rules === undefined || basics?.type.recruit === undefined) return undefined;
  const bonus = hookedReplenishBonus({ scenario, state, territoryId: unit.territoryId, unitId: unit.id });
  const perTurn = Math.floor((rules.replenishShare + bonus.rateShare + bonus.capShare) * basics.fullStrength);
  const men = Math.max(0, Math.min(perTurn, basics.fullStrength - unit.strength));
  const cost = scaleResources(basics.type.recruit.cost, (rules.replenishCostShare * men) / basics.fullStrength);
  return { cost, men, perTurn, recovers: unit.morale.demoralized };
}

/** R5, C1, C5: static checks of one Replenish order against the start-of-turn state. */
export function validateReplenishOrder(scenario: Scenario, state: GameState, order: ReplenishOrder): ValidationResult {
  const unit = state.units[order.unitId];
  if (unit === undefined) return { ok: false, reason: "Unknown unit." };
  if (unit.factionId !== order.factionId) return { ok: false, reason: "Selected unit belongs to another player." };
  const problem = replenishProblem(scenario, state, unit);
  return problem === undefined ? { ok: true } : { ok: false, reason: problem };
}

/** Why this unit cannot replenish now, or undefined when it can. */
export function replenishProblem(scenario: Scenario, state: GameState, unit: UnitState): string | undefined {
  const basics = unitBasics(scenario, state, unit.id);
  if (scenario.recruitment === undefined || basics === undefined) return "Replenishing is not part of this scenario.";
  if (!basics.type.orders.includes("replenish") || basics.type.recruit === undefined) return `${basics.type.name} units cannot replenish.`;
  const name = territoryLabel(scenario, unit.territoryId);
  if (isContested(scenario, state, unit.territoryId)) return `${name} is contested. Units replenish only in uncontested ground.`;
  const control = state.control[unit.territoryId];
  if (control?.kind !== "controlled" || control.factionId !== unit.factionId) return `Units replenish only in territory you hold.`;
  if (unit.strength >= basics.fullStrength && !unit.morale.demoralized) return "This unit is at full strength and in good order.";
  return undefined;
}

function listWords(words: readonly string[]): string {
  const last = words.length - 1;
  return last < 1 ? words.join("") : `${words.slice(0, last).join(", ")} and ${String(words[last])}`;
}
