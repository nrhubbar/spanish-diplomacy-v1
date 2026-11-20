import { airHooks } from "../air/hooks";
import { validateAirMission, validateSack } from "../air/validation";
import { flyAirMissions, setAside } from "../air/missions";
import type { AirScratch } from "../air/scratch";
import { commandChanges, expireAirEffects } from "../generals/changes";
import type { OrderValidationContext } from "../hooks";
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
/** U5: Sack is a free order that needs no aircraft, so it validates under either module (as before the hook). */
const sackValidator = { sack: ({ order, scenario, state }: OrderValidationContext<"sack">) => validateSack(scenario, state, order) };

export const airModules: readonly RuleModule[] = [
  { area: "air", blocks: [], hooks: { validateOrder: sackValidator }, id: "none", steps: {} },
  {
    area: "air",
    blocks: ["air"],
    hooks: {
      ...airHooks,
      validateOrder: { ...sackValidator, "air-mission": ({ order, scenario, state }) => validateAirMission(scenario, state, order) }
    },
    id: "missions",
    steps: { air: flyAirMissions, income: expireAirEffects, morale: commandChanges, reveal: setAside }
  }
];
