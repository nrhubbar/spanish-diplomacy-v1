import { describe, expect, it } from "vitest";
import type { RuleModule } from "../main/engine/modules";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import { raisedDefinition, raisedUnitId, trainingUnitId } from "../main/engine/recruitment/rules";
import type { AirMissionOrder, BuildOrder, GameState, Order, PlayerSubmission, RecruitOrder, ReplenishOrder, Scenario, TrainingItem, TurnOutcome, UnitTypeId } from "../main/engine/types";
import { isPublicOrder, ordersFor, outcomesFor } from "../main/engine/visibility";
import { emptyDraft, type Draft } from "../main/state/session";
import { submitDraft, submittedDraftOrders } from "../main/state/submit";
import { submitOnTimeout } from "../main/state/timeout";
import { faction, spain, spainId, spainWithAir, territory, unit } from "./support";

const scenario = spainWithAir();
const start = initialGameState(scenario);
const republic = faction("republic");
const north = faction("north");

const recon: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "recon", territoryId: territory("aragon") }, unitId: unit("rep-catalan-recon") };
const raid: AirMissionOrder = { factionId: republic, kind: "air-mission", mission: { kind: "raid", subTerritoryId: "zaragoza" as never }, unitId: unit("rep-breguet-bombers") };
const recruit: RecruitOrder = { factionId: republic, kind: "recruit", territoryId: territory("catalunya"), unitTypeId: "militia-column" as never };
const build: BuildOrder = { factionId: republic, kind: "build", project: { developmentId: "farms" as never, kind: "development" }, subTerritoryId: "girona" as never };
const replenish: ReplenishOrder = { factionId: republic, kind: "replenish", unitId: unit("rep-otumba-9") };

const grounding: RuleModule = { area: "weather", blocks: [], hooks: { grounded: () => true }, id: "test-grounding", steps: {} };
const grounded: Scenario = { ...scenario, modules: [...scenario.modules, grounding] };

/** North's recon of Madrid, which the Republic holds, active on the given turn. */
const northSeesMadrid = (state: GameState, untilTurn = state.turnNumber): GameState =>
  ({ ...state, reveals: [...state.reveals, { territoryId: territory("madrid"), untilTurn, viewerFactionId: north }] });

describe("recon stays its flier's own (B1, B2)", () => {
  it("hides a grounded recon from every other viewer, and keeps a grounded raid public", () => {
    const result = resolveTurn(grounded, start, [{ factionId: republic, orders: [recon, raid] }], 7);
    const kinds = (viewer: typeof north | undefined) => outcomesFor(grounded, result.finalState, result.outcomes, viewer)
      .filter((outcome): outcome is Extract<TurnOutcome, { kind: "grounded" }> => outcome.kind === "grounded").map((outcome) => outcome.order.mission.kind);
    expect(kinds(republic).sort()).toEqual(["raid", "recon"]);
    expect(kinds(north)).toEqual(["raid"]);
    expect(kinds(undefined)).toEqual(["raid"]);
  });

  it("never opens another faction's recon through the viewer's reveal of a territory the flier holds", () => {
    const result = resolveTurn(scenario, start, [{ factionId: republic, orders: [recon] }], 7);
    const scouted = northSeesMadrid(result.finalState);
    const seen = outcomesFor(scenario, scouted, result.outcomes, north);
    expect(seen.some((outcome) => outcome.kind === "recon")).toBe(false);
    expect(ordersFor(scenario, scouted, result.submittedOrders, north)).toEqual([]);
    expect(outcomesFor(scenario, scouted, result.outcomes, republic).some((outcome) => outcome.kind === "recon")).toBe(true);
    // Income is still opened by a reveal of a territory its faction holds ($6).
    const income: TurnOutcome = { cut: {}, cutSubTerritoryIds: [], factionId: republic, kind: "income", paid: {} };
    expect(outcomesFor(scenario, scouted, [income], north)).toEqual([income]);
  });

  it("agrees with ordersFor on every order kind", () => {
    for (const order of [recon, raid, recruit, build, replenish]) {
      const outcome: TurnOutcome = { kind: "rejected-order", order: order as Exclude<Order, { kind: "move" }>, reason: "test" };
      for (const state of [start, northSeesMadrid(start), { ...start, reveals: [{ territoryId: territory("catalunya"), untilTurn: 1, viewerFactionId: north }] }]) {
        for (const viewer of [north, undefined, republic]) {
          expect(outcomesFor(scenario, state, [outcome], viewer).length, `${order.kind} to ${String(viewer)}`).toBe(ordersFor(scenario, state, [order], viewer).length);
        }
      }
    }
  });
});

describe("rejected orders and replenishment of the dead (m1, m6)", () => {
  it("keeps a rejected order as private as the order", () => {
    const refused = (order: Order): TurnOutcome => ({ kind: "rejected-order", order: order as Exclude<Order, { kind: "move" }>, reason: "test" });
    expect(outcomesFor(scenario, start, [refused(recruit), refused(build), refused(replenish), refused(recon)], north)).toEqual([]);
    expect(outcomesFor(scenario, start, [refused(raid)], undefined)).toHaveLength(1);
    const catalunya: GameState = { ...start, reveals: [{ territoryId: territory("catalunya"), untilTurn: 1, viewerFactionId: north }] };
    expect(outcomesFor(scenario, catalunya, [refused(recruit), refused(build), refused(recon)], north)).toEqual([refused(recruit), refused(build)]);
  });

  it("keeps a Replenish for a unit that died this turn its owner's, whatever the viewer reveals", () => {
    const units = Object.fromEntries(Object.entries(start.units).filter(([id]) => id !== "rep-otumba-9")) as GameState["units"];
    const after = northSeesMadrid({ ...start, units, reveals: [{ territoryId: territory("valencia"), untilTurn: 1, viewerFactionId: north }] });
    const cancelled: TurnOutcome = { kind: "replenish-cancelled", order: replenish, reason: "battle", refund: {} };
    expect(outcomesFor(scenario, after, [cancelled], north)).toEqual([]);
    expect(outcomesFor(scenario, after, [cancelled], republic)).toEqual([cancelled]);
    // A living unit's Replenish is opened by a reveal of its territory.
    const living = { ...start, reveals: [{ territoryId: territory("valencia"), untilTurn: 1, viewerFactionId: north }] };
    expect(outcomesFor(scenario, living, [cancelled], north)).toEqual([cancelled]);
  });
});

describe("holds read only public orders (M2)", () => {
  const holds = (submissions: readonly PlayerSubmission[]) => {
    const result = resolveTurn(scenario, start, submissions, 7);
    return outcomesFor(scenario, result.finalState, result.outcomes, north).filter((outcome) => outcome.kind === "no-move" && outcome.factionId === republic).length;
  };

  it("reports a faction with only hidden orders like one with none", () => {
    const none = holds([]);
    expect(none).toBeGreaterThan(0);
    expect(holds([{ factionId: republic, orders: [recon, recruit, build] }])).toBe(none);
    expect(holds([{ factionId: republic, orders: [raid] }])).toBe(0);
    expect([recon, recruit, build, replenish].some(isPublicOrder)).toBe(false);
    expect(isPublicOrder(raid)).toBe(true);
  });
});

describe("time running out submits the whole draft (T5, T6)", () => {
  const worn: GameState = { ...start, units: { ...start.units, [unit("rep-otumba-9")]: { ...start.units[unit("rep-otumba-9")]!, strength: 200 } } };
  const assignments = Object.fromEntries(scenario.factions.map((entry) => [entry.id, entry.id === republic ? "local-human" as const : "computer" as const]));
  const draft: Draft = {
    ...emptyDraft,
    airOrders: [recon, { factionId: republic, kind: "sack", unitId: unit("rep-general-miaja") }],
    builds: [build],
    orders: [
      { factionId: republic, from: territory("madrid"), kind: "move", to: territory("castilla-la-mancha"), unitId: unit("rep-wad-ras-1") },
      { factionId: republic, from: territory("andalucia"), kind: "withdraw", to: territory("murcia"), unitId: unit("rep-vitoria-8") }
    ],
    recruits: [recruit],
    replenishments: [replenish]
  };
  const planning = { draft, factionId: republic, game: { assignments, history: [], locked: {}, scenarioId: spainId, seed: 3, state: worn }, phase: "planning" as const };

  it("submits exactly the orders End Turn submits, every basket included", () => {
    const timedOut = submitOnTimeout(scenario, planning);
    const ended = submitDraft(scenario, planning);
    if (timedOut.phase !== "resolution" || ended.phase !== "resolution") throw new Error("Not resolved.");
    const own = (orders: readonly Order[]) => orders.filter((order) => order.factionId === republic);
    expect(own(timedOut.result.submittedOrders)).toEqual(own(ended.result.submittedOrders));
    expect(own(timedOut.result.submittedOrders)).toEqual(submittedDraftOrders(draft));
    expect(new Set(submittedDraftOrders(draft).map((order) => order.kind))).toEqual(new Set(["move", "withdraw", "recruit", "replenish", "build", "air-mission", "sack"]));
    const ranOut = timedOut.result.outcomes.find((outcome) => outcome.kind === "time-ran-out");
    // Ground units only, less the two with public orders (the move and the withdrawal); the Replenish is hidden, so its unit counts as held.
    const ground = Object.values(worn.units).filter((entry) => entry.factionId === republic && !["rep-ni52-fighters", "rep-breguet-bombers", "rep-catalan-recon", "rep-general-miaja"].includes(entry.id)).length;
    expect(ranOut).toEqual({ factionId: republic, heldUnitCount: ground - 2, kind: "time-ran-out" });
    expect(ended.result.outcomes.some((outcome) => outcome.kind === "time-ran-out")).toBe(false);
  });

  it("counts the same holds whether the hidden orders went in or not", () => {
    const hiddenOnly = submitOnTimeout(scenario, { ...planning, draft: { ...emptyDraft, airOrders: [recon], recruits: [recruit], replenishments: [replenish] } });
    const nothing = submitOnTimeout(scenario, { ...planning, draft: emptyDraft });
    const count = (session: typeof nothing) => (session.phase === "resolution" ? session.result.outcomes.find((outcome) => outcome.kind === "time-ran-out") : undefined);
    expect(count(hiddenOnly)).toEqual(count(nothing));
  });
});

describe("raised units are numbered as they appear (m7)", () => {
  it("names a unit by the units already raised, never by those still in training", () => {
    const ground = spain();
    const base = initialGameState(ground);
    const infantry = "infantry-regiment" as UnitTypeId;
    const item = (turnsLeft: number): TrainingItem => ({ factionId: republic, paid: {}, paused: false, territoryId: territory("catalunya"), turnsLeft, typeId: infantry, unitId: trainingUnitId([], republic, infantry, territory("catalunya")) });
    const slow = item(3);
    const fast = { ...item(1), unitId: trainingUnitId([slow], republic, infantry, territory("catalunya")) };
    expect([slow.unitId, fast.unitId]).toEqual(["t_republic_infantry-regiment_catalunya_1", "t_republic_infantry-regiment_catalunya_2"]);
    const result = resolveTurn(ground, { ...base, training: [slow, fast] }, [], 4);
    const completed = result.outcomes.filter((outcome) => outcome.kind === "training-completed");
    expect(completed.map((outcome) => outcome.unitId)).toEqual([raisedUnitId(republic, infantry, 1)]);
    expect(result.finalState.raised[raisedUnitId(republic, infantry, 1)]?.name).toBe("Infantry regiment No. 1");
    expect(result.finalState.training.map((entry) => entry.unitId)).toEqual([slow.unitId]);
    // In training it has no number: "Infantry regiment (new)".
    expect(raisedDefinition(ground, slow.unitId)?.name).toBe("Infantry regiment (new)");
    expect(outcomesFor(ground, result.finalState, completed, north)).toEqual(completed);
  });
});
