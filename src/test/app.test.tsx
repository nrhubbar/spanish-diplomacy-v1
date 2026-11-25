import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JSX } from "react";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { ErrorBoundary } from "../main/components/ErrorBoundary";
import { RegistryContext } from "../main/hooks";
import { endTurn, openSetup, startGame } from "../main/state/gameSlice";
import { addInfoNotification } from "../main/state/notificationSlice";
import { testRegistry, testStore } from "./support";

function renderApp(path = "/", store = testStore()) {
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { store, user };
}

const region = (territoryId: string): Element => {
  const element = document.querySelector(`.map-region[data-territory-id="${territoryId}"]`);
  if (element === null) throw new Error(`No region ${territoryId}`);
  return element;
};

/** The planning pane, whichever view it shows (its name is the view's title). */
const thePane = (): HTMLElement => {
  const element = document.querySelector<HTMLElement>(".map-pane");
  if (element === null) throw new Error("No pane");
  return element;
};

/** End Turn, answering its confirm (U2) when some armies have no order. */
async function endTheTurn(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "End Turn" }));
  const confirm = screen.queryByRole("alertdialog");
  if (confirm !== null) await user.click(within(confirm).getByRole("button", { name: "End anyway" }));
}

async function startDefaultGame(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Create Game" }));
  await user.click(screen.getByRole("button", { name: "Start Campaign" }));
  await screen.findByRole("application", { name: /map/ });
}

describe("application flow", () => {
  afterEach(cleanup);

  it("plays a full turn: select, move, remove, end the turn, and continue", async () => {
    const { user } = renderApp();
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    expect(screen.getByRole("heading", { name: "Choose the players" })).toBeVisible();
    expect(screen.getAllByRole("option", { name: /Online Player/ }).every((option) => option.hasAttribute("disabled"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await screen.findByRole("application", { name: /map/ });
    expect(screen.getByRole("heading", { level: 1, name: "Republican Government" })).toBeVisible();
    expect(screen.getByText(/Turn 1 . Late July 1936/)).toBeVisible();

    await user.click(region("madrid"));
    const pane = screen.getByRole("complementary", { name: "Territory info" });
    expect(within(pane).getByRole("heading", { name: "Madrid" })).toBeVisible();
    expect(within(pane).getByText("4 of 4 selected")).toBeVisible();
    expect(within(pane).getByText("4 units selected")).toBeVisible();
    await user.click(within(pane).getByRole("button", { name: "Move" }));
    expect(within(pane).getByText(/Moving 4 units from Madrid. Choose a highlighted territory/)).toBeVisible();
    expect(within(pane).getByRole("button", { name: "Cancel move" })).toHaveFocus();
    expect(document.querySelectorAll('[data-highlight="destination"]').length).toBeGreaterThan(0);
    await user.click(region("galicia"));
    expect(within(pane).getByText(/not connected to Madrid/)).toBeVisible();
    await user.click(region("castilla-la-mancha"));
    // Note 11: after the order nothing is selected, so the selection bar goes.
    expect(within(pane).queryByRole("button", { name: "Move" })).not.toBeInTheDocument();
    await user.click(within(pane).getByRole("button", { name: "This turn" }));
    expect(screen.getByRole("complementary", { name: "This turn" })).toBe(pane);
    expect(within(pane).getByRole("list", { name: "Unit orders (4)" })).toBeVisible();
    expect(within(pane).getByText(/^4 moving, (\d+ (attacking|holding), )*\d+ entrenching, 0 resting$/)).toBeVisible();
    expect(document.querySelectorAll('[data-route-kind="planned"]')).toHaveLength(1);
    await user.click(within(pane).getByRole("button", { name: /Cancel Wad-Ras/ }));
    expect(within(pane).getByRole("list", { name: "Unit orders (3)" })).toBeVisible();
    // The map counters name each of the player's armies' orders too.
    expect(screen.getByRole("button", { name: /^Wad-Ras Infantry Regiment No\. 1, Republican Government, .*, entrenching$/ })).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^[^,]+, Republican Government, .*, moving$/ })).toHaveLength(3);

    // U2: End Turn, now in the top bar, lists the armies with no order before ending.
    await user.click(screen.getByRole("button", { name: "End Turn" }));
    const confirm = screen.getByRole("alertdialog", { name: /armies have no order/ });
    expect(within(confirm).getByRole("list", { name: "Armies with no order" })).toHaveTextContent(/Wad-Ras/);
    await user.click(within(confirm).getByRole("button", { name: "Back" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await endTheTurn(user);
    // The route follows the session in an effect, so the results screen can take a moment.
    expect(await screen.findByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
    const report = await screen.findByRole("complementary", { name: "Turn report" });
    expect(within(report).getByRole("heading", { name: "What happened" })).toBeVisible();
    expect(within(report).getByRole("heading", { name: "Victory progress" })).toBeVisible();
    expect(within(report).getAllByRole("meter").length).toBeGreaterThan(0);
    await user.click(within(report).getByRole("button", { name: "Start Next Turn" }));
    await screen.findByRole("application", { name: /map/ });
    expect(screen.getByText(/^Turn 2 . Early August 1936/)).toBeVisible();
  });

  it("selects every army by default and lets the player unselect before ordering", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: /Guadalajara Infantry Regiment No. 10/ }));
    const pane = screen.getByRole("complementary", { name: "Territory info" });
    const armies = within(pane).getByRole("list", { name: "Your units" });
    const otumba = within(armies).getByRole("button", { name: /Otumba/ });
    const guadalajara = within(armies).getByRole("button", { name: /Guadalajara/ });
    expect(otumba).toHaveAttribute("aria-pressed", "true");
    expect(guadalajara).toHaveAttribute("aria-pressed", "true");

    await user.click(guadalajara);
    expect(guadalajara).toHaveAttribute("aria-pressed", "false");
    expect(within(pane).getByText("1 of 2 selected")).toBeVisible();
    await user.click(within(pane).getByRole("button", { name: "Clear" }));
    // U4: with nothing selected there is no selection bar.
    expect(within(pane).queryByRole("group", { name: "Orders for the selected units" })).not.toBeInTheDocument();
    await user.click(within(pane).getByRole("button", { name: "Select all" }));
    await user.click(guadalajara);
    expect(within(pane).getByText("1 unit selected")).toBeVisible();
    const bar = within(pane).getByRole("group", { name: "Orders for the selected units" });
    expect(within(bar).getByRole("button", { name: "Move" })).toHaveAccessibleDescription("March to a neighboring territory.");

    await user.click(within(bar).getByRole("button", { name: "Move" }));
    await user.click(screen.getByText("Legend"));
    expect(screen.getByText(/^Possible destination/)).toBeVisible();
    await user.click(within(pane).getByRole("button", { name: "Cancel move" }));
    expect(document.querySelectorAll('[data-highlight="destination"]')).toHaveLength(0);
    expect(otumba).toHaveAttribute("aria-pressed", "true");
    expect(guadalajara).toHaveAttribute("aria-pressed", "false");

    await user.click(within(pane).getByRole("button", { name: "Move" }));
    await user.click(region("castilla-la-mancha"));
    expect(within(armies).getByRole("button", { name: /Otumba/ })).toHaveTextContent(/Moving to Castilla-La Mancha/);
    // Note 11: nothing is selected after the order.
    expect(within(armies).getByRole("button", { name: /Otumba/ })).toHaveAttribute("aria-pressed", "false");
    expect(within(armies).getByRole("button", { name: /Guadalajara/ })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText("Planned move")).toBeVisible();
  });

  it("explains a territory whose armies are all moving", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    await user.click(region("madrid"));
    const pane = thePane();
    await user.click(within(pane).getByRole("button", { name: "Move" }));
    await user.click(region("castilla-la-mancha"));
    expect(within(pane).getByText("All moving")).toBeVisible();
    expect(within(pane).queryByRole("button", { name: "Select all" })).not.toBeInTheDocument();
    await user.click(region("madrid"));
    expect(within(pane).getByRole("status")).toHaveTextContent(/Every unit here is moving/);
  });

  it("hands the device between local players without revealing orders, then shows the results", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.selectOptions(screen.getByLabelText("Player", { selector: "#actor-north" }), "local-human");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("heading", { name: "Pass to Republican Government" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Continue to Republican Government" }));
    await endTheTurn(user);
    expect(screen.getByRole("heading", { name: "Pass to Northern Insurgent Command" })).toBeVisible();
    expect(screen.getByText(/Republican Government has submitted its orders/)).toBeVisible();
    expect(screen.queryByText(/Madrid/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue to Northern Insurgent Command" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Northern Insurgent Command" })).toBeVisible();
    await endTheTurn(user);
    // Awaited by design, as in the first test: the session guard redirects with <Navigate> (an
    // effect, so one render is empty) and the results screen is lazy, so it may suspend once.
    expect(await screen.findByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
    expect(within(await screen.findByRole("complementary", { name: "Turn report" })).getByRole("button", { name: "Start Next Turn" })).toBeVisible();
  });

  it("plays an all-computer game straight to the turn report", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.selectOptions(screen.getByLabelText("Player", { selector: "#actor-republic" }), "computer");
    // A fixed game seed (the setup draws it from Math.random), so the game cannot end on turn 2.
    const random = vi.spyOn(Math, "random").mockReturnValue(0.5);
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    random.mockRestore();
    expect(await screen.findByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
    // The header renders at once; the pane with the report waits for the map assets, which each
    // new store loads asynchronously. Wait for the report, not just the heading.
    const report = await screen.findByRole("complementary", { name: "Turn report" });
    await user.click(within(report).getByRole("button", { name: "Start Next Turn" }));
    expect(await screen.findByText(/^Turn 2/)).toBeVisible();
    expect(screen.getByRole("heading", { level: 1, name: "Turn resolution" })).toBeVisible();
    expect(await screen.findByRole("complementary", { name: "Turn report" })).toBeVisible();
  });

  it("plays the fixture scenario to a victory and starts again", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.selectOptions(screen.getByLabelText("Scenario"), "tiny-front");
    // A second local player who holds keeps the outcome independent of computer play and dice.
    await user.selectOptions(screen.getByLabelText("Player", { selector: "#actor-blue" }), "local-human");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await user.click(screen.getByRole("button", { name: "Continue to Red League" }));
    await screen.findByRole("application", { name: /map/ });
    await user.click(region("westfold"));
    await user.click(screen.getByRole("button", { name: "Move" }));
    await user.click(region("lowlands"));
    await endTheTurn(user);
    await user.click(await screen.findByRole("button", { name: "Continue to Blue Union" }));
    await endTheTurn(user);
    expect(await screen.findByRole("heading", { level: 1, name: "Red League wins" })).toBeVisible();
    expect(screen.getByText(/won by controlling the most territory/)).toBeVisible();
    expect(screen.queryByRole("button", { name: "Start Next Turn" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Set Up Another Campaign" }));
    // The route follows the session a moment later; wait for it rather than racing it.
    expect(await screen.findByRole("heading", { name: "Choose the players" })).toBeVisible();
  });

  it("guards routes, opens settings, and returns", async () => {
    const { user } = renderApp("/orders");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
    expect(screen.getByText(/geoBoundaries/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    cleanup();
    renderApp("/no-such-page");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("redirects the retired reveal path to wherever the session belongs", async () => {
    renderApp("/reveal");
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
    cleanup();

    const store = testStore();
    store.dispatch(openSetup());
    store.dispatch(startGame("11"));
    renderApp("/reveal", store);
    // Planning on turn 1 opens on the Briefing (B4); the redirect lands on the planning screen.
    expect(await screen.findByRole("complementary", { name: "Briefing" })).toBeVisible();
    cleanup();

    store.dispatch(endTurn());
    renderApp("/reveal", store);
    expect(await screen.findByRole("complementary", { name: "Turn report" })).toBeVisible();
  });

  it("confirms before leaving a game and warns before unloading", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    // U1: Exit Game lives in the menu, beside Settings and a Save that is not built yet.
    await user.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAccessibleDescription("Coming later");
    await user.click(screen.getByRole("button", { name: "Exit Game" }));
    await user.click(screen.getByRole("button", { name: "Stay" }));
    await user.click(screen.getByRole("button", { name: "Exit Game" }));
    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("shows setup feedback and goes back home", async () => {
    const { store, user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    act(() => { store.dispatch({ payload: { factionId: "north", kind: "online-human" }, type: "game/setActorKind" }); });
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Online play is coming later");
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("renders and dismisses notifications", async () => {
    const { store, user } = renderApp();
    act(() => { store.dispatch(addInfoNotification("Orders saved.")); });
    expect(screen.getByText("Orders saved.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Orders saved.")).not.toBeInTheDocument();
  });
});

describe("campaign map interaction", () => {
  afterEach(cleanup);

  it("zooms and pans from controls, keys, and the wheel", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    const map = screen.getByRole("application", { name: /map/ });
    expect(map).toHaveAttribute("data-semantic-level", "overview");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("Map zoom 125 percent")).toBeInTheDocument();
    fireEvent.keyDown(map, { key: "+" });
    expect(map).toHaveAttribute("data-semantic-level", "operational");
    const before = map.getAttribute("data-camera-x");
    fireEvent.keyDown(map, { code: "KeyD", key: "d" });
    await waitFor(() => { expect(map.getAttribute("data-camera-x")).not.toBe(before); });
    fireEvent.keyUp(map, { code: "KeyD", key: "d" });
    fireEvent.keyDown(map, { key: "0" });
    expect(screen.getByText("Map zoom 100 percent")).toBeInTheDocument();
    fireEvent.keyDown(map, { key: "-" });
    fireEvent.keyDown(map, { key: "Escape" });
    fireEvent.wheel(map, { clientX: 200, clientY: 200, deltaY: -400 });
    expect(Number(map.getAttribute("data-zoom"))).toBeGreaterThan(1);
    await user.click(screen.getByRole("button", { name: /reset map view/i }));
    expect(map).toHaveAttribute("data-zoom", "1.00");
    for (let step = 0; step < 14; step += 1) await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(map).toHaveAttribute("data-semantic-level", "detail");
  });

  it("selects territories with Enter but leaves Enter on counters to the button (B3)", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    // Individual counters show from 125% zoom (Z1).
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.keyDown(region("valencia"), { key: "Enter" });
    expect(screen.getByRole("heading", { name: "Valencia" })).toBeVisible();
    const counter = screen.getByRole("button", { name: /Wad-Ras Infantry Regiment No. 1/ });
    fireEvent.keyDown(counter, { key: "Enter" });
    expect(screen.getByRole("heading", { name: "Valencia" })).toBeVisible();
    await user.click(counter);
    expect(screen.getByRole("heading", { name: "Madrid" })).toBeVisible();
    expect(counter).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: /Zamora Infantry Regiment/ }));
    expect(screen.getByRole("heading", { name: "Galicia" })).toBeVisible();
    expect(screen.getByText(/Other units here/)).toBeVisible();
  });

  it("drags without selecting and collapses the pane", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    const map = screen.getByRole("application", { name: /map/ });
    const before = map.getAttribute("data-camera-x");
    const target = region("madrid");
    fireEvent.pointerDown(target, { button: 0, clientX: 300, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(target, { clientX: 360, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(target, { clientX: 360, clientY: 300, pointerId: 1 });
    fireEvent.click(target);
    expect(map.getAttribute("data-camera-x")).not.toBe(before);
    expect(screen.queryByRole("heading", { name: "Madrid" })).not.toBeInTheDocument();
    fireEvent.pointerDown(target, { button: 0, clientX: 300, clientY: 300, pointerId: 2 });
    fireEvent.pointerCancel(target, { pointerId: 2 });

    // Turn 1 opens on the Briefing; collapsing it leaves the Orders pane collapsed.
    await user.click(screen.getByRole("button", { name: "Hide briefing" }));
    expect(screen.getByRole("button", { name: "This turn" })).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "This turn" }));
    expect(screen.getByRole("button", { name: "Hide this turn" })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the legend for what is on the map", async () => {
    const { user } = renderApp();
    await startDefaultGame(user);
    await user.click(screen.getByText("Legend"));
    expect(screen.getByText("Contested")).toBeVisible();
    expect(screen.getByText("Sea crossing")).toBeVisible();
    expect(screen.queryByText("Uncontrolled")).not.toBeInTheDocument();
  });
});

describe("error boundary", () => {
  afterEach(cleanup);

  it("reports a render error and resets", async () => {
    const onError = vi.fn();
    const onReset = vi.fn();
    let broken = true;
    function Fragile(): JSX.Element {
      if (broken) throw new Error("boom");
      return <p>Recovered</p>;
    }
    const quiet = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<ErrorBoundary onError={onError} onReset={onReset}><Fragile /></ErrorBoundary>);
    expect(onError).toHaveBeenCalledWith("Something went wrong: boom");
    broken = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "Return home" }));
    expect(onReset).toHaveBeenCalled();
    expect(screen.getByText("Recovered")).toBeVisible();
    quiet.mockRestore();
  });
});
