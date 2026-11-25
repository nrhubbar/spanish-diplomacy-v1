import type { BuildingId, FactionId, ResourceId, SubTerritoryId, TerritoryId, UnitTypeId } from "../ids";
import type { RecruitRequirement } from "./economy";

/**
 * Why the rules refuse something, as data: a code and the ids and numbers it is about, never
 * words. `presentation/refusals.ts` writes each one as a sentence; code that only needs to tell
 * refusals apart switches on the code. Outcomes keep refusals, so a saved game holds no English.
 */

/** D5: a boarding capital whose trains have too few places left for an army. */
export interface RailShortage {
  readonly boarding: SubTerritoryId;
  /** Places left, fewer than the army needs. */
  readonly left: number;
  /** Places the army needs. */
  readonly places: number;
}

/** A refusal that says all there is to say with its code alone. */
interface Plain<Code extends string> {
  readonly code: Code;
}

/** A refusal about one unit type. */
interface OfType<Code extends string> extends Plain<Code> {
  readonly unitTypeId: UnitTypeId;
}

/** A refusal about one territory. */
interface InTerritory<Code extends string> extends Plain<Code> {
  readonly territoryId: TerritoryId;
}

/** A refusal about one sub-territory. */
interface AtSite<Code extends string> extends Plain<Code> {
  readonly subTerritoryId: SubTerritoryId;
}

/** Any order, whichever module owns it. */
export type OrderRefusal =
  | Plain<"one-order-per-unit">
  | Plain<"order-of-another-faction">
  | Plain<"order-unavailable">
  | Plain<"submission-of-another-faction">
  | Plain<"unit-elsewhere">
  | Plain<"unit-of-another-faction">
  | Plain<"unknown-unit">;

/** M1-M5, R5: moves, and the routes they take. */
export type MovementRefusal =
  | Plain<"demoralized-attack">
  | Plain<"enemy-ground-on-the-way">
  | Plain<"foot-only">
  | Plain<"lane-port-not-held">
  | Plain<"march-neighbours-only">
  | Plain<"motor-contested-ground">
  | Plain<"motor-needs-road">
  | Plain<"motor-needs-trucks">
  | (Plain<"motor-pass-closed"> & { /** The two ends of the link that crosses the pass. */ readonly link: readonly [SubTerritoryId, SubTerritoryId] })
  | (Plain<"motor-too-far"> & { readonly territories: number })
  | Plain<"not-connected">
  | Plain<"no-border-from-pocket">
  | Plain<"no-rail-line">
  | Plain<"no-rail-to-capital">
  | Plain<"no-sea-lane">
  | Plain<"out-of-reach">
  | (Plain<"rail-full"> & RailShortage)
  | Plain<"route-ends-elsewhere">
  | Plain<"route-repeats-territory">
  | Plain<"route-shape">
  | Plain<"same-destination">
  | Plain<"sea-closed">
  | Plain<"unit-cannot-move">;

/** C1, P6: contested ground. */
export type ContestedRefusal =
  | Plain<"move-in-contested-ground">
  | Plain<"unit-cannot-withdraw">
  | Plain<"withdraw-no-way-out">
  | Plain<"withdraw-not-contested">
  | Plain<"withdraw-target">;

/** U2-U5: air missions and generals. */
export type AirRefusal =
  | Plain<"grounded-by-weather">
  | Plain<"mission-needs-aircraft">
  | OfType<"mission-not-flown">
  | Plain<"no-airfield">
  | Plain<"raid-own-ground">
  | Plain<"recon-own-ground">
  | Plain<"sack-needs-general">
  | Plain<"target-out-of-range">
  | Plain<"unknown-target">;

/** $5, R7: Build orders and link works. */
export type BuildRefusal =
  | Plain<"already-built">
  | Plain<"already-queued">
  | Plain<"build-contested">
  | (Plain<"needs-building"> & { readonly buildingId: BuildingId })
  | Plain<"needs-capital">
  | Plain<"needs-city">
  | Plain<"link-busy">
  | Plain<"link-main-line-already">
  | Plain<"link-needs-railway">
  | Plain<"link-not-at-end">
  | Plain<"link-not-bordering">
  | Plain<"link-railway-already">
  | Plain<"link-road-serves">
  | (Plain<"max-level"> & { readonly level: number })
  | Plain<"no-railway">
  | AtSite<"not-buildable-here">
  | Plain<"project-unavailable">
  | (Plain<"resources-short"> & { readonly short: readonly { readonly amount: number; readonly resourceId: ResourceId }[] })
  | Plain<"site-captured">
  | AtSite<"site-not-held">
  | Plain<"unknown-site">;

/** R2-R7, D1: Recruit, Replenish and Disband orders, and why one that was paid for came to nothing. */
export type RecruitmentRefusal =
  | Plain<"capital-fell-before-training">
  | Plain<"capital-fell-in-training">
  | Plain<"full-strength">
  | Plain<"full-strength-demoralized">
  | Plain<"payment-short-at-reveal">
  | (Plain<"recruit-locked"> & { /** R2, R3: everything that locks the type there, in order. */ readonly refusals: readonly Refusal[] })
  | InTerritory<"recruit-contested">
  | InTerritory<"recruit-not-held">
  | Plain<"recruiting-unavailable">
  | (Plain<"recruit-slots-full"> & { readonly slots: number })
  | InTerritory<"replenish-contested">
  | Plain<"replenish-not-held">
  | Plain<"replenishing-unavailable">
  | (InTerritory<"requirements-missing"> & { readonly missing: readonly RecruitRequirement[] })
  | OfType<"type-cannot-disband">
  | OfType<"type-cannot-replenish">
  | (Plain<"type-not-raised-by"> & { readonly factionId: FactionId })
  | OfType<"type-not-recruited">
  | Plain<"unit-fell-back">
  | Plain<"unit-fought">
  | Plain<"unit-lost">
  | Plain<"unknown-territory">
  | Plain<"unknown-unit-type">
  | (Plain<"upkeep-short"> & { readonly resourceIds: readonly ResourceId[] });

export type Refusal = AirRefusal | BuildRefusal | ContestedRefusal | MovementRefusal | OrderRefusal | RecruitmentRefusal;

export type RefusalCode = Refusal["code"];
