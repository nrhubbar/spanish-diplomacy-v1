import { airHooks } from "../air/hooks";
import { flyAirMissions, setAside } from "../air/missions";
import type { AirScratch } from "../air/scratch";
import { commandChanges, expireAirEffects } from "../generals/changes";
import type { RuleModule } from "../modules";

declare module "../phases/draft" {
  interface TurnScratch {
    /** The air area's turn-only data (`air/scratch.ts`). */
    readonly air?: AirScratch;
  }
}

/**
 * The air area's modules (U1-U6). Generals have no area of their own (CT-4), so their parts live
 * here with the stream that owns them:
 * - step 1: sackings, and aircraft and generals set aside from the ground steps (AG-3);
 * - step 2: recon, interception, raids, and bombers assigned to battle support;
 * - step 5: support and generals reach the battles through the `combatModifiers` hook;
 * - step 9: aircraft and generals back on the board, rebasing, general deaths, rallies, replacements;
 * - step 11: raid cuts (through the `incomeDelta` hook) and recon reveals expire.
 */
export const airModules: readonly RuleModule[] = [
  { area: "air", blocks: [], id: "none", steps: {} },
  {
    area: "air",
    blocks: ["air"],
    hooks: airHooks,
    id: "missions",
    steps: { air: flyAirMissions, income: expireAirEffects, morale: commandChanges, reveal: setAside }
  }
];
