import { describe, expect, it } from "vitest";
import { estimateAttack } from "../main/engine/combat";
import {
  hookedAllowanceDelta,
  hookedCanDigIn,
  hookedGrounded,
  hookedIncome,
  hookedRecruitRequirements,
  hookedReplenishBonus,
  type RuleHooks
} from "../main/engine/hooks";
import { createModuleRegistry, type RuleModule } from "../main/engine/modules";
import type { Phase } from "../main/engine/phases/draft";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, Order, Resources, SubTerritoryId, TurnOutcome, UnitId, UnitTypeId } from "../main/engine/types";
import { validateOrder } from "../main/engine/validation";
import { ordersFor, outcomesFor } from "../main/engine/visibility";
import { loadPackage } from "../main/scenarios/loader";
import { turnRecord } from "../main/game/service";
import { emptyDraft, type InGameSession } from "../main/state/session";
import { sessionViewer } from "../main/state/viewer";
import { modularMap, modularScenario } from "./modularFixture";
import { faction, move, projected, territory, testGame, tiny, unit, withUnits } from "./support";

type PlanningSession = Extract<InGameSession, { readonly phase: "planning" }>;
type ReportSession = Extract<InGameSession, { readonly phase: "resolution" }>;

const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
const funds = "funds" as never;

function withModule(module: RuleModule) {
  const document = modularScenario();
  (document["rules"] as Record<string, string>)["air"] = module.id;
  return loadPackage({ assetPaths, mapDocument: modularMap(), mapPath: "m", modules: createModuleRegistry([{ modules: [module] }]), scenarioDocument: document, scenarioPath: "s" }).scenario;
}

const hooks: RuleHooks = {
  allowanceDelta: () => 1,
  canDigIn: () => false,
  combatModifiers: () => [{ kind: "barricades", roll: -1 }],
  grounded: () => true,
  incomeDelta: () => ({ [funds]: -5 }),
  recruitRequirements: () => [{ code: "needs-city" }],
  replenishBonus: () => ({ capShare: 0.25, discount: { [funds]: 0.25 } })
};

describe("cross-area rule hooks", () => {
  const scenario = withModule({ area: "air", blocks: [], hooks, id: "hooked-air", steps: {} });
  const state = withUnits(scenario, [["red-guard", "red", "westfold"], ["blue-marines", "blue", "lowlands"]]);
  const base = { scenario, state };

  it("add their combat modifiers to the battles and to planning estimates", () => {
    const estimate = estimateAttack(scenario, state, faction("red"), [unit("red-guard")], territory("lowlands"));
    expect(estimate.kind === "battle" && estimate.modifiers).toContainEqual({ kind: "barricades", roll: -1 });
    const result = resolveTurn(scenario, state, [{ factionId: faction("red"), orders: [move("red", "red-guard", "westfold", "lowlands")] }], 3);
    const battle = result.outcomes.find((outcome) => outcome.kind === "battle");
    expect(battle?.kind === "battle" && battle.modifiers).toContainEqual({ kind: "barricades", roll: -1 });
  });

  it("can stop the works growing (T4)", () => {
    const quiet = resolveTurn(scenario, state, [], 1);
    expect(quiet.finalState.fortification).toEqual({});
    expect(resolveTurn(tiny(), initialGameState(tiny()), [], 1).finalState.fortification).not.toEqual({});
  });

  it("collect every module's answer, and are neutral with none", () => {
    const context = { ...base, factionId: faction("red"), from: territory("westfold"), unitIds: [unit("red-guard")] };
    expect(hookedAllowanceDelta(context)).toBe(1);
    expect(hookedCanDigIn({ ...base, factionId: faction("red"), territoryId: territory("westfold") })).toBe(false);
    expect(hookedGrounded({ ...base, territoryId: territory("westfold"), unitId: unit("red-guard") })).toBe(true);
    expect(hookedIncome({ ...base, factionId: faction("red"), income: { [funds]: 3 } as Resources })).toEqual({ funds: 0 });
    expect(hookedReplenishBonus({ ...base, territoryId: territory("westfold"), unitId: unit("red-guard") })).toEqual({ capShare: 0.25, discount: { [funds]: 0.25 } });
    const recruit = { ...base, factionId: faction("red"), subTerritoryId: "west-town-quarter" as SubTerritoryId, territoryId: territory("westfold"), unitTypeId: "foot" as UnitTypeId };
    expect(hookedRecruitRequirements(recruit)).toEqual([{ code: "needs-city" }]);
    const plain = { scenario: tiny(), state: initialGameState(tiny()) };
    expect(hookedAllowanceDelta({ ...plain, factionId: faction("red"), from: territory("westfold"), unitIds: [] })).toBe(0);
    expect(hookedGrounded({ ...plain, territoryId: territory("westfold"), unitId: unit("red-guard") })).toBe(false);
    expect(hookedIncome({ ...plain, factionId: faction("red"), income: { [funds]: 3 } as Resources })).toEqual({ funds: 3 });
    expect(hookedReplenishBonus({ ...plain, territoryId: territory("westfold"), unitId: unit("red-guard") })).toEqual({ capShare: 0, discount: {} });
    expect(hookedRecruitRequirements({ ...recruit, ...plain })).toEqual([]);
  });
});

describe("order validation by the owning module (M1, M9)", () => {
  const recon: Order = { factionId: faction("red"), kind: "air-mission", mission: { kind: "recon", territoryId: territory("lowlands") }, unitId: unit("red-guard") };
  const sack: Order = { factionId: faction("red"), kind: "sack", unitId: unit("red-guard") };
  const judge = (module: RuleModule, order: Order) => {
    const scenario = withModule(module);
    return validateOrder(scenario, initialGameState(scenario), order);
  };

  it("finds an order kind no selected module owns unavailable, whatever the verdicts", () => {
    expect(judge({ area: "air", blocks: [], id: "no-orders", steps: {} }, recon)).toEqual({ ok: false, refusal: { code: "order-unavailable" } });
    const accepting = { area: "air", blocks: [], hooks: { orderVerdict: () => ({ ok: true }) }, id: "verdict-only", steps: {} } satisfies RuleModule;
    expect(judge(accepting, recon)).toEqual({ ok: false, refusal: { code: "order-unavailable" } });
  });

  it("lets the owner decide, typed by kind, and lets another module's verdict veto what it accepts", () => {
    const owner: RuleModule = {
      area: "air",
      blocks: [],
      hooks: { validateOrder: { "air-mission": ({ order }) => (order.mission.kind === "recon" ? { ok: false, refusal: { code: "recon-own-ground" } } : { ok: true }), sack: () => ({ ok: true }) } },
      id: "owner",
      steps: {}
    };
    expect(judge(owner, recon)).toEqual({ ok: false, refusal: { code: "recon-own-ground" } });
    expect(judge(owner, sack)).toEqual({ ok: true });
    const vetoed: RuleModule = { ...owner, hooks: { ...owner.hooks, orderVerdict: ({ order }) => (order.kind === "sack" ? { ok: false, refusal: { code: "sack-needs-general" } } : undefined) } };
    expect(judge(vetoed, sack)).toEqual({ ok: false, refusal: { code: "sack-needs-general" } });
  });
});

describe("the turn's scratch slots", () => {
  it("carry one area's turn-only data from one step to a later one", () => {
    let seen: unknown;
    const assign: Phase = (draft) => ({ ...draft, scratch: { ...draft.scratch, air: { armies: {}, aside: {}, generalMoves: {}, patrols: [], support: [] } } });
    const read: Phase = (draft) => { seen = draft.scratch.air; return draft; };
    const scenario = withModule({ area: "air", blocks: [], id: "scratch-air", steps: { air: assign, battles: read } });
    resolveTurn(scenario, initialGameState(scenario), [], 1);
    expect(seen).toEqual({ armies: {}, aside: {}, generalMoves: {}, patrols: [], support: [] });
  });
});

describe("what each viewer may see ($6, U4)", () => {
  const scenario = withModule({ area: "air", blocks: [], id: "plain-air", steps: {} });
  const income: TurnOutcome = { cut: {}, cutSubTerritoryIds: [], factionId: faction("blue"), kind: "income", paid: { [funds]: 4 } };
  const queued: TurnOutcome = { kind: "build-queued", order: { factionId: faction("blue"), kind: "build", project: { buildingId: "airfield" as never, kind: "building" }, subTerritoryId: "port-quarter" as SubTerritoryId }, paid: {}, position: 0 };
  const training: TurnOutcome = { kind: "training-paused", factionId: faction("blue"), territoryId: territory("harbor"), unitId: "blue-recruit" as UnitId };
  const replenish: TurnOutcome = { kind: "replenish-cancelled", order: { factionId: faction("blue"), kind: "replenish", unitId: unit("blue-marines") }, refusal: { code: "unit-fought" }, refund: {} };
  const forfeit: TurnOutcome = { kind: "build-forfeited", lost: {}, newHolder: faction("red"), previousHolder: faction("blue"), project: { improvement: "rail", kind: "improvement" }, subTerritoryId: "isle" as SubTerritoryId };
  const weather: TurnOutcome = { kind: "weather-rolled", turnNumber: 1, weather: { outcomes: {}, roll: 4 } };
  const all = [income, queued, training, replenish, forfeit, weather];
  const state = initialGameState(scenario);

  it("hides other factions' private outcomes and shows a faction its own", () => {
    expect(outcomesFor(scenario, state, all, faction("red"))).toEqual([forfeit, weather]);
    expect(outcomesFor(scenario, state, all, faction("blue"))).toEqual(all);
    expect(outcomesFor(scenario, state, all, undefined)).toEqual([weather]);
  });

  it("shows what the viewer's recon reveals this turn", () => {
    const scouted: GameState = { ...state, reveals: [{ territoryId: territory("harbor"), untilTurn: 1, viewerFactionId: faction("red") }] };
    expect(outcomesFor(scenario, scouted, all, faction("red"))).toEqual(all);
    const elsewhere: GameState = { ...state, reveals: [{ territoryId: territory("highlands"), untilTurn: 1, viewerFactionId: faction("red") }] };
    expect(outcomesFor(scenario, elsewhere, all, faction("red"))).toEqual([forfeit, weather]);
  });

  it("gives every screen the session of the faction whose turn it is", () => {
    const game: InGameSession["game"] = {
      assignments: { [faction("red")]: "local-human", [faction("blue")]: "local-human" },
      gameId: testGame,
      history: [],
      ready: [faction("blue")],
      scenarioId: scenario.id,
      state
    };
    const planning: PlanningSession = { draft: emptyDraft, factionId: faction("red"), game, phase: "planning" };
    const secret = { ended: true, orders: [move("blue", "blue-marines", "harbor", "lowlands")], revision: 1 };
    const turns = [turnRecord(scenario, state, all)];
    const seen = projected(scenario, planning, { orders: { [faction("blue")]: secret, [faction("red")]: { ended: false, orders: [], revision: 0 } }, turns });
    expect([seen.session.game.ready, Object.keys(seen.session.game.state.treasuries), seen.session.game.history[0]?.outcomes.length])
      .toEqual([["blue"], ["red"], 2]);
    // Nothing the device holds carries Blue's orders, by any name.
    expect(seen.view.saved).toEqual({ ended: false, orders: [], revision: 0 });
    for (const held of [seen.session, seen.view]) {
      expect(held).not.toHaveProperty("orders");
      expect(JSON.stringify(held)).not.toContain(JSON.stringify(secret.orders));
      expect(JSON.stringify(held)).not.toContain('"kind":"move"');
    }
    const result = { ...resolveTurn(scenario, state, [], 1), turnNumber: 1 };
    const shared: ReportSession = { game, phase: "resolution", result: { ...result, outcomes: all } };
    expect(sessionViewer(shared)).toBeUndefined();
    const solo: ReportSession = { game: { ...game, assignments: { ...game.assignments, [faction("blue")]: "computer" } }, phase: "resolution", result: { ...result, outcomes: all } };
    expect(sessionViewer(solo)).toBe("red");
    const recruit = { factionId: faction("blue"), kind: "recruit" as const, territoryId: territory("harbor"), unitTypeId: "foot" as UnitTypeId };
    const recon = { factionId: faction("blue"), kind: "air-mission" as const, mission: { kind: "recon" as const, territoryId: territory("westfold") }, unitId: unit("blue-wing") };
    const raid = { ...recon, mission: { kind: "raid" as const, subTerritoryId: "west-hills" as SubTerritoryId } };
    const moved = move("blue", "blue-marines", "harbor", "lowlands");
    const build = { factionId: faction("blue"), kind: "build" as const, project: { improvement: "rail" as const, kind: "improvement" as const }, subTerritoryId: "port-quarter" as SubTerritoryId };
    const replenish = { factionId: faction("blue"), kind: "replenish" as const, unitId: unit("blue-marines") };
    const own = { factionId: faction("red"), kind: "replenish" as const, unitId: unit("red-guard") };
    const orders = [moved, recruit, build, replenish, recon, raid, own];
    const report = projected(scenario, { ...solo, result: { ...solo.result, submittedOrders: orders } }).session;
    expect(report.result.outcomes).toEqual([forfeit, weather]);
    expect(projected(scenario, { ...shared, result: { ...shared.result, submittedOrders: orders } }).session.result).toMatchObject({ outcomes: [weather], submittedOrders: [moved, raid] });
    expect(report.result.submittedOrders).toEqual([moved, raid, own]);
    const scouted: GameState = { ...state, reveals: [{ territoryId: territory("harbor"), untilTurn: 1, viewerFactionId: faction("red") }] };
    expect(ordersFor(scenario, scouted, orders, faction("red"))).toEqual([moved, recruit, build, replenish, raid, own]);
  });
});
