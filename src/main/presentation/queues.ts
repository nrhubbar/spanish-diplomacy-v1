import { currentLevel, isCapital, projectCost, sameProject } from "../engine/economy/catalogue";
import { isContested, subTerritoriesOf } from "../engine/economy/holdings";
import { addResources } from "../engine/resources";
import type {
  BuildOrder,
  BuildProject,
  FactionId,
  GameState,
  RecruitOrder,
  Resources,
  QueueItem,
  Scenario,
  SubTerritoryId,
  SubTerritoryState,
  TerritoryId,
  TrainingItem,
  UnitTypeId
} from "../engine/types";
import { projectName, turnsLeftText } from "./economy";
import { glyphs } from "./glyphs";
import { turnsLabel } from "./recruitment";
import { factionName, territoryName } from "./text";

/**
 * U9 (note 9): the one queue shape behind Global Recruitment, Global Building and Territory
 * Info. A queue is the item being worked on (with progress and turns left) and what waits
 * behind it. Build queues are serial: only the head progresses ($5). Training is parallel:
 * every unit in training takes a turn off each turn (`advanceTraining`), so each one is active
 * and only this turn's Recruit orders wait to start.
 */

/** How a queued item can be taken back this turn: a planned Build order, or one fewer Recruit order. */
export type QueueCancel =
  | { readonly index: number; readonly kind: "build" }
  | { readonly kind: "recruit"; readonly quantity: number; readonly territoryId: TerritoryId; readonly unitTypeId: UnitTypeId };

export interface QueueEntry {
  readonly cancel?: QueueCancel;
  /** Turns of progress so far, out of `total`. */
  readonly done: number;
  readonly key: string;
  readonly name: string;
  /** Set for a build item, so the view can draw its icon. */
  readonly project?: BuildProject;
  /** Active items are being worked on and show a bar; waiting items are numbered behind them. */
  readonly stage: "active" | "waiting";
  readonly status: string;
  readonly total: number;
  /** Another faction's item, shown by recon. */
  readonly owner?: string;
}

const dot = ` ${glyphs.dot} `;

/** A whole sub-territory's queue as rows, with this turn's planned Build orders (the tail of the previewed queue). */
export function buildEntries(
  scenario: Scenario,
  site: SubTerritoryState,
  planned: readonly { readonly index: number; readonly order: BuildOrder }[],
  paused: boolean,
  viewer?: FactionId
): readonly QueueEntry[] {
  const started = site.queue.length - planned.length;
  return site.queue.flatMap((item, at): QueueEntry[] => {
    if (viewer !== undefined && item.factionId !== viewer) return [];
    const total = projectCost(scenario, item.project)?.turns ?? 1;
    const plan = at >= started ? planned[at - started] : undefined;
    const name = projectName(scenario, site, item.project, levelBefore(site, item, at));
    const left = total - item.progress;
    const status = at === 0
      ? plan === undefined ? (paused ? `${turnsLeftText(left)} when it resumes` : turnsLeftText(left)) : `starts this turn${dot}${turnsLabel(total)}`
      : plan === undefined ? `then ${turnsLabel(total)}` : `ordered this turn${dot}${turnsLabel(total)}`;
    return [{
      ...(plan === undefined ? {} : { cancel: { index: plan.index, kind: "build" as const } }),
      done: item.progress,
      key: `${String(at)}-${name}`,
      name,
      project: item.project,
      stage: at === 0 ? "active" : "waiting",
      status,
      total
    }];
  });
}

/** The level a queued levelled item starts from: the current level plus the same items ahead of it. */
function levelBefore(site: SubTerritoryState, item: QueueItem, at: number): number | undefined {
  if (item.project.kind === "building") return undefined;
  return currentLevel(site, item.project) + site.queue.slice(0, at).filter((other) => sameProject(other.project, item.project)).length;
}

/**
 * A territory's training as rows: each unit in training (active, with its bar), then this
 * turn's Recruit orders, which start at reveal. With `viewer`, only that faction's units;
 * without, every unit the viewer's state shows here (other factions' by recon).
 */
export function trainingEntries(
  scenario: Scenario,
  state: Pick<GameState, "training">,
  territoryId: TerritoryId,
  recruits: readonly RecruitOrder[],
  viewer: FactionId,
  onlyViewer: boolean
): readonly QueueEntry[] {
  const training = state.training.filter((item) => item.territoryId === territoryId && (!onlyViewer || item.factionId === viewer));
  const ordered = recruits.filter((order) => order.territoryId === territoryId);
  return [
    ...training.map((item) => trainingEntry(scenario, item, viewer)),
    ...ordered.map((order, at): QueueEntry => {
      const type = scenario.index.unitTypes.get(order.unitTypeId);
      const total = type?.recruit?.trainingTurns ?? 1;
      const quantity = ordered.filter((other) => other.unitTypeId === order.unitTypeId).length;
      return {
        cancel: { kind: "recruit", quantity: quantity - 1, territoryId, unitTypeId: order.unitTypeId },
        done: 0,
        key: `ordered-${String(at)}`,
        name: type?.name ?? order.unitTypeId,
        stage: "waiting",
        status: `starts this turn${dot}${turnsLabel(total)}`,
        total
      };
    })
  ];
}

function trainingEntry(scenario: Scenario, item: TrainingItem, viewer: FactionId): QueueEntry {
  const total = scenario.index.unitTypes.get(item.typeId)?.recruit?.trainingTurns ?? item.turnsLeft;
  const left = turnsLeftText(item.turnsLeft);
  return {
    done: Math.max(0, total - item.turnsLeft),
    key: item.unitId,
    name: scenario.index.unitTypes.get(item.typeId)?.name ?? item.typeId,
    ...(item.factionId === viewer ? {} : { owner: factionName(scenario, item.factionId) }),
    stage: "active",
    status: item.paused ? `${left} when it resumes` : left,
    total
  };
}

export interface RecruitmentGroup {
  readonly entries: readonly QueueEntry[];
  readonly name: string;
  /** Some unit here is paused: the territory is contested. */
  readonly paused: boolean;
  readonly territoryId: TerritoryId;
}

/** U9: Global Recruitment, by territory in scenario order: the viewer's units in training and this turn's Recruit orders. */
export function recruitmentGroups(scenario: Scenario, state: Pick<GameState, "training">, viewer: FactionId, recruits: readonly RecruitOrder[]): readonly RecruitmentGroup[] {
  return scenario.territories.flatMap((territory): RecruitmentGroup[] => {
    const entries = trainingEntries(scenario, state, territory.id, recruits, viewer, true);
    if (entries.length === 0) return [];
    const paused = state.training.some((item) => item.territoryId === territory.id && item.factionId === viewer && item.paused);
    return [{ entries, name: territory.name, paused, territoryId: territory.id }];
  });
}

export interface RecruitmentSummary {
  /** What this turn's Recruit orders pay when revealed. */
  readonly committed: Resources;
  readonly ordered: number;
  readonly readyNext: number;
  readonly training: number;
}

/** The counts above Global Recruitment. `training + ordered` is the top bar's Recruitment count. */
export function recruitmentSummary(scenario: Scenario, state: Pick<GameState, "training">, viewer: FactionId, recruits: readonly RecruitOrder[]): RecruitmentSummary {
  const own = state.training.filter((item) => item.factionId === viewer);
  return {
    committed: recruits.reduce<Resources>((sum, order) => addResources(sum, scenario.index.unitTypes.get(order.unitTypeId)?.recruit?.cost ?? {}), {}),
    ordered: recruits.length,
    readyNext: own.filter((item) => !item.paused && item.turnsLeft <= 1).length,
    training: own.length
  };
}

export interface BuildingSite {
  readonly capital: boolean;
  readonly entries: readonly QueueEntry[];
  readonly name: string;
  readonly subTerritoryId: SubTerritoryId;
}

export interface BuildingGroup {
  readonly name: string;
  /** Contested: no queue here progresses ($5), and progress is kept. */
  readonly paused: boolean;
  readonly sites: readonly BuildingSite[];
  readonly territoryId: TerritoryId;
}

/** This turn's planned Build orders for one sub-territory, with their index in the whole plan. */
export function plannedAt(builds: readonly BuildOrder[], subTerritoryId: SubTerritoryId): readonly { readonly index: number; readonly order: BuildOrder }[] {
  return builds.flatMap((order, index) => (order.subTerritoryId === subTerritoryId ? [{ index, order }] : []));
}

/**
 * U9: Global Building, by territory, then sub-territory: every queue item of the viewer's.
 * `state` is the preview with this turn's Build orders queued (`previewState`), so they show
 * as "this turn" and can be cancelled.
 */
export function buildingGroups(scenario: Scenario, state: Pick<GameState, "subTerritories">, viewer: FactionId, builds: readonly BuildOrder[]): readonly BuildingGroup[] {
  return scenario.territories.flatMap((territory): BuildingGroup[] => {
    const paused = isContested(scenario, state.subTerritories, territory.id);
    const sites = subTerritoriesOf(scenario, territory.id).flatMap((sub): BuildingSite[] => {
      const site = state.subTerritories[sub.id];
      const entries = site === undefined ? [] : buildEntries(scenario, site, plannedAt(builds, sub.id), paused, viewer);
      return entries.length === 0 ? [] : [{ capital: isCapital(scenario, sub), entries, name: sub.name, subTerritoryId: sub.id }];
    });
    return sites.length === 0 ? [] : [{ name: territory.name, paused, sites, territoryId: territory.id }];
  });
}

export interface BuildingSummary {
  /** Territories where a project finishes at the end of this turn. */
  readonly finishing: readonly string[];
  readonly paused: number;
  readonly queued: number;
  readonly underWay: number;
}

/** The counts above Global Building. Their sum is the top bar's Building count. */
export function buildingSummary(scenario: Scenario, groups: readonly BuildingGroup[]): BuildingSummary {
  const heads = groups.flatMap((group) => group.sites.flatMap((site) => site.entries.filter((entry) => entry.stage === "active").map((entry) => ({ entry, group }))));
  const finishing = new Set(heads.filter(({ entry, group }) => !group.paused && entry.total - entry.done <= 1).map(({ group }) => territoryName(scenario, group.territoryId)));
  return {
    finishing: [...finishing],
    paused: heads.filter(({ group }) => group.paused).length,
    queued: groups.flatMap((group) => group.sites.flatMap((site) => site.entries)).filter((entry) => entry.stage === "waiting").length,
    underWay: heads.filter(({ group }) => !group.paused).length
  };
}

/** "Madrid", "Madrid and Valencia", "Madrid, Murcia and Valencia". */
export function andList(names: readonly string[]): string {
  return names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${String(names.at(-1))}`;
}

/** "1 site", "2 sites": a count with its noun. */
export function countOf(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
