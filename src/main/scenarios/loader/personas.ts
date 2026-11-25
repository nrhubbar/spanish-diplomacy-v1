import { aiProfileSchema } from "../schema/systemsSchema";
import type { ScenarioDocument } from "../schema/scenarioSchema";
import { idSet, type Issues } from "./issues";

type AiDocument = ScenarioDocument["ai"];

/** A faction's profile with its seat's persona merged over it: what the faction plays. Without a seat, its own profile as it is. */
export function seatProfile(ai: AiDocument, factionId: string): unknown {
  const persona = ai.seats?.[factionId];
  const overrides = persona === undefined ? undefined : ai.personas?.[persona]?.overrides;
  return overrides === undefined ? ai.profiles[factionId] : merged(ai.profiles[factionId], overrides);
}

/** `over` laid over `base`, field by field through nested objects; a field `over` does not give keeps its base value. */
function merged(base: unknown, over: unknown): unknown {
  if (!isObject(base) || !isObject(over)) return over;
  return Object.entries(over).reduce<Record<string, unknown>>(
    (result, [key, value]) => (value === undefined ? result : { ...result, [key]: merged(base[key], value) }),
    { ...base }
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** L30: seats name known factions and personas, what a seat plays is a whole profile in range, and `typeWorth` names unit types. */
export function checkPersonas(document: ScenarioDocument, issues: Issues): void {
  const { ai } = document;
  const factions = idSet(document.factions);
  const unitTypes = idSet(document.unitTypes);
  const personas = new Map(Object.entries(ai.personas ?? {}));
  const checkTypes = (path: string, typeWorth: Readonly<Record<string, number>> | undefined): void => {
    for (const id of Object.keys(typeWorth ?? {})) issues.ref(`${path}.recruits.typeWorth`, id, unitTypes, "unit type");
  };
  for (const [id, profile] of Object.entries(ai.profiles)) checkTypes(`ai.profiles.${id}`, profile.recruits.typeWorth);
  for (const [id, { overrides }] of personas) checkTypes(`ai.personas.${id}.overrides`, overrides.recruits?.typeWorth);
  for (const [factionId, persona] of Object.entries(ai.seats ?? {})) {
    issues.ref("ai.seats", factionId, factions, "faction");
    issues.ref(`ai.seats.${factionId}`, persona, personas, "persona");
    if (!factions.has(factionId) || !personas.has(persona) || ai.profiles[factionId] === undefined) continue;
    for (const problem of aiProfileSchema.safeParse(seatProfile(ai, factionId)).error?.issues ?? []) {
      issues.add(`ai.seats.${factionId}: persona "${persona}" makes ${problem.path.join(".")} invalid: ${problem.message} (L30)`);
    }
  }
}
