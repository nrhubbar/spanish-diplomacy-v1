import { recruitSiteProblem } from "../engine/recruitment/rules";
import type { FactionId, GameState, Scenario, TerritoryId, UnitId } from "../engine/types";
import { glyphs } from "./glyphs";
import { type Ground, groundOf, type MusterDraft, reachingUnits } from "./muster";
import { refusalText } from "./refusals";
import { territoryName, unitName } from "./text";

/**
 * U5: the quick actions on a territory (right-click on a desktop, long-press on a phone):
 * Invade on enemy or contested ground, Reinforce on friendly or contested ground, then
 * Recruit, Build and Info. An action that can't be used is shown greyed out with its reason.
 */

export type QuickActionKind = "invade" | "reinforce" | "recruit" | "build" | "info";

export interface QuickAction {
  /** One short line under the name: what it would do here. */
  readonly detail: string;
  readonly kind: QuickActionKind;
  readonly label: string;
  /** Why it can't be used here; absent when it can. */
  readonly reason?: string;
}

export interface QuickActionMenu {
  readonly actions: readonly QuickAction[];
  readonly ground: Ground;
  /** "Contested", "Enemy" or "Yours", for the menu's chip. */
  readonly status: string;
  readonly territoryId: TerritoryId;
  readonly title: string;
}

const statusNames: Readonly<Record<Ground, string>> = { contested: "Contested", enemy: "Enemy", friendly: "Yours" };

function unitsLine(scenario: Scenario, unitIds: readonly UnitId[], verb: string): string {
  const [first] = unitIds;
  return first !== undefined && unitIds.length === 1 ? `${unitName(scenario, first)} ${verb}` : `${String(unitIds.length)} of your units ${verb}`;
}

/** U5: the actions for `territoryId`, in menu order. */
export function quickActions(scenario: Scenario, state: GameState, factionId: FactionId, territoryId: TerritoryId, draft: MusterDraft): QuickActionMenu {
  const ground = groundOf(state, factionId, territoryId);
  const name = territoryName(scenario, territoryId);
  const reaching = reachingUnits(scenario, state, factionId, territoryId, draft).map(({ unit }) => unit.id);
  const actions: QuickAction[] = [];
  const reach = (verb: string): Pick<QuickAction, "detail" | "reason"> => reaching.length === 0
    ? { detail: "None of your units can reach it this turn", reason: `None of your units can reach ${name} this turn.` }
    : { detail: unitsLine(scenario, reaching, verb) };
  // U5: all five actions are always listed; one that doesn't fit this ground is greyed out with its reason.
  actions.push(ground === "friendly"
    ? { detail: "Your own ground", kind: "invade", label: "Invade", reason: `${name} is yours: use Reinforce to move units in.` }
    : { kind: "invade", label: "Invade", ...reach("can attack it") });
  actions.push(ground === "enemy"
    ? { detail: "Enemy ground", kind: "reinforce", label: "Reinforce", reason: `You hold no ground in ${name}: use Invade to attack it.` }
    : { kind: "reinforce", label: "Reinforce", ...reach("can move in") });
  const recruit = recruitSiteProblem(scenario, state, factionId, territoryId);
  actions.push({ detail: recruit === undefined ? "Train new units here" : "Not here this turn", kind: "recruit", label: "Recruit", ...(recruit === undefined ? {} : { reason: refusalText(scenario, recruit) }) });
  const sites = (scenario.index.subTerritoriesByTerritory.get(territoryId) ?? []).filter((sub) => state.subTerritories[sub.id]?.holder === factionId && sub.buildable.length > 0);
  const [site] = sites;
  actions.push(site === undefined
    ? { detail: "No site you hold", kind: "build", label: "Build", reason: `You hold no ground in ${name} to build on.` }
    : { detail: sites.length === 1 ? `${site.name}: 1 site you hold` : `${String(sites.length)} sites you hold`, kind: "build", label: "Build" });
  actions.push({ detail: `Territory, units, production`, kind: "info", label: "Info" });
  return { actions, ground, status: statusNames[ground], territoryId, title: name };
}

/** The accessible name of a greyed-out action: "Recruit, unavailable: Madrid is contested...". */
export function actionName(action: QuickAction): string {
  return action.reason === undefined ? `${action.label}: ${action.detail}` : `${action.label} ${glyphs.dot} unavailable: ${action.reason}`;
}
