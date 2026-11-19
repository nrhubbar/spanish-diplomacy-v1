import type { FactionId, GeneralId, TerritoryId, UnitId } from "../../ids";

/** Morale and fatigue outcomes (M23; C4-C7, U5), owned by phase 9. */

/** C6: a demoralized army recovered after a turn of rest (O4). */
export interface RecoveredOutcome {
  readonly factionId: FactionId;
  readonly kind: "recovered";
  readonly territoryId: TerritoryId;
  readonly unitId: UnitId;
}

/** C5, U5: a general rallied the demoralized units of his army. */
export interface RalliedOutcome {
  readonly factionId: FactionId;
  readonly generalId: GeneralId;
  readonly kind: "rallied";
  readonly territoryId: TerritoryId;
  readonly unitIds: readonly UnitId[];
}

/** C6: a unit's fatigue changed this turn; reaching the demoralizing level demoralizes it. */
export interface FatigueOutcome {
  readonly demoralized: boolean;
  readonly factionId: FactionId;
  readonly fatigue: number;
  readonly kind: "fatigue";
  readonly unitId: UnitId;
}
