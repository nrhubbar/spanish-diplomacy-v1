import type { RuleModule } from "../modules";
import type { Phase } from "../phases/draft";

/** TODO(m3r1-air-generals): recon, interception and raids from the `raid` stream; support missions recorded for the dice part to read (U2-U4, D7). */
const flyAirMissions: Phase = (draft) => draft;
/** TODO(m3r1-air-generals): general deaths from the `general-death` stream, rallies, replacements (U5, D7). */
const commandChanges: Phase = (draft) => draft;
/** TODO(m3r1-air-generals): raid income cuts, after the economy's income part (U3). */
const cutIncome: Phase = (draft) => draft;

/**
 * The air area's modules (U1-U6). Generals have no area of their own (CT-4), so their step-9
 * part lives here with the stream that owns them. Pass-through parts until the slice lands.
 */
export const airModules: readonly RuleModule[] = [
  { area: "air", blocks: [], id: "none", steps: {} },
  { area: "air", blocks: ["air"], id: "missions", steps: { air: flyAirMissions, income: cutIncome, morale: commandChanges } }
];
