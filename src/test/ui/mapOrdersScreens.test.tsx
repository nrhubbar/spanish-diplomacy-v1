import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../main/app";
import { initialGameState } from "../../main/engine/resolution";
import type { GameState } from "../../main/engine/types";
import { RegistryContext } from "../../main/hooks";
import { longPressMs } from "../../main/map/useTerritoryPress";
import { DefenceBox, OddsBox } from "../../main/screens/actions/MusterBoxes";
import { MusterView } from "../../main/screens/actions/MusterView";
import { quickActionView } from "../../main/screens/actions/useMapActions";
import type { PlanningSession } from "../../main/state/planning";
import { openView } from "../../main/state/paneSlice";
import type { Draft, Session } from "../../main/state/session";
import { faction, spain, spainD20, spainId, territory, testRegistry, testStore, unit, withUnits } from "../support";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const republic = faction("republic");
const scenario = spain();

function planningStore(state: GameState = initialGameState(scenario), draft: Draft = { orders: [], selectedUnitIds: [] }) {
  const game = {
    assignments: { [faction("north")]: "computer" as const, [republic]: "local-human" as const, [faction("south")]: "computer" as const },
    history: [],
    locked: {},
    scenarioId: spainId,
    seed: 1,
    state: { ...state, turnNumber: 2 }
  };
  const session: Session = { draft, factionId: republic, game, phase: "planning" };
  return testStore({ game: { session } });
}

function renderOrders(store: ReturnType<typeof testStore>) {
  const user = userEvent.setup();
  render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={["/orders"]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { user };
}

const region = (id: string): Element => {
  const element = document.querySelector(`.map-region[data-territory-id="${id}"]`);
  if (element === null) throw new Error(`No region ${id}`);
  return element;
};
const draftOf = (store: ReturnType<typeof testStore>): Draft => {
  const session = store.getState().game.session;
  if (session.phase !== "planning") throw new Error("not planning");
  return session.draft;
};

describe("U5: quick actions", () => {
  it("opens a dropdown on right-click, greys out what can't be used, and opens Invade", async () => {
    const store = planningStore();
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    fireEvent.contextMenu(region("castilla-y-leon"), { clientX: 300, clientY: 200 });
    const menu = screen.getByRole("menu", { name: /Castilla y León/ });
    expect(menu).toHaveClass("quick-actions-dropdown");
    const items = within(menu).getAllByRole("menuitem");
    expect(items.map((item) => item.getAttribute("data-action"))).toEqual(["invade", "reinforce", "recruit", "build", "info"]);
    const build = within(menu).getByRole("menuitem", { name: /^Build/ });
    expect(build).toHaveAttribute("aria-disabled", "true");
    expect(build).toHaveAttribute("title", "You hold no ground in Castilla y León to build on.");
    // A greyed-out action does nothing.
    await user.click(build);
    expect(screen.getByRole("menu")).toBeVisible();
    await user.click(within(menu).getByRole("menuitem", { name: /^Invade/ }));
    expect(screen.queryByRole("menu")).toBeNull();
    expect(await screen.findByRole("complementary", { name: "Invade Castilla y León" })).toBeVisible();
  });

  it("closes on Escape or a click outside, and opens Recruit, Build and Info", async () => {
    const store = planningStore();
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    fireEvent.click(document.querySelector(".quick-actions-layer")!);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    fireEvent.contextMenu(document.querySelector(".quick-actions-layer")!);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    // A click inside the menu, off its buttons, keeps it open.
    fireEvent.click(document.querySelector(".quick-actions-head")!);
    expect(within(screen.getByRole("menu")).getAllByRole("menuitem").map((item) => item.getAttribute("data-action"))).toEqual(["invade", "reinforce", "recruit", "build", "info"]);
    await user.click(screen.getByRole("menuitem", { name: /^Recruit/ }));
    expect(screen.getByRole("complementary", { name: /^Recruit/ })).toBeVisible();
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: /^Build/ }));
    expect(screen.getByRole("complementary", { name: /^Build in Madrid/ })).toBeVisible();
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    await user.click(screen.getByRole("menuitem", { name: /^Info/ }));
    expect(screen.getByRole("complementary", { name: "Territory info" })).toBeVisible();
    // A right-click off every territory opens nothing.
    fireEvent.contextMenu(document.querySelector(".map-surface")!);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("opens a wheel on a long-press, once, and the press selects nothing", async () => {
    const store = planningStore();
    renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    vi.useFakeTimers();
    fireEvent.pointerDown(region("extremadura"), { clientX: 120, clientY: 300, pointerId: 1, pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(longPressMs); });
    const wheel = screen.getByRole("menu", { name: /Extremadura/ });
    expect(wheel).toHaveClass("quick-actions-wheel");
    expect(within(wheel).getAllByRole("menuitem").map((item) => item.getAttribute("data-action"))).toEqual(["invade", "reinforce", "recruit", "build", "info"]);
    // Android's own context menu after the long-press opens nothing more.
    fireEvent.contextMenu(region("extremadura"), { clientX: 120, clientY: 300 });
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    fireEvent.pointerUp(region("extremadura"), { pointerId: 1, pointerType: "touch" });
    fireEvent.click(region("extremadura"));
    expect(draftOf(store).selectedTerritoryId).toBeUndefined();
    fireEvent.click(document.querySelector(".quick-actions-layer")!);
    // A drag cancels the long-press; so does lifting the finger early.
    fireEvent.pointerDown(region("extremadura"), { clientX: 120, clientY: 300, pointerId: 2, pointerType: "touch" });
    fireEvent.pointerMove(region("extremadura"), { clientX: 160, clientY: 300, pointerId: 2, pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(longPressMs); });
    fireEvent.pointerCancel(region("extremadura"), { pointerId: 2, pointerType: "touch" });
    expect(screen.queryByRole("menu")).toBeNull();
    // A context menu while the finger is still down (before the timer) opens the wheel instead.
    fireEvent.pointerDown(region("extremadura"), { clientX: 120, clientY: 300, pointerId: 3, pointerType: "touch" });
    fireEvent.contextMenu(region("extremadura"), { clientX: 120, clientY: 300 });
    expect(screen.getByRole("menu")).toHaveClass("quick-actions-wheel");
    act(() => { vi.advanceTimersByTime(longPressMs); });
    expect(screen.getAllByRole("menu")).toHaveLength(1);
    // A second finger (a pinch) cancels it and starts none.
    fireEvent.click(document.querySelector(".quick-actions-layer")!);
    fireEvent.pointerDown(region("extremadura"), { clientX: 120, clientY: 300, pointerId: 5, pointerType: "touch" });
    fireEvent.pointerDown(region("extremadura"), { clientX: 180, clientY: 300, pointerId: 6, pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(longPressMs); });
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.pointerUp(region("extremadura"), { pointerId: 5, pointerType: "touch" });
    // A finger off every territory starts nothing.
    fireEvent.pointerDown(document.querySelector(".map-surface")!, { pointerId: 4, pointerType: "touch" });
    act(() => { vi.advanceTimersByTime(longPressMs); });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps the menu open on other keys, and a mouse press starts no long-press", async () => {
    const store = planningStore();
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    fireEvent.pointerDown(region("madrid"), { button: 2, pointerId: 1, pointerType: "mouse" });
    fireEvent.contextMenu(region("madrid"), { clientX: 10, clientY: 10 });
    await user.keyboard("a");
    expect(screen.getByRole("menu")).toHaveClass("quick-actions-dropdown");
  });

  it("maps each action to its view", () => {
    expect(quickActionView("reinforce", territory("madrid"))).toEqual({ kind: "reinforce", target: "madrid" });
  });
});

describe("U6: the Invade pane", () => {
  it("ticks units, switches their mode, adds Ground Support up to the cap, and orders them all", async () => {
    const store = planningStore();
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    act(() => { store.dispatch(openView({ kind: "invade", target: territory("castilla-y-leon") })); });
    const invade = await screen.findByRole("region", { name: "Invade" });
    expect(within(invade).getByRole("status")).toHaveTextContent("Tick the units to send");
    const order = within(invade).getByRole("button", { name: /^Order 0 units to invade/ });
    expect(order).toBeDisabled();
    const madrid = within(invade).getByRole("region", { name: "From Madrid" });
    const wadRas = within(madrid).getByRole("article", { name: "Wad-Ras Infantry Regiment No. 1" });
    await user.click(within(wadRas).getByRole("checkbox"));
    expect(within(invade).getByRole("status")).toHaveTextContent(/Attack\s*\d+/);
    expect(within(madrid).getByRole("heading")).toHaveTextContent("1 of");
    const motor = within(wadRas).getByRole("button", { name: "Motor" });
    await user.click(motor);
    expect(motor).toHaveAttribute("aria-pressed", "true");
    // Units that set out further away show the modes they can't use, struck through with why.
    const catalonia = within(invade).getByRole("region", { name: "From Cataluña" });
    const [far] = within(catalonia).getAllByRole("article");
    expect(within(far!).getByRole("button", { name: "March" })).toBeDisabled();
    expect(far).toHaveTextContent("March: March reaches only a neighbouring territory.");
    const supportGroup = within(invade).queryByRole("region", { name: "Ground Support" });
    if (supportGroup !== null) {
      const boxes = within(supportGroup).getAllByRole("checkbox");
      for (const box of boxes.slice(0, 2)) await user.click(box);
      for (const box of boxes.slice(2)) expect(box).toBeDisabled();
    }
    await user.click(within(invade).getByRole("button", { name: /^Order 1 unit/ }));
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();
    const draft = draftOf(store);
    expect(draft.orders).toEqual([expect.objectContaining({ legs: expect.any(Array), to: "castilla-y-leon", unitId: unit("rep-wad-ras-1") })]);
    expect(draft.feedback).toMatch(/ordered to invade Castilla y León\.$/);
  });

  it("starts ticked with what is ordered there, says what a tick replaces, and can clear it", async () => {
    const store = planningStore(initialGameState(scenario), {
      orders: [
        { factionId: republic, from: territory("madrid"), kind: "move", to: territory("castilla-y-leon"), unitId: unit("rep-wad-ras-1") },
        { factionId: republic, from: territory("madrid"), kind: "move", to: territory("castilla-la-mancha"), unitId: unit("rep-covadonga-4") }
      ],
      selectedUnitIds: []
    });
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    act(() => { store.dispatch(openView({ kind: "invade", target: territory("castilla-y-leon") })); });
    const invade = await screen.findByRole("region", { name: "Invade" });
    const wadRas = within(invade).getByRole("article", { name: "Wad-Ras Infantry Regiment No. 1" });
    expect(within(wadRas).getByRole("checkbox")).toBeChecked();
    expect(within(invade).getByRole("article", { name: "Covadonga Infantry Regiment No. 4" })).toHaveTextContent("Ordered to move to Castilla-La Mancha. Ticking this replaces it.");
    await user.click(within(wadRas).getByRole("checkbox"));
    await user.click(within(invade).getByRole("button", { name: /^Order 0 units to invade/ }));
    expect(draftOf(store).orders.map((order) => order.unitId)).toEqual(["rep-covadonga-4"]);
  });

  it("lists the units already in contested ground and the works a unit leaves", async () => {
    const start = initialGameState(scenario);
    const store = planningStore({ ...start, fortification: { ...start.fortification, [territory("madrid")]: { factionId: republic, level: 1 } } });
    renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    act(() => { store.dispatch(openView({ kind: "invade", target: territory("extremadura") })); });
    const invade = await screen.findByRole("region", { name: "Invade" });
    expect(within(invade).getByRole("region", { name: "Already here" })).toHaveTextContent("Attacks where it stands");
    act(() => { store.dispatch(openView({ kind: "invade", target: territory("castilla-y-leon") })); });
    const cyl = await screen.findByRole("region", { name: "Invade" });
    expect(within(cyl).getByRole("article", { name: "Wad-Ras Infantry Regiment No. 1" })).toHaveTextContent("Leaving gives up its works.");
    act(() => { store.dispatch(openView({ kind: "invade", target: territory("ceuta") })); });
    expect(await screen.findByText("None of your units can reach it this turn.")).toBeVisible();
  });
});

describe("U6: the Reinforce pane", () => {
  it("shows the defence before and after, and orders the units in", async () => {
    const store = planningStore();
    const { user } = renderOrders(store);
    await screen.findByRole("complementary", { name: "This turn" });
    act(() => { store.dispatch(openView({ kind: "reinforce", target: territory("castilla-la-mancha") })); });
    const reinforce = await screen.findByRole("region", { name: "Reinforce" });
    const box = within(reinforce).getByRole("status");
    expect(box).toHaveTextContent("Defence after reinforcing");
    const [first] = within(reinforce).getAllByRole("checkbox");
    await user.click(first!);
    await user.click(within(reinforce).getByRole("button", { name: /^Order 1 unit to reinforce/ }));
    expect(draftOf(store).feedback).toBe("1 unit ordered to reinforce Castilla-La Mancha.");
    act(() => { store.dispatch(openView({ kind: "reinforce", target: territory("madrid") })); });
    expect(within(await screen.findByRole("region", { name: "Reinforce" })).getByRole("status")).toHaveTextContent("Strongest threat");
  });
});

describe("U7: why a territory is out of reach", () => {
  const choosing: Draft = { orders: [], selectedTerritoryId: territory("madrid"), selectedUnitIds: [unit("rep-wad-ras-1")], stage: { orderKind: "move", step: "choose-destination" } };

  it("says why on hover, only over a territory out of reach", async () => {
    const store = planningStore(initialGameState(scenario), choosing);
    renderOrders(store);
    await screen.findByRole("application", { name: /map/ });
    fireEvent.pointerMove(region("galicia"), { clientX: 50, clientY: 60, pointerId: 1, pointerType: "mouse" });
    const card = screen.getByRole("tooltip");
    expect(card).toHaveTextContent("Galicia");
    expect(card).toHaveTextContent("Out of reach this turn");
    // The same territory again changes nothing; a reachable one shows nothing.
    fireEvent.pointerMove(region("galicia"), { clientX: 55, clientY: 60, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerMove(region("castilla-la-mancha"), { clientX: 80, clientY: 90, pointerId: 1, pointerType: "mouse" });
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerMove(region("galicia"), { clientX: 50, clientY: 60, pointerId: 1, pointerType: "mouse" });
    fireEvent.pointerLeave(document.querySelector(".map-surface")!);
    expect(screen.queryByRole("tooltip")).toBeNull();
    fireEvent.pointerLeave(document.querySelector(".map-surface")!);
    // A right-click while ordering hides the card and opens the menu.
    fireEvent.pointerMove(region("galicia"), { clientX: 50, clientY: 60, pointerId: 1, pointerType: "mouse" });
    fireEvent.contextMenu(region("galicia"), { clientX: 50, clientY: 60 });
    expect(screen.queryByRole("tooltip")).toBeNull();
    expect(screen.getByRole("menu")).toBeVisible();
    // Choosing an action leaves the Move.
    fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /^Info/ }));
    expect(draftOf(store).stage).toBeUndefined();
  });

  it("opens the reasons in a card when tapped on a phone", async () => {
    const store = planningStore(initialGameState(scenario), choosing);
    const { user } = renderOrders(store);
    await screen.findByRole("application", { name: /map/ });
    fireEvent.pointerDown(region("galicia"), { pointerId: 1, pointerType: "touch" });
    fireEvent.pointerUp(region("galicia"), { pointerId: 1, pointerType: "touch" });
    fireEvent.click(region("galicia"));
    const dialog = screen.getByRole("dialog", { name: "Galicia" });
    expect(dialog).toHaveTextContent("Out of reach this turn");
    await user.keyboard("a");
    expect(dialog).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "OK" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.pointerDown(region("galicia"), { pointerId: 2, pointerType: "touch" });
    fireEvent.click(region("galicia"));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Galicia" })).toBeNull();
    fireEvent.pointerDown(region("galicia"), { pointerId: 3, pointerType: "touch" });
    fireEvent.click(region("galicia"));
    fireEvent.click(document.querySelector(".reach-modal")!);
    expect(screen.getByRole("dialog", { name: "Galicia" })).toBeVisible();
    fireEvent.click(document.querySelector(".reach-modal-layer")!);
    expect(screen.queryByRole("dialog", { name: "Galicia" })).toBeNull();
    // A tap on a territory in reach opens nothing (it plans the move).
    fireEvent.pointerDown(region("castilla-la-mancha"), { pointerId: 9, pointerType: "touch" });
    fireEvent.click(region("castilla-la-mancha"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("U6: Ground Support and the odds box, on the shipped scenario", () => {
  const shipped = spainD20();
  const session = (draft: Partial<Draft> = {}, state: GameState = initialGameState(shipped)): PlanningSession => ({
    draft: { orders: [], selectedUnitIds: [], ...draft },
    factionId: republic,
    game: { assignments: {}, history: [], locked: {}, scenarioId: spainId, seed: 1, state },
    phase: "planning"
  });

  it("ticks aircraft up to the cap, saying why the rest are closed, and orders them", async () => {
    const store = planningStore();
    const user = userEvent.setup();
    const flying = session({ airOrders: [
      { factionId: republic, kind: "air-mission", mission: { kind: "support", territoryId: territory("castilla-y-leon") }, unitId: unit("rep-ni52-fighters") },
      { factionId: republic, kind: "air-mission", mission: { kind: "patrol", territoryId: territory("madrid") }, unitId: unit("rep-breguet-bombers") }
    ] });
    const dispatched = vi.spyOn(store, "dispatch");
    render(<Provider store={store}><MusterView kind="invade" scenario={shipped} session={flying} target={territory("castilla-y-leon")} /></Provider>);
    const group = screen.getByRole("region", { name: "Ground Support" });
    const cards = within(group).getAllByRole("article");
    expect(cards.length).toBeGreaterThanOrEqual(2);
    expect(within(group).getByRole("article", { name: /Breguet/ })).toHaveTextContent("Ticking this replaces it.");
    const boxes = within(group).getAllByRole("checkbox");
    for (const box of boxes) if (!(box as HTMLInputElement).checked && within(group).getAllByRole("checkbox").filter((each) => (each as HTMLInputElement).checked).length < 2) await user.click(box);
    const closed = boxes.filter((box) => !(box as HTMLInputElement).checked);
    for (const box of closed) expect(box).toBeDisabled();
    if (closed.length > 0) expect(group).toHaveTextContent("At most 2 aircraft give Ground Support to one battle.");
    await user.click(within(screen.getByRole("region", { name: "Invade" })).getByRole("article", { name: "Wad-Ras Infantry Regiment No. 1" }).querySelector("input")!);
    expect(screen.getByRole("status")).toHaveTextContent("Ground Support");
    await user.click(screen.getByRole("button", { name: /^Order 1 unit and 2 aircraft to invade/ }));
    expect(dispatched).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ kind: "invade", support: expect.arrayContaining([unit("rep-ni52-fighters")]) }), type: "game/orderFromMuster" }));
    expect(dispatched).toHaveBeenCalledWith(expect.objectContaining({ type: "pane/popView" }));
  });

  it("names the pass, warns of artillery alone, and shows a defence with no threat", () => {
    const asturias = withUnits(shipped, [["rep-asturian-militia", "republic", "asturias"], ["north-san-marcial-22", "north", "castilla-y-leon"]]);
    const held: GameState = {
      ...asturias,
      control: { ...asturias.control, [territory("asturias")]: { factionId: republic, kind: "controlled" } },
      subTerritories: Object.fromEntries(Object.entries(asturias.subTerritories).map(([id, site]) => [id, shipped.index.subTerritories.get(id as never)?.territoryId === territory("asturias") ? { ...site, holder: republic } : site]))
    };
    const store = planningStore();
    render(<Provider store={store}><OddsBox draft={{ orders: [] }} scenario={shipped} session={session({}, held)} support={[]} target={territory("castilla-y-leon")} units={[unit("rep-asturian-militia")]} /></Provider>);
    expect(screen.getByRole("status")).toHaveTextContent("Pajares pass");
    cleanup();
    const guns: GameState = {
      ...held,
      raised: { ...held.raised, [unit("guns-1")]: { factionId: republic, fullStrength: 300, id: unit("guns-1"), name: "Guns", type: "artillery-group" as never } },
      units: { ...held.units, [unit("guns-1")]: { factionId: republic, fatigue: 0, id: unit("guns-1"), morale: { demoralized: false, quietTurns: 0 }, strength: 300, territoryId: territory("madrid") } }
    };
    render(<Provider store={store}><OddsBox draft={{ orders: [] }} scenario={shipped} session={session({}, guns)} support={[]} target={territory("castilla-y-leon")} units={[unit("guns-1")]} /></Provider>);
    expect(screen.getByRole("status")).toHaveTextContent("Artillery alone turns back without a battle.");
    cleanup();
    render(<DefenceBox scenario={shipped} session={session()} target={territory("islas-baleares")} units={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("None next door");
  });
});
