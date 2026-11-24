import { isPartitioned } from "../partition/holders";
import { pocketOfArmy, pocketsOf } from "../partition/pockets";
import { subTerritoriesOf, unitTypeOf } from "../movement/network";
import type { FactionId, GameState, LinkDefinition, Scenario, SubTerritoryId, TerritoryId, UnitId } from "../types";
import { isPass, linksOf, passName, roadOn, roadRank, territoryOfSub } from "./links";
import type { LinkStep, UnreachableCode } from "./reach";

/**
 * R5: the links a land move crosses. March crosses one border, by any link with a road or, for
 * an army of foot units, any link at all. Motor runs along main roads (the scenario's
 * `road.motorLevel`) and never over a pass. Both start from the army's own ground in its
 * territory: its pocket (R1, `partition/pockets.ts`).
 *
 * A link is chosen the same way every time: a link that is not a pass first, then the better
 * road, then the scenario's order. So the engine, the computer player, the screens and the
 * pass bonus (R6) all read the same crossing.
 */

/** A land path's failure, as a code and a plain sentence. */
export interface PathRefusal {
  readonly code: UnreachableCode;
  readonly ok: false;
  readonly reason: string;
}

/** One border crossing: the step and the link it crosses. */
export interface Crossing {
  readonly link: LinkDefinition;
  readonly step: LinkStep;
}

/**
 * The sub-territories an army leaves from: the pocket of its first ground unit (R1) or, without
 * units, every pocket its side has there. Where its side holds nothing, or without the
 * partition rules (an army then stands in the whole territory), every sub-territory there.
 */
export function startSubTerritories(scenario: Scenario, state: GameState, factionId: FactionId, from: TerritoryId, unitIds?: readonly UnitId[]): readonly SubTerritoryId[] {
  if (!isPartitioned(scenario)) return subTerritoriesOf(scenario, from);
  const probe = unitIds?.find((unitId) => (unitTypeOf(scenario, state, unitId)?.kind ?? "ground") === "ground");
  const pocket = probe === undefined ? undefined : pocketOfArmy(scenario, state, probe);
  const own = pocket?.territoryId === from
    ? pocket.subTerritoryIds
    : pocketsOf(scenario, state, from, factionId).flatMap((each) => each.subTerritoryIds);
  return own.length > 0 ? own : subTerritoriesOf(scenario, from);
}

/** R5: every ground unit is a foot unit, so the army may cross a link with no road. No units: assumed so. */
export function allFoot(scenario: Scenario, state: GameState, unitIds?: readonly UnitId[]): boolean {
  return (unitIds ?? []).every((unitId) => {
    const type = unitTypeOf(scenario, state, unitId);
    return type === undefined || type.kind !== "ground" || type.foot === true;
  });
}

function better(a: Crossing, b: Crossing, state: GameState): boolean {
  const passA = isPass(a.link) ? 1 : 0;
  const passB = isPass(b.link) ? 1 : 0;
  if (passA !== passB) return passA < passB;
  return roadRank(roadOn(state, a.link)) > roadRank(roadOn(state, b.link));
}

/** R5: the link a March from `fromSubs` into `to` crosses, or why there is none. */
export function marchCrossing(scenario: Scenario, state: GameState, fromSubs: readonly SubTerritoryId[], to: TerritoryId, foot: boolean): ({ readonly ok: true } & Crossing) | PathRefusal {
  const roads = scenario.linkModifiers.road !== undefined;
  let best: Crossing | undefined;
  let any = false;
  for (const from of fromSubs) {
    for (const { link, to: next } of linksOf(scenario, from)) {
      if (territoryOfSub(scenario, next) !== to) continue;
      any = true;
      if (roads && !foot && roadOn(state, link) === undefined) continue;
      const crossing: Crossing = { link, step: { from, mode: "march", to: next } };
      if (best === undefined || better(crossing, best, state)) best = crossing;
    }
  }
  if (best !== undefined) return { ok: true, ...best };
  return any
    ? { code: "not-foot", ok: false, reason: "Only foot units can cross where there is no road." }
    : { code: "not-connected", ok: false, reason: "Your ground there does not border it." };
}

/** R5: a link Motor may use: a road of at least the scenario's motor level, and no pass the pass rules close to Motor. */
function motorLink(scenario: Scenario, state: GameState, link: LinkDefinition, passesOpen: boolean): boolean {
  const roads = scenario.linkModifiers.road;
  if (roads !== undefined && roadRank(roadOn(state, link)) < roadRank(roads.motorLevel)) return false;
  return passesOpen || scenario.linkModifiers.pass?.noMotor !== true || !isPass(link);
}

function searchMotor(scenario: Scenario, state: GameState, fromSubs: readonly SubTerritoryId[], territories: readonly TerritoryId[], passesOpen: boolean): readonly { readonly link: LinkDefinition; readonly step: LinkStep }[] | undefined {
  // Breadth-first over (sub-territory, territories entered so far): fewest links first, in index order.
  const key = (sub: SubTerritoryId, stage: number): string => `${sub}#${String(stage)}`;
  const previous = new Map<string, { readonly from: string; readonly link: LinkDefinition; readonly step: LinkStep } | undefined>();
  const queue: { readonly stage: number; readonly sub: SubTerritoryId }[] = [];
  for (const sub of fromSubs) {
    previous.set(key(sub, 0), undefined);
    queue.push({ stage: 0, sub });
  }
  for (let head = 0; head < queue.length; head += 1) {
    const { stage, sub } = queue[head] as { readonly stage: number; readonly sub: SubTerritoryId };
    if (stage === territories.length) {
      const path: { readonly link: LinkDefinition; readonly step: LinkStep }[] = [];
      for (let at = previous.get(key(sub, stage)); at !== undefined; at = previous.get(at.from)) path.unshift({ link: at.link, step: at.step });
      return path;
    }
    const here = territoryOfSub(scenario, sub);
    for (const { link, to } of linksOf(scenario, sub)) {
      const there = territoryOfSub(scenario, to);
      // Inside a territory the army passes through, it may follow the road; the start is its whole pocket already.
      const nextStage = there === territories[stage] ? stage + 1 : there === here && stage > 0 ? stage : undefined;
      if (nextStage === undefined || previous.has(key(to, nextStage)) || !motorLink(scenario, state, link, passesOpen)) continue;
      previous.set(key(to, nextStage), { from: key(sub, stage), link, step: { from: sub, mode: "motor", to } });
      queue.push({ stage: nextStage, sub: to });
    }
  }
  return undefined;
}

/**
 * R5: the links a Motor move runs along, from the army's ground through `territories` in order
 * (each entered once, the last its destination), or why it cannot.
 */
export function motorPath(scenario: Scenario, state: GameState, fromSubs: readonly SubTerritoryId[], territories: readonly TerritoryId[]): ({ readonly ok: true; readonly path: readonly Crossing[] }) | PathRefusal {
  const path = searchMotor(scenario, state, fromSubs, territories, false);
  if (path !== undefined) return { ok: true, path };
  const overPass = searchMotor(scenario, state, fromSubs, territories, true);
  const pass = overPass?.map(({ link }) => passName(link)).find((name) => name !== undefined);
  return pass === undefined
    ? { code: "no-road", ok: false, reason: `Motor needs a ${scenario.linkModifiers.road?.motorLevel === "main" ? "main road" : "road"} all the way.` }
    : { code: "pass-blocks-motor", ok: false, reason: `Motor can't cross the ${pass} pass.` };
}
