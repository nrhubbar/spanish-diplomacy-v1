import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../main/app";
import { requireFaction } from "../main/engine/lookup";
import { initialGameState } from "../main/engine/resolution";
import type { GameState } from "../main/engine/types";
import { victoryProgress } from "../main/engine/victory";
import { RegistryContext } from "../main/hooks";
import { battleExample } from "../main/presentation/battleBasics";
import { loadPackage, PackageValidationError } from "../main/scenarios/loader";
import { briefingAutoOpened, briefingSlice } from "../main/state/briefingSlice";
import { exitGame, startGame } from "../main/state/gameSlice";
import { selectVictoryStanding } from "../main/state/selectors";
import { emptyDraft } from "../main/state/session";
import tinyMap from "./fixtures/scenarios/tiny-front/map.json";
import tinyScenario from "./fixtures/scenarios/tiny-front/scenario.json";
import { city, faction, spain, spainId, territory, testRegistry, testStore, tiny } from "./support";

describe("briefing data", () => {
  const assetPaths = new Set(["src/test/fixtures/scenarios/tiny-front/geometry.svg", "src/test/fixtures/scenarios/tiny-front/foot.svg"]);
  const load = (scenarioDocument: unknown) => () => loadPackage({ assetPaths, mapDocument: tinyMap, mapPath: "map.json", scenarioDocument, scenarioPath: "scenario.json" });

  it("gives every faction of every package an objective and a first-turn hint", () => {
    for (const summary of testRegistry().list()) {
      for (const entry of testRegistry().require(summary.id).scenario.factions) {
        expect(entry.briefing.objective.length, `${summary.id}/${entry.id}`).toBeGreaterThan(0);
        expect(entry.briefing.firstTurnHint, `${summary.id}/${entry.id}`).toMatch(/\?$/);
      }
    }
  });

  it("rejects a faction without a briefing, or with empty text (L1)", () => {
    const withoutBriefing = structuredClone(tinyScenario);
    const factions = withoutBriefing.factions.map(({ briefing, ...rest }, index) => (index === 0 ? rest : { ...rest, briefing }));
    expect(load({ ...withoutBriefing, factions })).toThrow(/factions\.0\.briefing/);

    const emptyHint = structuredClone(tinyScenario);
    for (const entry of emptyHint.factions) entry.briefing.firstTurnHint = "";
    expect(load(emptyHint)).toThrow(PackageValidationError);
  });

  it("states victory numbers in objectives that match the scenario's thresholds", () => {
    for (const summary of testRegistry().list()) {
      const scenario = testRegistry().require(summary.id).scenario;
      for (const entry of scenario.factions) {
        const standing = selectVictoryStanding(scenario, initialGameState(scenario), entry.id);
        for (const [kind, measure] of [["territories", standing.territories], ["cities", standing.cities]] as const) {
          const stated = new RegExp(`(\\d+) of (\\d+) ${kind}`).exec(entry.briefing.objective);
          if (stated === null) continue;
          expect([Number(stated[1]), Number(stated[2])], `${summary.id}/${entry.id} ${kind}`).toEqual([measure.needed, measure.total]);
        }
      }
    }
  });
});

describe("victory standing selector", () => {
  it("matches the engine's victory progress for every faction", () => {
    for (const scenario of [spain(), tiny()]) {
      const state = initialGameState(scenario);
      for (const entry of victoryProgress(scenario, state)) {
        const standing = selectVictoryStanding(scenario, state, entry.factionId);
        expect(standing.territories).toMatchObject({ held: entry.territoriesControlled, needed: entry.territoryThreshold });
        expect(standing.cities).toMatchObject({ held: entry.citiesControlled, needed: entry.cityThreshold });
      }
    }
  });

  it("measures Spain against 10 of 18 territories and 19 of 25 cities", () => {
    const standing = selectVictoryStanding(spain(), initialGameState(spain()), faction("republic"));
    expect(standing.territories).toMatchObject({ needed: 10, total: 18 });
    expect(standing.cities).toMatchObject({ needed: 19, total: 25 });
  });

  it("follows live control, counting only victory territories and cities", () => {
    const scenario = tiny();
    const start = initialGameState(scenario);
    const state: GameState = {
      ...start,
      cityControl: { ...start.cityControl, [city("port-town")]: faction("red") },
      control: { ...start.control, [territory("harbor")]: { factionId: faction("red"), kind: "controlled" } }
    };
    const before = selectVictoryStanding(scenario, start, faction("red"));
    const after = selectVictoryStanding(scenario, state, faction("red"));
    expect(after.territories.held).toBe(before.territories.held + 1);
    expect(after.cities.held).toBe(before.cities.held + 1);
    expect(after).toMatchObject({ cities: { needed: 2, total: 2 }, territories: { needed: 3, total: 5 } });
    expect(victoryProgress(scenario, state)[0]).toMatchObject({ citiesControlled: after.cities.held, territoriesControlled: after.territories.held });
  });

  it("refuses a faction the scenario does not have", () => {
    expect(() => selectVictoryStanding(tiny(), initialGameState(tiny()), faction("green"))).toThrow("Unknown faction");
  });
});

describe("briefing slice (B4)", () => {
  const reduce = briefingSlice.reducer;

  it("records each player once and forgets them when a game starts or ends", () => {
    const once = reduce(undefined, briefingAutoOpened(faction("red")));
    const twice = reduce(once, briefingAutoOpened(faction("red")));
    expect(twice).toBe(once);
    const both = reduce(twice, briefingAutoOpened(faction("blue")));
    expect(both.autoOpenedFor).toEqual(["red", "blue"]);
    expect(reduce(both, startGame(1)).autoOpenedFor).toEqual([]);
    expect(reduce(both, exitGame()).autoOpenedFor).toEqual([]);
  });
});

function renderApp(store = testStore(), path = "/") {
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <RegistryContext value={testRegistry()}>
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>
      </RegistryContext>
    </Provider>
  );
  return { store, unmount: view.unmount, user };
}

const region = (territoryId: string): Element => {
  const element = document.querySelector(`.map-region[data-territory-id="${territoryId}"]`);
  if (element === null) throw new Error(`No region ${territoryId}`);
  return element;
};

/** End Turn in the top bar (U1), answering its confirm (U2) when armies have no order. */
async function endTheTurn(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  await user.click(screen.getByRole("button", { name: "End Turn" }));
  const confirm = screen.queryByRole("alertdialog");
  if (confirm !== null) await user.click(within(confirm).getByRole("button", { name: "End anyway" }));
}

const briefingOf = (factionId: string) => requireFaction(spain(), faction(factionId)).briefing;

describe("Briefing view", () => {
  afterEach(cleanup);

  it("opens by itself on turn 1 with the objective, progress, report, battles, and controls", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    const briefing = await screen.findByRole("complementary", { name: "Briefing" });
    expect(screen.getByRole("button", { name: "Briefing" })).toHaveAttribute("aria-pressed", "true");
    expect(within(briefing).getByText(briefingOf("republic").objective)).toBeVisible();
    expect(within(briefing).getByText(briefingOf("republic").firstTurnHint)).toBeVisible();
    expect(within(briefing).getByRole("meter", { name: /^Territories: \d+ held, 10 of 18 needed$/ })).toBeVisible();
    expect(within(briefing).getByRole("meter", { name: /^Cities: \d+ held, 19 of 25 needed$/ })).toBeVisible();
    expect(within(briefing).getByRole("heading", { name: "How battles work" })).toBeVisible();
    expect(within(briefing).getByText(/an attack and a defence value/)).toBeVisible();
    expect(within(briefing).getByText(/up to three, and each level shifts the die 1 in the defenders' favour\./)).toBeVisible();
    expect(within(briefing).getByText(/Every unit has one order each turn: Move, Entrench, or Rest\./)).toBeVisible();
    expect(within(briefing).getByText(/Armies that move do not dig in/)).toBeVisible();
    expect(within(briefing).getByText(/cannot attack\. It cannot entrench either: it rests/)).toBeVisible();
    expect(within(briefing).getByText(/Example: two infantry regiment units attack with 8 against one with defence 6, dug in level 1 \(\+1\)\. That is 1:1 odds: 17% to take the territory\. A third unit makes it 12 against 6, 2:1 odds: 33%\./)).toBeVisible();
    expect(within(briefing).getByRole("heading", { name: "Map controls" })).toBeVisible();
    // Reading content with no controls: the body is a tab stop so the keyboard can scroll it.
    expect(briefing.querySelector(".map-pane-body")).toHaveAttribute("tabindex", "0");
    // The turn can still be ended while the Briefing shows: End Turn is in the top bar (U1).
    expect(within(screen.getByRole("banner")).getByRole("button", { name: "End Turn" })).toBeVisible();
  });

  it("toggles with the i control and gives way to the Orders pane on a map selection", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await screen.findByRole("complementary", { name: "Briefing" });
    const toggle = screen.getByRole("button", { name: "Briefing" });
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("Map zoom 100 percent")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("complementary", { name: "Briefing" })).not.toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();
    expect(document.querySelector(".map-pane-body")).not.toHaveAttribute("tabindex");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("complementary", { name: "Briefing" })).toBeVisible();

    await user.click(region("madrid"));
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(within(screen.getByRole("complementary", { name: "Territory info" })).getByRole("heading", { name: "Madrid" })).toBeVisible();

    // Collapsing the pane closes the Briefing; reopening shows the view under it.
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: "Hide briefing" }));
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Territory info" }));
    expect(screen.getByRole("complementary", { name: "Territory info" })).toBeVisible();
  });

  it("opens once for each local player on their own turn, and not again after closing", async () => {
    const { store, unmount, user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.selectOptions(screen.getByLabelText("Player", { selector: "#actor-north" }), "local-human");
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    await user.click(screen.getByRole("button", { name: "Continue to Republican Government" }));
    const first = await screen.findByRole("complementary", { name: "Briefing" });
    expect(within(first).getByText(briefingOf("republic").objective)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Briefing" }));
    expect(screen.getByRole("complementary", { name: "This turn" })).toBeVisible();

    // A remount of the same player's map does not reopen it.
    unmount();
    renderApp(store, "/orders");
    expect(await screen.findByRole("complementary", { name: "This turn" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Briefing" })).toHaveAttribute("aria-pressed", "false");

    await endTheTurn(user);
    await user.click(screen.getByRole("button", { name: "Continue to Northern Insurgent Command" }));
    const second = await screen.findByRole("complementary", { name: "Briefing" });
    expect(within(second).getByText(briefingOf("north").objective)).toBeVisible();
    expect(store.getState().briefing.autoOpenedFor).toEqual(["republic", "north"]);
  });

  it("stays closed after turn 1 and leaves out the first-turn report", async () => {
    const state = { ...initialGameState(spain()), turnNumber: 2 };
    const game = { assignments: { [faction("republic")]: "local-human" as const }, history: [], locked: {}, scenarioId: spainId, seed: 1, state };
    const { user } = renderApp(testStore({ game: { session: { draft: emptyDraft, factionId: faction("republic"), game, phase: "planning" } } }), "/orders");
    expect(await screen.findByRole("complementary", { name: "This turn" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Briefing" }));
    const briefing = screen.getByRole("complementary", { name: "Briefing" });
    expect(within(briefing).getByRole("heading", { name: "Objective" })).toBeVisible();
    expect(within(briefing).queryByRole("heading", { name: "Intelligence report" })).not.toBeInTheDocument();
  });

  it("opens the phone sheet for the Briefing and collapses back to the This turn bar, with End Turn in it", async () => {
    const width = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    const briefing = await screen.findByRole("complementary", { name: "Briefing" });
    expect(document.querySelector(".campaign-map")).toHaveAttribute("data-pane-layout", "sheet");
    expect(within(briefing).getByRole("button", { name: "Hide briefing" })).toHaveAttribute("aria-expanded", "true");
    // U1: on a phone End Turn rides in the pane's bar, the Briefing's included.
    expect(within(briefing.querySelector<HTMLElement>(".map-pane-bar-action")!).getByRole("button", { name: "End Turn" })).toBeVisible();
    await user.click(within(briefing).getByRole("button", { name: "Hide briefing" }));
    expect(screen.getByRole("button", { name: "This turn" })).toHaveAttribute("aria-expanded", "false");
    expect(within(document.querySelector<HTMLElement>(".map-pane-bar-action")!).getByRole("button", { name: "End Turn" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Briefing" }));
    expect(screen.getByRole("button", { name: "Hide briefing" })).toHaveAttribute("aria-expanded", "true");
    width.mockRestore();
  });

  it("shares one list of map controls with Settings", async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole("button", { name: "Settings" }));
    const settingsHints = within(screen.getByRole("main")).getAllByRole("listitem").slice(0, 3).map((item) => item.textContent);
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Create Game" }));
    await user.click(screen.getByRole("button", { name: "Start Campaign" }));
    const briefing = await screen.findByRole("complementary", { name: "Briefing" });
    const controls = within(briefing).getByRole("heading", { name: "Map controls" }).parentElement;
    if (controls === null) throw new Error("No map controls section");
    expect(within(controls).getAllByRole("listitem").map((item) => item.textContent)).toEqual(settingsHints);
  });
});

describe("battle example (B2)", () => {
  it("is computed by the engine from the scenario's own data", () => {
    expect(battleExample(spain())).toEqual({
      cases: [
        { armies: 2, attack: 8, oddsLabel: "1:1", takeChance: 1 / 6 },
        { armies: 3, attack: 12, oddsLabel: "2:1", takeChance: 2 / 6 }
      ],
      defence: 6,
      dugIn: 1,
      dugInRoll: 1,
      typeName: "infantry regiment"
    });
  });

  it("has no example without unit types, and no works when digging in is off", () => {
    const scenario = spain();
    expect(battleExample({ ...scenario, unitTypes: [] })).toBeUndefined();
    expect(battleExample({ ...scenario, combat: { ...scenario.combat, diggingIn: { max: 0, perTurn: 1 } } })?.dugIn).toBe(0);
  });
});
