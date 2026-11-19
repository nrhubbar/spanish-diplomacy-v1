import type { Armies } from "./board";
import type { FactionId, Fortification, GameState, Scenario, TerritoryId } from "./types";

/**
 * M22 (C7), at the end of the turn. A faction holds a territory when it controls it and has an
 * army there. A territory held by the same faction at the start and at the end of the turn,
 * where no battle was fought, gains `diggingIn.perTurn` levels for that faction, up to
 * `diggingIn.max`. A territory that was fought over keeps its level. Works are removed when
 * their faction no longer holds the territory.
 */
export function digIn(
  scenario: Scenario,
  start: GameState,
  end: { readonly armies: Armies; readonly control: GameState["control"] },
  foughtIn: ReadonlySet<TerritoryId>
): GameState["fortification"] {
  const { max, perTurn } = scenario.combat.diggingIn;
  const fortification: Record<TerritoryId, Fortification> = {};
  for (const { id } of scenario.territories) {
    const holder = holderOf(end.control, end.armies, id);
    if (holder === undefined) {
      continue;
    }
    const works = start.fortification[id];
    const level = works?.factionId === holder ? works.level : 0;
    const quiet = holder === holderOf(start.control, start.units, id) && !foughtIn.has(id);
    const next = quiet ? Math.min(max, level + perTurn) : level;
    if (next > 0) {
      fortification[id] = { factionId: holder, level: next };
    }
  }
  return fortification;
}

/** The faction that controls a territory and has an army in it, if any. */
export function holderOf(control: GameState["control"], armies: Armies, territoryId: TerritoryId): FactionId | undefined {
  const current = control[territoryId];
  if (current?.kind !== "controlled") {
    return undefined;
  }
  return Object.values(armies).some((unit) => unit.territoryId === territoryId && unit.factionId === current.factionId)
    ? current.factionId
    : undefined;
}
