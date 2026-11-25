import { z } from "zod";
import { linkWorks, type BuildProject } from "../engine/types/state";
import type { AirMission, MoveLeg, Order } from "../engine/types";
import type { GameCommand, GameRefusal } from "./types";

/**
 * What a player sends, parsed once where it arrives, as scenario packages are (the loader's
 * rule): past here the service trusts its shape, and the engine judges its sense. Unknown keys
 * are dropped and sizes are capped. Loads Zod, so only hosts import it.
 */

/** Far above anything a real turn holds. */
export const submissionLimits = { id: 120, legs: 8, orders: 600 } as const;

/** No id names something every object has, whatever it is later looked up in. */
const id = z.string().min(1).max(submissionLimits.id).refine((value) => !(value in Object.prototype));
const whole = z.number().int().min(0).max(1_000_000);

const leg = z.object({ kind: z.enum(["land", "rail", "sea"]), to: id });
const project = z.discriminatedUnion("kind", [
  z.object({ buildingId: id, kind: z.literal("building") }),
  z.object({ developmentId: id, kind: z.literal("development") }),
  z.object({ improvement: z.enum(["port", "rail"]), kind: z.literal("improvement") }),
  z.object({ a: id, b: id, kind: z.literal("link"), work: z.enum(linkWorks) })
]);
const mission = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("raid"), subTerritoryId: id }),
  z.object({ kind: z.literal("patrol"), territoryId: id }),
  z.object({ kind: z.literal("support"), territoryId: id }),
  z.object({ kind: z.literal("recon"), territoryId: id })
]);
const faction = { factionId: id };
const unit = { ...faction, unitId: id };
const order = z.discriminatedUnion("kind", [
  z.object({ ...unit, from: id, kind: z.literal("move"), legs: z.array(leg).min(1).max(submissionLimits.legs).exactOptional(), to: id }),
  z.object({ ...unit, from: id, kind: z.literal("withdraw"), to: id }),
  z.object({ ...unit, kind: z.literal("replenish") }),
  z.object({ ...unit, kind: z.literal("disband") }),
  z.object({ ...unit, kind: z.literal("air-mission"), mission }),
  z.object({ ...unit, kind: z.literal("sack") }),
  z.object({ ...faction, kind: z.literal("recruit"), territoryId: id, unitTypeId: id }),
  z.object({ ...faction, kind: z.literal("build"), project, subTerritoryId: id })
]);

const turn = { turnNumber: whole };
const saved = { ...faction, ...turn, orders: z.array(order).max(submissionLimits.orders), revision: whole };

export const commandSchema = z.discriminatedUnion("kind", [
  z.object({ ...turn, kind: z.literal("advance") }),
  z.object({ ...turn, kind: z.literal("expire") }),
  z.object({ ...faction, ...turn, kind: z.literal("open") }),
  z.object({ ...faction, ...turn, kind: z.enum(["pause", "resume"]) }),
  z.object({ ...saved, kind: z.literal("save-orders") }),
  z.object({ ...saved, kind: z.literal("end-turn") })
]);

/** Every order, project, mission and leg kind must be in the schema, or this fails to compile. */
type Parsed = z.infer<typeof order>;
type SameKinds<A extends { readonly kind: string }, B extends { readonly kind: string }> = [A["kind"]] extends [B["kind"]] ? ([B["kind"]] extends [A["kind"]] ? true : never) : never;
/** Compile-time only. */
export const schemaCoverage: readonly [SameKinds<Parsed, Order>, SameKinds<z.infer<typeof project>, BuildProject>, SameKinds<z.infer<typeof mission>, AirMission>, SameKinds<z.infer<typeof leg>, MoveLeg>, SameKinds<z.infer<typeof commandSchema>, GameCommand>] = [true, true, true, true, true];

export function parseCommand(input: unknown): { readonly ok: true; readonly command: GameCommand } | { readonly ok: false; readonly refusal: GameRefusal } {
  const parsed = commandSchema.safeParse(input);
  // The ids are plain strings until the service looks them up; unknown ones are refused there.
  return parsed.success ? { command: parsed.data as unknown as GameCommand, ok: true } : { ok: false, refusal: { code: "malformed" } };
}
