import type { Armies } from "./board";
import { hookedCanDigIn } from "./hooks";
import { standingOrder } from "./orders";
import type { FactionId, Fortification, GameState, Scenario, TerritoryId, UnitId } from "./types";

/**
 * M22 (C7), at the end of the turn. A faction holds a territory when it controls it and has an
 * army there. A territory held by the same faction at the start and at the end of the turn,
 * where no battle was fought and at least one of the holder's armies entrenched, gains
 * `diggingIn.perTurn` levels for that faction, up to `diggingIn.max`. Otherwise it keeps its
 * level. Works are removed when their faction no longer holds the territory.
 *
 * An army entrenched when it was there and healthy at the start of the turn, had no valid move
 * order (`moved` lists the armies that had one), and is still there at the end (M23, O3). The
 * selected modules' `canDigIn` hooks may stop the works growing (T4: Snow).
 */
export function digIn(
  scenario: Scenario,
  start: GameState,
  end: { readonly armies: Armies; readonly control: GameState["control"] },
  foughtIn: ReadonlySet<TerritoryId>,
  moved: ReadonlySet<UnitId>,
  /** The gain per turn and the cap: the d6 block's, or the d20's x3 (D3). */
  rates: { readonly max: number; readonly perTurn: number } = scenario.combat.diggingIn
): GameState["fortification"] {
  const { max, perTurn } = rates;
  const fortification: Record<TerritoryId, Fortification> = {};
  for (const { id } of scenario.territories) {
    const holder = holderOf(end.control, end.armies, id);
    if (holder === undefined) {
      continue;
    }
    const works = start.fortification[id];
    const level = works?.factionId === holder ? works.level : 0;
    const quiet = holder === holderOf(start.control, start.units, id) && !foughtIn.has(id)
      && Object.values(start.units).some((unit) => unit.territoryId === id && unit.factionId === holder
        && !moved.has(unit.id) && standingOrder(unit) === "entrench" && end.armies[unit.id]?.territoryId === id)
      && hookedCanDigIn({ factionId: holder, scenario, state: start, territoryId: id });
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
