import type { TurnOutcome } from "../../engine/types";
import type { EconomyIconName } from "../../components/economy/EconomyIcon";
import type { OutcomeKey } from "../../presentation/outcomes";
import { outcomeText } from "../../presentation/outcomeText";
import type { SiteIconKind } from "../pane/SiteIcons";

type OutcomeKind = TurnOutcome["kind"];

/** A group's icon: an outcome medallion (H's art), a route-coloured dot, or a small line icon (X8). */
export type OutcomeGroupIcon =
  | { readonly medallion: OutcomeKey }
  | { readonly tone: "bounced" | "disbanded" | "moved" }
  | { readonly site: SiteIconKind }
  | { readonly economy: EconomyIconName };

export interface OutcomeGroupSpec {
  /** The kinds in the group, in the order its lines are listed. */
  readonly kinds: readonly OutcomeKind[];
  readonly label: string;
  /** Whether the group starts open: serious groups always, routine ones only when something went wrong. */
  readonly open: boolean | ((outcomes: readonly TurnOutcome[]) => boolean);
  readonly icon: OutcomeGroupIcon;
}

const any = (kinds: readonly OutcomeKind[]) => (outcomes: readonly TurnOutcome[]): boolean => outcomes.some((outcome) => kinds.includes(outcome.kind));

/**
 * The turn report's "What happened" groups (U2, D25), most serious first. Battles have their own
 * cards; the turn's conditions (weather, frostbite, time) and the treasury (income) have their
 * own sections. Every other outcome kind is in exactly one group.
 */
export const outcomeGroups: readonly OutcomeGroupSpec[] = [
  { icon: { medallion: "surrendered" }, kinds: ["disbanded-move"], label: outcomeText.surrendered.title, open: true },
  // C1, P6: units cut off in contested ground with no path out through their own sub-territories.
  { icon: { medallion: "surrendered" }, kinds: ["path-surrender", "pocket-cut"], label: "Cut off", open: true },
  { icon: { tone: "disbanded" }, kinds: ["invalid-order"], label: "Disbanded", open: true },
  // Section 2 step 1: an order other than a move that failed at reveal (anything paid is refunded).
  { icon: { tone: "disbanded" }, kinds: ["rejected-order"], label: "Orders not carried out", open: true },
  { icon: { tone: "bounced" }, kinds: ["bounced-move"], label: "Bounced", open: true },
  // M1-M5: moves that stopped short: intercepted on the way, or held back by allowance or capacity.
  { icon: { tone: "bounced" }, kinds: ["move-intercepted", "move-held-back"], label: "Stopped on the way", open: true },
  { icon: { site: "withdraw" }, kinds: ["withdrew"], label: "Withdrawals", open: true },
  // R2: a territory where only one side had ground armies flipped whole.
  { icon: { tone: "moved" }, kinds: ["territory-flipped"], label: "Territories taken whole", open: true },
  { icon: { medallion: "recovered" }, kinds: ["recovered"], label: outcomeText.recovered.title, open: true },
  // U2-U5 (m3r1-air-generals): raids, recon, interceptions and support; generals' changes and rallies.
  { icon: { economy: "plane" }, kinds: ["air-battle", "raid", "recon", "interception", "air-support", "grounded", "aircraft-rebased", "aircraft-lost"], label: "Air missions", open: true },
  { icon: { economy: "star" }, kinds: ["general-died", "general-sacked", "replacement-due", "replacement-arrived", "rallied", "general-moved"], label: "Generals", open: true },
  { icon: { medallion: "reinforcement-arrived" }, kinds: ["reinforcement-arrived"], label: outcomeText["reinforcement-arrived"].title, open: false },
  { icon: { tone: "moved" }, kinds: ["successful-move"], label: "Completed moves", open: false },
  { icon: { site: "rail" }, kinds: ["move-transit"], label: "By rail and sea", open: false },
  // C6: open when a unit was demoralized by it.
  { icon: { medallion: "demoralized" }, kinds: ["fatigue"], label: "Fatigue", open: (outcomes) => outcomes.some((outcome) => outcome.kind === "fatigue" && outcome.demoralized) },
  // R2-R7, C8: open when training paused, or a recruit or replenishment was refunded or cancelled.
  {
    icon: { economy: "flag" },
    kinds: ["training-completed", "training-started", "replenish-applied", "training-paused", "training-refunded", "replenish-cancelled"],
    label: "Recruitment",
    open: any(["training-paused", "training-refunded", "replenish-cancelled"])
  },
  // $1-$8: open when something was finished, lost or refunded.
  {
    icon: { economy: "chimney" },
    kinds: ["build-completed", "build-forfeited", "build-refunded", "build-progressed", "build-queued"],
    label: "Building",
    open: any(["build-completed", "build-forfeited", "build-refunded"])
  },
  { icon: { site: "rail" }, kinds: ["rail-damaged"], label: "Rail damage", open: false }
];

/** The kinds with sections of their own: battle cards, the turn's conditions, the treasury, and holds. */
export const sectionKinds: readonly OutcomeKind[] = ["battle", "no-move", "weather-rolled", "frostbite", "time-ran-out", "income"];

/** A group's outcomes, in the order of its kinds (stable within a kind). */
export function groupMembers(group: OutcomeGroupSpec, outcomes: readonly TurnOutcome[]): readonly TurnOutcome[] {
  return group.kinds.flatMap((kind) => outcomes.filter((outcome) => outcome.kind === kind));
}

/** Whether a group with these outcomes starts open. */
export function groupOpen(group: OutcomeGroupSpec, outcomes: readonly TurnOutcome[]): boolean {
  return typeof group.open === "boolean" ? group.open : group.open(outcomes);
}
