import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReadinessChips } from "../main/components/header/ReadinessChips";
import { clockText, TimerChip } from "../main/components/header/TimerChip";
import { TimerChoice } from "../main/components/timer/TimerChoice";
import { TerritoryWeather } from "../main/components/weather/TerritoryWeather";
import { WeatherChip } from "../main/components/weather/WeatherChip";
import { initialGameState, resolveTurn } from "../main/engine/resolution";
import type { GameState, TurnResolutionResult, WeatherId, WeatherZoneId } from "../main/engine/types";
import { RegistryContext } from "../main/hooks";
import { TurnConditions } from "../main/screens/report/TurnConditions";
import { beginPlanning, endTurn } from "../main/state/gameSlice";
import { timeRanOut } from "../main/state/timeout";
import { chooseTimer, clockKey, pauseClock, planningBudgetMs, remainingMs, resumeClock, startClock, timerSlice } from "../main/state/timerSlice";
import { emptyDraft } from "../main/state/session";
import { createAppStore } from "../main/state/store";
import { faction, move, spain, spainId, territory, testRegistry, testStore, unit, withUnits, testGame } from "./support";

afterEach(cleanup);

function planningStore(minutes: 0 | 1 | 5 | 10, turnNumber = 2) {
  const state = { ...initialGameState(spain()), turnNumber, weather: { outcomes: { cantabrian: "rain", mediterranean: "clear", meseta: "snow", south: "mud" } as Record<WeatherZoneId, WeatherId>, roll: 15 } };
  const game = { assignments: { [faction("republic")]: "local-human" as const, [faction("north")]: "computer" as const, [faction("south")]: "computer" as const }, history: [], ready: [], scenarioId: spainId, gameId: testGame, state };
  const store = testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game, phase: "planning" } }, timer: { minutes } });
  return store;
}

function renderWith(store: ReturnType<typeof testStore>, element: React.JSX.Element) {
  return render(<Provider store={store}><RegistryContext value={testRegistry()}>{element}</RegistryContext></Provider>);
}

describe("the timer's clock (T5)", () => {
  it("doubles turn 1 and gives every turn the full time", () => {
    expect(planningBudgetMs(5, 1)).toBe(600_000);
    expect(planningBudgetMs(5, 2)).toBe(300_000);
    expect(planningBudgetMs(1, 9)).toBe(60_000);
    expect(clockText(252_000)).toBe("4:12");
    expect(clockText(9_100)).toBe("0:10");
  });

  it("pauses keeping the time left, and starts once per key", () => {
    const reduce = timerSlice.reducer;
    let state = reduce(undefined, chooseTimer(1));
    state = reduce(state, startClock({ budgetMs: 60_000, key: "a", now: 1000 }));
    expect(reduce(state, startClock({ budgetMs: 60_000, key: "a", now: 5000 }))).toBe(state);
    state = reduce(state, pauseClock({ now: 21_000 }));
    expect(state.clock?.spentMs).toBe(20_000);
    expect(reduce(state, pauseClock({ now: 30_000 }))).toBe(state);
    const clock = state.clock;
    if (clock === undefined) throw new Error("No clock.");
    expect(remainingMs(clock, 99_000)).toBe(40_000);
    state = reduce(state, resumeClock({ now: 100_000 }));
    expect(reduce(state, resumeClock({ now: 1 }))).toBe(state);
    const resumed = state.clock;
    if (resumed === undefined) throw new Error("No clock.");
    expect(remainingMs(resumed, 110_000)).toBe(30_000);
    expect(remainingMs(resumed, 500_000)).toBe(0);
  });
});

describe("the timer chip (T5, T6)", () => {
  beforeEach(() => { vi.useFakeTimers({ now: 1_000_000, toFake: ["Date", "setInterval", "clearInterval"] }); });
  afterEach(() => { vi.useRealTimers(); });

  it("renders nothing with the timer off", () => {
    const store = planningStore(0);
    renderWith(store, <TimerChip scenario={spain()} state={initialGameState(spain())} />);
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("counts down, warns at a minute and ten seconds, and submits the planned orders when time runs out", () => {
    const store = planningStore(1);
    renderWith(store, <TimerChip scenario={spain()} state={initialGameState(spain())} />);
    expect(screen.getByRole("timer")).toHaveAccessibleName("Time left to plan: 1:00");
    act(() => { vi.advanceTimersByTime(51_000); });
    expect(screen.getByRole("timer")).toHaveAccessibleName("Time left to plan: 0:09");
    expect(screen.getByText("Ten seconds left. Planned orders go in when time runs out.")).toHaveAttribute("aria-live", "polite");
    expect(store.getState().timer.clock?.warned).toEqual([10]);
    expect(store.getState().notifications.notifications).toEqual([]);
    act(() => { vi.advanceTimersByTime(10_000); });
    const session = store.getState().game.session;
    expect(session.phase).toBe("resolution");
    if (session.phase === "resolution") expect(session.result.outcomes).toContainEqual(expect.objectContaining({ factionId: "republic", kind: "time-ran-out" }));
  });

  it("pauses behind a cover that keeps the time left", async () => {
    vi.useRealTimers();
    const store = planningStore(5);
    renderWith(store, <TimerChip scenario={spain()} state={initialGameState(spain())} />);
    await userEvent.click(screen.getByRole("button", { name: "Pause the turn timer" }));
    expect(screen.getByRole("dialog", { name: "Paused" })).toHaveTextContent(/5:00 left to plan/);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("the setup choice and readiness (T5, T6)", () => {
  it("offers Off, 1, 5 and 10 minutes, with the online choices disabled", async () => {
    const store = planningStore(0);
    renderWith(store, <TimerChoice />);
    expect(screen.getAllByRole("radio").map((radio) => [radio.parentElement?.textContent, (radio as HTMLInputElement).disabled]))
      .toEqual([["Off", false], ["1 min", false], ["5 min", false], ["10 min", false], ["30 min \u00b7 online", true], ["1 h \u00b7 online", true]]);
    await userEvent.click(screen.getByRole("radio", { name: "10 min" }));
    expect(store.getState().timer.minutes).toBe(10);
  });

  it("shows each faction as planning or ready", () => {
    render(<ReadinessChips status={[{ abbreviation: "REP", factionId: faction("republic"), name: "Republican Government", ready: false }, { abbreviation: "NIC", factionId: faction("north"), name: "Northern Insurgent Command", ready: true }]} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual(["Republican GovernmentREPplanning", "Northern Insurgent CommandNICready"]);
  });
});

describe("weather in the UI (T3)", () => {
  const snowy = (): GameState => ({ ...initialGameState(spain()), turnNumber: 12, weather: { outcomes: { meseta: "snow" } as Record<WeatherZoneId, WeatherId>, roll: 16 } });

  it("shows the turn's weather and next turn's likeliest outcomes in the pane", () => {
    render(<TerritoryWeather scenario={spain()} state={snowy()} territoryId={territory("madrid")} />);
    const pane = screen.getByLabelText("Weather in the Meseta zone");
    expect(pane).toHaveTextContent("Snow");
    expect(pane).toHaveTextContent(/Next:.*Clear 30%.*Mud 20%/);
  });

  it("renders a chip only where there is weather", () => {
    const { container } = render(<WeatherChip iconOnly scenario={spain()} state={initialGameState(spain())} territoryId={territory("madrid")} />);
    expect(container).toBeEmptyDOMElement();
    render(<WeatherChip iconOnly scenario={spain()} state={snowy()} territoryId={territory("madrid")} />);
    expect(screen.getByTitle("Snow")).toHaveTextContent("Snow");
  });

  it("reports the turn's conditions: time, weather and frostbite", () => {
    const state = { ...withUnits(spain(), [["r_republic_militia-column_1", "republic", "madrid"], ["r_republic_militia-column_2", "republic", "madrid"]]), weather: { outcomes: { meseta: "severe-cold" } as Record<WeatherZoneId, WeatherId>, roll: 20 } };
    const result: TurnResolutionResult = resolveTurn(spain(), state, [{ factionId: faction("republic"), orders: [move("republic", "r_republic_militia-column_1", "madrid", "castilla-la-mancha")], timedOut: true }], 1);
    render(<TurnConditions result={result} scenario={spain()} />);
    expect(screen.getByText("Republican Government's time ran out: 1 unit held.")).toBeInTheDocument();
    expect(screen.getByLabelText("Weather this turn")).toHaveTextContent("Meseta: Severe cold");
    expect(screen.getByText(/^Militia column No\. 1 lost 5 men to frostbite in Castilla-La Mancha/)).toBeInTheDocument();
    expect(result.finalState.units[unit("r_republic_militia-column_1")]?.strength).toBe(95);
  });
});

describe("time running out in hot-seat play (T5)", () => {
  afterEach(() => { vi.useRealTimers(); });

  it("hands over to the next player, who gets a fresh full clock, and reports only the player who ran out", () => {
    vi.useFakeTimers({ now: 0, toFake: ["Date"] });
    const session = planningStore(5).getState().game.session;
    if (session.phase !== "planning") throw new Error("Not planning.");
    const hotSeat = testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game: { ...session.game, assignments: { ...session.game.assignments, [faction("north")]: "local-human" } }, phase: "planning" } }, timer: { minutes: 5 } });
    hotSeat.dispatch(startClock({ budgetMs: planningBudgetMs(5, 2), key: clockKey(testGame, 2, "republic"), now: 0 }));
    vi.setSystemTime(300_000);
    hotSeat.dispatch(timeRanOut());
    expect(hotSeat.getState().game.session).toMatchObject({ factionId: "north", fromFactionId: "republic", phase: "handoff" });
    vi.setSystemTime(500_000);
    hotSeat.dispatch(beginPlanning());
    hotSeat.dispatch(startClock({ budgetMs: planningBudgetMs(5, 2), key: clockKey(testGame, 2, "north"), now: 500_000 }));
    const clock = hotSeat.getState().timer.clock;
    if (clock === undefined) throw new Error("No clock.");
    expect(remainingMs(clock, 500_000)).toBe(300_000);
    hotSeat.dispatch(endTurn());
    const after = hotSeat.getState().game.session;
    expect(after.phase).toBe("resolution");
    if (after.phase === "resolution") expect(after.result.outcomes.filter((outcome) => outcome.kind === "time-ran-out")).toEqual([{ factionId: "republic", heldUnitCount: expect.any(Number) as number, kind: "time-ran-out" }]);
  });
});

describe("a host that has not ended the turn when the player's clock reaches zero", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("is asked again every two seconds, until it has", () => {
    const sent: string[] = [];
    const base = planningStore(1).getState();
    const store = createAppStore({
      client: { send: (command) => { if (command.kind === "game") sent.push(command.command.kind); }, subscribe: () => () => undefined },
      preloadedState: { game: base.game, timer: { minutes: 1 } },
      registry: testRegistry()
    });
    renderWith(store, <TimerChip scenario={spain()} state={initialGameState(spain())} />);
    const pass = (ms: number): void => { for (let step = 0; step < ms / 250; step += 1) act(() => { vi.advanceTimersByTime(250); }); };
    pass(60_250);
    expect(sent).toEqual(["open", "expire"]);
    pass(1000);
    expect(sent).toHaveLength(2);
    pass(4000);
    expect(sent).toEqual(["open", "expire", "expire", "expire"]);
  });
});
