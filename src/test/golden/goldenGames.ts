import { createHash } from "node:crypto";
import { initialGameState } from "../../main/engine/resolution";
import { moveModes } from "../../main/engine/network/reach";
import type { FactionId, GameState, Order, Scenario, TurnOutcome, ValidationResult } from "../../main/engine/types";
import { validateOrder } from "../../main/engine/validation";
import { linkWorks } from "../../main/engine/types/state";
import { describeOutcome } from "../../main/presentation/text";
import { playTurns } from "./playTurns";
import { shippedRegistry, spainId } from "../support";

/**
 * Three all-computer games on the numeric seeds the balance harness uses, and everything a
 * refactor must not change about them: each turn's board, every report line, and the wording
 * of a large set of refused orders. The fixtures were written before the multiplayer work.
 */
export const goldenSeeds = [11, 1001, 1234] as const;
export const goldenTurns = 10;

const hash = (value: unknown): string => createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);

/** The board without names, which are wording: key order is fixed so the hash is stable. */
function board(state: GameState): unknown {
  const { carry, cityControl, control, fortification, generals, raidCuts, subTerritories, training, treasuries, turnNumber, units, weather, builtLinks, casualties, reveals } = state;
  const sorted = (record: object | undefined): unknown => Object.entries(record ?? {}).sort(([a], [b]) => (a < b ? -1 : 1));
  return [turnNumber, sorted(units), sorted(control), sorted(cityControl), sorted(fortification), sorted(generals), sorted(subTerritories), sorted(treasuries), sorted(carry), sorted(builtLinks), sorted(casualties), raidCuts, training, reveals, weather, Object.keys(state.raised).sort()];
}

/** Many orders of every kind, most of them refused, for one faction against one board. */
function candidateOrders(scenario: Scenario, state: GameState, factionId: FactionId): readonly Order[] {
  const orders: Order[] = [];
  const territories = scenario.territories.map((entry) => entry.id);
  for (const unit of Object.values(state.units)) {
    for (const [index, to] of territories.entries()) {
      if ((index + unit.id.length) % 3 !== 0 && unit.factionId !== factionId) continue;
      orders.push({ factionId, from: unit.territoryId, kind: "move", to, unitId: unit.id });
      orders.push({ factionId, from: unit.territoryId, kind: "move", legs: [{ kind: moveModes[index % 2 === 0 ? 2 : 3] === "rail" ? "rail" : "sea", to }], to, unitId: unit.id });
      orders.push({ factionId, from: unit.territoryId, kind: "withdraw", to, unitId: unit.id });
      orders.push({ factionId, kind: "air-mission", mission: index % 3 === 0 ? { kind: "recon", territoryId: to } : index % 3 === 1 ? { kind: "support", territoryId: to } : { kind: "patrol", territoryId: to }, unitId: unit.id });
    }
    orders.push({ factionId, kind: "replenish", unitId: unit.id }, { factionId, kind: "disband", unitId: unit.id }, { factionId, kind: "sack", unitId: unit.id });
  }
  for (const territoryId of territories) for (const type of scenario.unitTypes) orders.push({ factionId, kind: "recruit", territoryId, unitTypeId: type.id });
  for (const sub of scenario.subTerritories) {
    for (const building of scenario.buildings) orders.push({ factionId, kind: "build", project: { buildingId: building.id, kind: "building" }, subTerritoryId: sub.id });
    for (const track of scenario.development) orders.push({ factionId, kind: "build", project: { developmentId: track.id, kind: "development" }, subTerritoryId: sub.id });
    for (const improvement of ["port", "rail"] as const) orders.push({ factionId, kind: "build", project: { improvement, kind: "improvement" }, subTerritoryId: sub.id });
    for (const near of scenario.index.subTerritoryNeighbors.get(sub.id) ?? []) for (const work of linkWorks) orders.push({ factionId, kind: "build", project: { a: sub.id, b: near, kind: "link", work }, subTerritoryId: sub.id });
  }
  return orders;
}

export interface GoldenTurn { readonly board: string; readonly lines: string; readonly refusals: string }
export interface Golden { readonly distinctRefusals: readonly string[]; readonly games: Readonly<Record<string, readonly GoldenTurn[]>> }

export function recordGolden(refusalOf: (scenario: Scenario, result: Exclude<ValidationResult, { readonly ok: true }>) => string): Golden {
  const { scenario } = shippedRegistry().require(spainId);
  const distinct = new Set<string>();
  const games: Record<string, GoldenTurn[]> = {};
  const judge = (state: GameState): string => hash(scenario.factions.flatMap((faction) => candidateOrders(scenario, state, faction.id).map((order) => {
    const result = validateOrder(scenario, state, order);
    if (result.ok) return "ok";
    const text = refusalOf(scenario, result);
    distinct.add(text);
    return text;
  })));
  for (const seed of goldenSeeds) {
    const turns: GoldenTurn[] = [];
    playTurns(scenario, seed, goldenTurns, (state: GameState, outcomes: readonly TurnOutcome[]) => {
      turns.push({
        board: hash(board(state)),
        lines: hash(outcomes.map((outcome) => describeOutcome(scenario, outcome, outcomes, { state }))),
        refusals: turns.length % 4 === 0 ? judge(state) : ""
      });
    });
    games[String(seed)] = turns;
  }
  judge(initialGameState(scenario));
  return { distinctRefusals: [...distinct].sort(), games };
}
