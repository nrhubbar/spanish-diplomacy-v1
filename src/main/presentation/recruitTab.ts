import { capitalBuildings, recruitableTypes, recruitSiteProblem, recruitSlots, typeLock } from "../engine/recruitment/rules";
import { canAfford } from "../engine/resources";
import type { FactionId, GameState, Resources, Scenario, TerritoryId, UnitTypeDefinition } from "../engine/types";
import { trainingEntries, type TrainingEntry } from "./queues";
import { recruitRequirements, recruitSiteName, type RecruitsWith, recruitsWith, shortfallLabel } from "./recruitment";
import { refusalText } from "./refusals";
import { unitEffectLines } from "./unitEffects";

/** U9, X4, N2: the Recruit tab's board: what one territory recruits with, its slots, its unit types and the units in training. */

export interface RecruitTypeRow {
  readonly effects: readonly string[];
  /** Why the type is locked here; empty when it can be recruited. */
  readonly locked: readonly string[];
  readonly requirements: ReturnType<typeof recruitRequirements>;
  /** What the purse lacks for one more; empty when it pays. */
  readonly shortfall: string;
  readonly type: UnitTypeDefinition;
}

export interface RecruitTabView {
  readonly capitalName: string;
  readonly locked: readonly RecruitTypeRow[];
  readonly means: readonly RecruitsWith[];
  readonly open: readonly RecruitTypeRow[];
  readonly paused: boolean;
  /** Why nothing can be recruited here at all. */
  readonly siteNote?: string | undefined;
  readonly slots: number;
  readonly training: readonly TrainingEntry[];
}

/** The tab for a viewer who has `left` to spend after this turn's orders. */
export function recruitTab(scenario: Scenario, state: GameState, territoryId: TerritoryId, viewer: FactionId, left: Resources): RecruitTabView {
  const site = recruitSiteProblem(scenario, state, viewer, territoryId);
  const siteNote = site === undefined ? undefined : refusalText(scenario, site);
  const rows = recruitableTypes(scenario).map((type): RecruitTypeRow => ({
    effects: unitEffectLines(scenario, type),
    locked: siteNote === undefined ? typeLock(scenario, state, viewer, territoryId, type).refusals.map((refusal) => refusalText(scenario, refusal)) : [siteNote],
    requirements: recruitRequirements(scenario, state, viewer, territoryId, type),
    shortfall: type.recruit === undefined || canAfford(left, type.recruit.cost) ? "" : shortfallLabel(scenario, left, type.recruit.cost),
    type
  }));
  return {
    capitalName: recruitSiteName(scenario, territoryId),
    locked: rows.filter((row) => row.locked.length > 0),
    means: recruitsWith(scenario, state, viewer, territoryId, capitalBuildings(scenario, state, territoryId)),
    open: rows.filter((row) => row.locked.length === 0),
    paused: state.training.some((item) => item.territoryId === territoryId && item.paused),
    siteNote,
    slots: recruitSlots(scenario, state, territoryId),
    training: trainingEntries(scenario, state, territoryId, [], viewer, false)
  };
}
