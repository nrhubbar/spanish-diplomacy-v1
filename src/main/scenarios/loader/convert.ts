import type { FactionId, FactionModifier, SourceCitation, SourceId } from "../../engine/types";
import type { ScenarioDocument } from "../schema/scenarioSchema";

type FactionModifierDocument = ScenarioDocument["combat"]["factionModifiers"][number];

export function citations(sources: readonly { readonly sourceId: string; readonly reference?: string | undefined }[]): SourceCitation[] {
  return sources.map((source) => ({ sourceId: source.sourceId as SourceId, ...(source.reference === undefined ? {} : { reference: source.reference }) }));
}

export function factionModifier(modifier: FactionModifierDocument): FactionModifier {
  return {
    attack: modifier.attack ?? 0,
    defence: modifier.defence ?? 0,
    factionId: modifier.factionId as FactionId,
    id: modifier.id,
    name: modifier.name,
    when: modifier.when
  };
}
