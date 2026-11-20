import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { initialGameState } from "../main/engine/resolution";
import type { GameState, TurnOutcome, TurnResolutionResult } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { RegistryContext } from "../main/hooks";
import { groupBattles } from "../main/presentation/battle";
import { battleKeysAt, eventsAt, revealInPane } from "../main/screens/report/focus";
import type { Session } from "../main/state/session";
import { roadMeeting, spainShowcaseOutcomes } from "./battleFixtures";
import { faction, spain, spainId, territory, testRegistry, testStore } from "./support";

function session(outcomes: readonly TurnOutcome[], phase: "game-over" | "resolution" = "resolution"): Session {
  const scenario = spain();
  const state: GameState = initialGameState(scenario);
  const result: TurnResolutionResult = {
    subTerritoryChanges: [],
    cityChanges: [],
    controlChanges: [{ after: { factionId: faction("south"), kind: "controlled" }, before: { factionId: faction("republic"), kind: "controlled" }, territoryId: territory("aragon") }],
    finalState: state,
    outcomes,
    progress: victoryProgress(scenario, state),
    submittedOrders: [],
    ...(phase === "game-over" ? { victory: { condition: "territories" as const, factionIds: [faction("south")] } } : {})
  };
  return {
    game: {
      assignments: { [faction("republic")]: "local-human", [faction("north")]: "computer", [faction("south")]: "computer" },
      history: [],
      locked: {},
      scenarioId: spainId,
      seed: 1936,
      state
    },
    phase,
    result
  };
}

async function renderReport(start: Session, path = "/resolution") {
  const user = userEvent.setup();
  const store = testStore({ briefing: { autoOpenedFor: [faction("republic")] }, game: { session: start } });
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  await screen.findByRole("application", { name: /map/ });
  return { store, user };
}

function region(territoryId: string): Element {
  const element = document.querySelector(`.map-region[data-territory-id="${territoryId}"]`);
  if (element === null) throw new Error(`No region ${territoryId}`);
  return element;
}

function card(territoryId: string): HTMLDetailsElement {
  const element = [...document.querySelectorAll<HTMLDetailsElement>("details.battle-card")]
    .find((candidate) => candidate.dataset["places"]?.split(" ").includes(territoryId) === true);
  if (element === undefined) throw new Error(`No card for ${territoryId}`);
  return element;
}

const focusedCards = (): readonly (string | undefined)[] =>
  [...document.querySelectorAll<HTMLElement>('details.battle-card[data-focused="true"]')].map((element) => element.dataset["places"]);

const highlighted = (): string | null | undefined =>
  document.querySelector('[data-highlight="origin"]')?.getAttribute("data-territory-highlight");

describe("turn report focus (F1)", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("opens, highlights, and scrolls to a collapsed card when its territory is clicked", async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { store, user } = await renderReport(session(spainShowcaseOutcomes()));
    const before = store.getState().game.session;
    expect(card("madrid").open).toBe(false);
    await user.click(region("madrid"));
    expect(card("madrid").open).toBe(true);
    expect(focusedCards()).toEqual(["madrid"]);
    expect(scroll.mock.contexts).toContain(card("madrid"));
    expect(highlighted()).toBe("madrid");
    // Focus is screen state only: nothing reaches the game.
    expect(store.getState().game.session).toBe(before);
    expect(screen.getByRole("status")).toHaveTextContent("Madrid: its battle is shown below.");
  });

  it("focuses a counter's territory, and marks that place's armies as pressed", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    const militia = document.querySelector('.unit-counter[data-unit-id="rep-asturian-militia"]');
    if (!(militia instanceof HTMLElement)) throw new Error("no militia counter");
    expect(militia).toHaveAttribute("aria-pressed", "false");
    await user.click(militia);
    expect(card("asturias").open).toBe(true);
    expect(focusedCards()).toEqual(["asturias"]);
    expect(highlighted()).toBe("asturias");
    expect(document.querySelector('.unit-counter[data-unit-id="rep-asturian-militia"]')).toHaveAttribute("aria-pressed", "true");
  });

  it("tells what happened at a place without a battle, or that nothing did", async () => {
    const scroll = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    await user.click(region("valencia"));
    const note = screen.getByRole("region", { name: "What happened in Valencia" });
    expect(within(note).getByText(/moved from Valencia to Castilla-La Mancha as reinforcements/)).toBeVisible();
    expect(within(note).getByText(/recovered its morale in Valencia/)).toBeVisible();
    expect(within(note).getByText(/fell back to Valencia/)).toBeVisible();
    expect(scroll.mock.contexts).toContain(note);
    expect(focusedCards()).toEqual([]);
    await user.click(region("aragon"));
    expect(screen.getByRole("region", { name: "What happened in Aragón" })).toHaveTextContent(/changed hands: Republican Government . Southern/);
    await user.click(region("galicia"));
    expect(screen.getByText("Nothing happened in Galicia this turn.")).toBeVisible();
    expect(highlighted()).toBe("galicia");
  });

  it("clears the focus on the same place again or on empty map, and leaves opened cards open", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    await user.click(region("murcia"));
    expect(focusedCards()).toEqual(["murcia"]);
    await user.click(region("murcia"));
    expect(focusedCards()).toEqual([]);
    expect(highlighted()).toBeUndefined();
    expect(card("murcia").open).toBe(true);
    await user.click(region("galicia"));
    expect(screen.getByText("Nothing happened in Galicia this turn.")).toBeVisible();
    await user.click(screen.getByRole("application", { name: /map/ }));
    expect(screen.queryByText("Nothing happened in Galicia this turn.")).toBeNull();
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("lets the player close a focused card, and opens it again on the next focus", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    await user.click(region("madrid"));
    const summary = card("madrid").querySelector("summary");
    if (summary === null) throw new Error("no summary");
    await user.click(summary);
    expect(card("madrid").open).toBe(false);
    await user.click(region("madrid"));
    await user.click(region("madrid"));
    expect(card("madrid").open).toBe(true);
  });

  it("focuses by keyboard, keeping keyboard focus on the map", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    const murcia = region("murcia");
    if (!(murcia instanceof SVGElement)) throw new Error("no murcia region");
    murcia.focus();
    await user.keyboard("{Enter}");
    expect(focusedCards()).toEqual(["murcia"]);
    expect(document.activeElement).toBe(region("murcia"));
    await user.keyboard(" ");
    expect(focusedCards()).toEqual([]);
    const militia = document.querySelector('.unit-counter[data-unit-id="rep-asturian-militia"]');
    if (!(militia instanceof HTMLElement)) throw new Error("no militia counter");
    militia.focus();
    await user.keyboard("{Enter}");
    expect(focusedCards()).toEqual(["asturias"]);
    expect(document.activeElement?.closest(".map-surface")).not.toBeNull();
  });

  it("splits only the focused place into single armies below 125% zoom (Z2)", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    const madridGroup = /^Republican Government, 4 armies in Madrid/;
    expect(screen.getByRole("button", { name: madridGroup })).toBeInTheDocument();
    expect(document.querySelector('.unit-counter[data-unit-id="rep-wad-ras-1"]')).toBeNull();
    await user.click(region("madrid"));
    expect(screen.queryByRole("button", { name: madridGroup })).toBeNull();
    expect(document.querySelector('.unit-counter[data-unit-id="rep-wad-ras-1"]')).not.toBeNull();
    // Every other place keeps its summed counters.
    expect(document.querySelectorAll(".unit-counter-group").length).toBeGreaterThan(0);
    await user.click(region("madrid"));
    expect(screen.getByRole("button", { name: madridGroup })).toBeInTheDocument();
  });

  it("keeps keyboard focus on the map when a summed counter opens into single armies", async () => {
    // A phone's overview sums each faction's armies in a territory into one counter.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    const { user } = await renderReport(session(spainShowcaseOutcomes()));
    const group = document.querySelector(".unit-counter-group");
    if (!(group instanceof HTMLElement)) throw new Error("the overview has no summed counters");
    group.focus();
    await user.keyboard("{Enter}");
    expect(group.isConnected).toBe(false);
    expect(document.activeElement?.closest(".map-surface")).not.toBeNull();
    expect(document.activeElement?.getAttribute("data-territory-id")).toBe(highlighted());
  });

  it("focuses on the game-over screen too", async () => {
    const { user } = await renderReport(session(spainShowcaseOutcomes(), "game-over"), "/game-over");
    expect(screen.getByRole("heading", { level: 1, name: /wins$/ })).toBeVisible();
    await user.click(region("asturias"));
    expect(focusedCards()).toEqual(["asturias"]);
    expect(card("asturias").open).toBe(true);
  });
});

describe("turn report focus helpers (F1)", () => {
  it("finds a territory's cards, the road meetings at either end included", () => {
    const groups = groupBattles(spainShowcaseOutcomes());
    expect(battleKeysAt(groups, territory("navarra"))).toEqual([`meeting:${["navarra", "pais-vasco"].join(":")}`]);
    expect(battleKeysAt(groups, territory("pais-vasco"))).toEqual(battleKeysAt(groups, territory("navarra")));
    expect(battleKeysAt(groups, territory("galicia"))).toEqual([]);
    expect(battleKeysAt(groupBattles([roadMeeting]), territory("madrid"))).toEqual([]);
  });

  it("lists nothing for a quiet place and ignores armies that only held", () => {
    const result = session([{ factionId: faction("republic"), kind: "no-move" }]);
    if (result.phase !== "resolution") throw new Error("not a resolution");
    expect(eventsAt(spain(), { ...result.result, controlChanges: [] }, territory("galicia"))).toEqual([]);
  });

  it("scrolls without animation when the player asks for reduced motion", () => {
    const element = document.createElement("div");
    const scroll = vi.spyOn(element, "scrollIntoView");
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    revealInPane(element);
    expect(scroll).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
    vi.unstubAllGlobals();
    revealInPane(element);
    expect(scroll).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start" });
  });
});
