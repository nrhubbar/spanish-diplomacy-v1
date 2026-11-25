import { cleanup, render, renderHook, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState, SubTerritoryId } from "../../main/engine/types";
import { missionCallout } from "../../main/presentation/airPane";
import { targetNote } from "../../main/presentation/reachNote";
import { planningMapHandlers } from "../../main/screens/shell/mapHandlers";
import { TargetPanel } from "../../main/screens/shell/TargetPanel";
import { useEscape } from "../../main/screens/shell/useEscape";
import { cancelOrderStage, chooseAirMission, chooseRaidSite, clickMapTerritory, clickMapUnit, closeAircraftPane, planAirMission } from "../../main/state/gameSlice";
import { chooseTarget, chooseTargetSite, oddsDestinations, type PlanningSession, selectedDestinations, stageTargets, targetRefusal } from "../../main/state/planning";
import { emptyDraft } from "../../main/state/session";
import { faction, shippedRegistry, spainId, spainWithAir, territory, unit, testGame, testStore, told } from "../support";

/** N6: a mission's target is chosen on the map. */

afterEach(cleanup);

const scenario = spainWithAir();
const start = initialGameState(scenario);
const bomber = unit("rep-breguet-bombers");
const fighter = unit("rep-ni52-fighters");
const recon = unit("rep-catalan-recon");
const castile = territory("castilla-y-leon");
const madrid = territory("madrid");
const sub = (id: string): SubTerritoryId => id as SubTerritoryId;

function planning(state: GameState = start): PlanningSession {
  return { draft: emptyDraft, factionId: faction("republic"), game: { assignments: {}, history: [], ready: [], scenarioId: spainId, gameId: testGame, state }, phase: "planning" };
}

function storeOf(session = planning()) {
  const store = testStore({ game: { session } }, shippedRegistry());
  const now = (): PlanningSession => {
    const { session: current } = store.getState().game;
    if (current.phase !== "planning") throw new Error("Expected planning.");
    return current;
  };
  return { now, store };
}

const missionOf = (session: PlanningSession, unitId: typeof bomber) => session.draft.airOrders?.find((order) => order.unitId === unitId);

describe("choosing a mission's target on the map (N6)", () => {
  it("highlights the territories in range, with no odds, and plans the one clicked; the aircraft stays open", () => {
    const { now, store } = storeOf();
    store.dispatch(chooseAirMission({ mission: "support", unitId: bomber }));
    const destinations = selectedDestinations(scenario, now());
    expect(now().draft).toMatchObject({ selectedAircraftId: bomber, stage: { mission: "support", step: "choose-target" } });
    expect(destinations).toContain(castile);
    expect(oddsDestinations(now().draft, destinations)).toEqual([]);
    store.dispatch(clickMapTerritory(castile));
    expect(missionOf(now(), bomber)).toMatchObject({ mission: { kind: "support", territoryId: castile } });
    expect(now().draft.selectedAircraftId).toBe(bomber);
    expect(now().draft).not.toHaveProperty("stage");
  });

  it("takes a click on any counter as a click on its territory", () => {
    const { now, store } = storeOf();
    store.dispatch(chooseAirMission({ mission: "patrol", unitId: fighter }));
    store.dispatch(clickMapUnit(bomber));
    expect(missionOf(now(), fighter)).toMatchObject({ mission: { kind: "patrol", territoryId: madrid } });
  });

  it("asks which sub-territory to raid, switches territory on another click, and plans the one chosen", () => {
    const { now, store } = storeOf();
    store.dispatch(chooseAirMission({ mission: "raid", unitId: bomber }));
    store.dispatch(clickMapTerritory(castile));
    expect(now().draft.stage).toEqual({ mission: "raid", step: "choose-target", territoryId: castile });
    expect(missionOf(now(), bomber)).toBeUndefined();
    store.dispatch(clickMapTerritory(territory("andalucia")));
    expect(now().draft.stage).toMatchObject({ territoryId: "andalucia" });
    // Madrid is the Republic's own: its sub-territories are no targets, and the choice stays open.
    store.dispatch(chooseRaidSite(sub("madrid")));
    expect(now().draft.stage).toMatchObject({ territoryId: "andalucia" });
    store.dispatch(chooseRaidSite(sub("burgos")));
    expect(missionOf(now(), bomber)).toMatchObject({ mission: { kind: "raid", subTerritoryId: "burgos" } });
    expect(now().draft).not.toHaveProperty("stage");
  });

  it("plans a raid at once where only one sub-territory is a target", () => {
    const sites = scenario.index.subTerritoriesByTerritory.get(castile) ?? [];
    const own = new Set(sites.slice(1).map((site) => site.id));
    const state: GameState = {
      ...start,
      subTerritories: Object.fromEntries(Object.entries(start.subTerritories).map(([id, site]) => [id, own.has(id as SubTerritoryId) ? { ...site, holder: faction("republic") } : site]))
    };
    const { now, store } = storeOf(planning(state));
    store.dispatch(chooseAirMission({ mission: "raid", unitId: bomber }));
    store.dispatch(clickMapTerritory(castile));
    expect(missionOf(now(), bomber)).toMatchObject({ mission: { kind: "raid", subTerritoryId: sites[0]?.id } });
  });

  it("leaves by Cancel, Stand down or closing the aircraft, and keeps the mission planned before", () => {
    const { now, store } = storeOf();
    store.dispatch(planAirMission({ mission: { kind: "raid", subTerritoryId: sub("burgos") }, unitId: bomber }));
    store.dispatch(chooseAirMission({ mission: "support", unitId: bomber }));
    store.dispatch(cancelOrderStage());
    expect(now().draft).not.toHaveProperty("stage");
    expect(now().draft.selectedAircraftId).toBe(bomber);
    expect(missionOf(now(), bomber)).toMatchObject({ mission: { kind: "raid" } });
    store.dispatch(chooseAirMission({ mission: "support", unitId: bomber }));
    store.dispatch(planAirMission({ unitId: bomber }));
    expect(now().draft).not.toHaveProperty("stage");
    expect(missionOf(now(), bomber)).toBeUndefined();
    store.dispatch(chooseAirMission({ mission: "support", unitId: bomber }));
    store.dispatch(closeAircraftPane());
    expect(now().draft).not.toHaveProperty("stage");
    expect(now().draft).not.toHaveProperty("selectedAircraftId");
  });

  it("says why a territory is no target, and keeps choosing", () => {
    const { now, store } = storeOf();
    store.dispatch(chooseAirMission({ mission: "raid", unitId: bomber }));
    store.dispatch(clickMapTerritory(madrid));
    expect(told(scenario, now().draft.feedback)).toBe("Raids target ground another faction holds.");
    expect(targetRefusal(scenario, now(), madrid)).toEqual({ inRange: true, reason: { code: "refused", refusals: [{ code: "raid-own-ground" }] } });
    expect(targetRefusal(scenario, now(), castile)).toBeUndefined();
    expect(now().draft.stage).toBeDefined();
    store.dispatch(chooseAirMission({ mission: "recon", unitId: recon }));
    expect(told(scenario, targetRefusal(scenario, now(), start.units[recon]!.territoryId)?.reason)).toBe("Recon looks at ground another faction holds.");
    const bare = { ...scenario, index: { ...scenario.index, subTerritoriesByTerritory: new Map() } };
    const raiding: PlanningSession = { ...now(), draft: { ...now().draft, selectedAircraftId: bomber, stage: { mission: "raid", step: "choose-target" } } };
    expect(told(bare, targetRefusal(bare, raiding, madrid)?.reason)).toBe("Nothing to hit there.");
    const ranged = (range: number) => ({ ...scenario, index: { ...scenario.index, unitTypes: new Map([...scenario.index.unitTypes].map(([id, type]) => [id, type.air === undefined ? type : { ...type, air: { ...type.air, range } }])) } });
    expect(targetRefusal(ranged(1), raiding, territory("galicia"))).toEqual({ inRange: false, reason: { code: "out-of-range", range: 1 } });
    expect(told(scenario, targetRefusal(ranged(0), raiding, territory("galicia"))?.reason)).toBe("Out of range: it flies up to 0 territories from its airfield.");
  });

  it("does nothing when no target is being chosen", () => {
    const idle = planning();
    expect(stageTargets(scenario, idle)).toEqual([]);
    expect(targetRefusal(scenario, idle, madrid)).toBeUndefined();
    expect(chooseTarget(scenario, idle, madrid)).toBe(idle);
    expect(chooseTargetSite(scenario, idle, sub("burgos"))).toBe(idle);
    const { now, store } = storeOf();
    store.dispatch(chooseAirMission({ mission: "raid", unitId: fighter }));
    expect(told(scenario, now().draft.feedback)).toBe("Nothing in range for this mission.");
    expect(now().draft).not.toHaveProperty("stage");
  });

  it("notes a refusal like Move's", () => {
    expect(targetNote(scenario, madrid, undefined)).toBeUndefined();
    expect(targetNote(scenario, madrid, { inRange: true, reason: { code: "nothing-to-hit" } })).toEqual({ lines: [{ text: "Nothing to hit there." }], status: "Not a target for this mission", title: "Madrid" });
    expect(targetNote(scenario, madrid, { inRange: false, reason: { code: "out-of-range", range: 2 } })?.status).toBe("Out of reach this turn");
  });

  it("names the sub-territory under a map click only while a raid chooses its target", () => {
    const dispatch = vi.fn();
    planningMapHandlers(dispatch, scenario, { ...emptyDraft, stage: { mission: "raid", step: "choose-target" } }).onSelectSubTerritory(sub("burgos"));
    expect(dispatch).toHaveBeenCalledWith(chooseRaidSite(sub("burgos")));
  });
});

describe("the target panel (N6)", () => {
  function shown(session: PlanningSession) {
    const { now, store } = storeOf(session);
    const wrap = (node: ReactNode) => <Provider store={store}>{node}</Provider>;
    const view = render(wrap(<TargetPanel scenario={scenario} session={session} />));
    return { now, redraw: () => { view.rerender(wrap(<TargetPanel scenario={scenario} session={now()} />)); }, store };
  }

  it("lists the same targets as buttons, then a raid's sub-territories, and cancels", async () => {
    const { now, redraw, store } = shown(planning());
    expect(screen.queryByRole("region", { name: "Choosing a target" })).toBeNull();
    store.dispatch(chooseAirMission({ mission: "raid", unitId: bomber }));
    redraw();
    const panel = screen.getByRole("region", { name: "Choosing a target" });
    expect(within(panel).getByRole("status")).toHaveTextContent("Breguet XIX Light Bombers: Raid. Choose a highlighted territory on the map.");
    const name = scenario.index.territories.get(castile)!.name;
    await userEvent.click(within(panel).getByRole("button", { name }));
    redraw();
    expect(within(panel).getByRole("status")).toHaveTextContent(`Choose what to raid in ${name}.`);
    await userEvent.click(within(panel).getByRole("button", { name: "All territories in range" }));
    redraw();
    expect(now().draft.stage).not.toHaveProperty("territoryId");
    await userEvent.click(within(panel).getByRole("button", { name }));
    redraw();
    await userEvent.click(within(panel).getByRole("button", { name: /^Burgos/u }));
    expect(missionOf(now(), bomber)).toMatchObject({ mission: { subTerritoryId: "burgos" } });
    store.dispatch(chooseAirMission({ mission: "raid", unitId: bomber }));
    redraw();
    await userEvent.click(screen.getByRole("button", { name: "Cancel mission" }));
    expect(now().draft).not.toHaveProperty("stage");
  });

  it("words the callout for an aircraft, and only for one the scenario names", () => {
    expect(missionCallout(scenario, unit("rep-ni52-fighters"), "patrol", undefined)).toMatch(/: Patrol\. Choose a highlighted territory on the map\.$/u);
    expect(() => missionCallout(scenario, unit("nobody"), "patrol", undefined)).toThrow(/unknown unit/u);
  });
});

describe("Escape while choosing (N6)", () => {
  it("calls back only while active, and not from inside a dialog", async () => {
    const leave = vi.fn();
    render(<><div aria-modal="true" role="dialog"><button type="button">OK</button></div><div data-own-escape="true"><button type="button">Menu item</button></div></>);
    const { rerender } = renderHook(({ active }) => { useEscape(active, leave); }, { initialProps: { active: false } });
    await userEvent.keyboard("{Escape}");
    expect(leave).not.toHaveBeenCalled();
    rerender({ active: true });
    await userEvent.keyboard("a{Escape}");
    expect(leave).toHaveBeenCalledTimes(1);
    screen.getByRole("button", { name: "OK" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(leave).toHaveBeenCalledTimes(1);
    // The game menu closes itself on Escape.
    screen.getByRole("button", { name: "Menu item" }).focus();
    await userEvent.keyboard("{Escape}");
    expect(leave).toHaveBeenCalledTimes(1);
  });
});
