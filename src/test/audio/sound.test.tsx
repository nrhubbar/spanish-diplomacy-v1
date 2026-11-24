import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../main/app";
import type { SoundOutput } from "../../main/audio/director";
import { storageKey } from "../../main/audio/levels";
import { startSound } from "../../main/audio/start";
import { storedSound } from "../../main/audio/stored";
import { GameMenu } from "../../main/components/header/GameMenu";
import type { ConnectionHint } from "../../main/connection";
import type { MapRect } from "../../main/scenarios/loader";
import { RegistryContext } from "../../main/hooks";
import { useDetailWanted } from "../../main/map/useDetailWanted";
import { NotificationShelf } from "../../main/notifications/NotificationShelf";
import { setLevel, setMuted } from "../../main/state/audioSlice";
import { beginPlanning, endTurn, exitGame, openSetup, setActorKind, startGame } from "../../main/state/gameSlice";
import { type AppStore, createAppStore } from "../../main/state/store";
import { act, renderHook } from "@testing-library/react";
import { faction, testRegistry, testStore } from "../support";

function sound(connection?: ConnectionHint, stored: Record<string, string> = {}, betweenMs = 5000) {
  const output = { duckMusic: vi.fn(), play: vi.fn<SoundOutput["play"]>(() => true), setEffectsGain: vi.fn(), setMusic: vi.fn(), stop: vi.fn(), unlock: vi.fn() } satisfies SoundOutput;
  const storage = () => ({ getItem: (key: string) => stored[key] ?? null, setItem: (key: string, value: string) => { stored[key] = value; } });
  const store = createAppStore({ preloadedState: { audio: storedSound(storage, connection) }, registry: testRegistry() });
  let now = 0;
  const stop = startSound({
    document,
    now: () => (now += betweenMs),
    output,
    registry: testRegistry(),
    storage,
    store
  });
  stops.push(stop);
  const musicOn = () => output.setMusic.mock.lastCall?.[0] as boolean;
  return { musicOn, output, store, stored };
}

function campaign(store: AppStore, humans: readonly string[] = ["republic"]): void {
  store.dispatch(openSetup());
  for (const id of ["republic", "north", "south"]) store.dispatch(setActorKind({ factionId: faction(id), kind: humans.includes(id) ? "local-human" : "computer" }));
  store.dispatch(startGame(7));
  store.dispatch(beginPlanning());
}

const stops: (() => void)[] = [];
afterEach(() => {
  for (const stop of stops.splice(0)) stop();
  cleanup();
});

describe("sound in a game", () => {
  it("starts music with the first campaign, with a notice that can mute it, once", async () => {
    const { musicOn, store, stored } = sound();
    expect(musicOn()).toBe(false);
    campaign(store);
    expect(musicOn()).toBe(true);
    render(<Provider store={store}><NotificationShelf /></Provider>);
    expect(screen.getByText("Music is on. Turn it down or off in Settings.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mute music" }));
    expect(musicOn()).toBe(false);
    expect(screen.queryByRole("button", { name: "Mute music" })).toBeNull();
    expect(stored[storageKey]).toContain('"noticeSeen":true');
    store.dispatch(setMuted({ channel: "music", muted: false }));
    expect(store.getState().notifications.notifications).toEqual([]);
  });

  it("stops the music and what is sounding when the game is left", () => {
    const { musicOn, output, store } = sound();
    campaign(store, ["republic", "north"]);
    store.dispatch(endTurn());
    expect(output.play).toHaveBeenCalledTimes(1);
    expect(output.duckMusic).toHaveBeenCalledTimes(1);
    store.dispatch(exitGame());
    expect(output.stop).toHaveBeenCalledTimes(1);
    expect(musicOn()).toBe(false);
  });

  it("does not wait for a sound that could not be played", () => {
    const { output, store } = sound(undefined, {}, 100);
    campaign(store, ["republic", "north"]);
    output.play.mockReturnValueOnce(false);
    store.dispatch(endTurn());
    expect(output.duckMusic).not.toHaveBeenCalled();
    store.dispatch(beginPlanning());
    store.dispatch(endTurn());
    expect(output.play.mock.calls.slice(0, 2).map(([play]) => play.cue)).toEqual(["end-turn", "end-turn"]);
    expect(output.duckMusic).toHaveBeenCalledTimes(1);
  });

  it("plays no effect while muted or hidden, and pauses music in a hidden tab", () => {
    const { musicOn, output, store } = sound();
    campaign(store, ["republic", "north"]);
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(musicOn()).toBe(false);
    store.dispatch(endTurn());
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(musicOn()).toBe(true);
    hidden.mockRestore();
    store.dispatch(setMuted({ channel: "effects", muted: true }));
    store.dispatch(beginPlanning());
    store.dispatch(endTurn());
    expect(output.play).not.toHaveBeenCalled();
    expect(output.setEffectsGain).toHaveBeenLastCalledWith(0);
  });

  it("leaves music off when saving data, until asked", () => {
    const { musicOn, store } = sound({ saveData: true });
    campaign(store);
    expect(musicOn()).toBe(false);
    store.dispatch(setMuted({ channel: "music", muted: false }));
    expect(musicOn()).toBe(true);
  });

  it("works without storage, unlocks in a gesture, and stops listening", () => {
    const { output, store } = sound();
    document.dispatchEvent(new Event("pointerdown"));
    expect(output.unlock).toHaveBeenCalledTimes(1);
    for (const stop of stops.splice(0)) stop();
    document.dispatchEvent(new Event("pointerdown"));
    expect(output.unlock).toHaveBeenCalledTimes(1);
    const blocked = (): never => { throw new Error("blocked"); };
    stops.push(startSound({ document, now: () => 0, output, registry: testRegistry(), storage: blocked, store }));
    store.dispatch(setLevel({ channel: "music", level: 15 }));
    expect(store.getState().audio.levels.music.level).toBe(15);
    expect(storedSound(blocked, undefined).levels.music.level).toBe(60);
  });

  it("keeps a level the player changed before sound had loaded", () => {
    const stored: Record<string, string> = { [storageKey]: JSON.stringify({ levels: { effects: { level: 20, muted: false } } }) };
    const storage = () => ({ getItem: (key: string) => stored[key] ?? null, setItem: (key: string, value: string) => { stored[key] = value; } });
    const { output } = sound();
    const store = createAppStore({ preloadedState: { audio: storedSound(storage, undefined) }, registry: testRegistry() });
    expect(store.getState().audio.levels.effects.level).toBe(20);
    store.dispatch(setLevel({ channel: "effects", level: 45 }));
    stops.push(startSound({ document, now: () => 0, output, registry: testRegistry(), storage, store }));
    expect(store.getState().audio.levels.effects.level).toBe(45);
    expect(stored[storageKey]).toContain('"effects":{"level":45');
  });
});

describe("sound controls", () => {
  it("sets, mutes and resets each channel on its own, and plays a tick on release", async () => {
    const { output, store } = sound();
    render(<Provider store={store}><RegistryContext value={testRegistry()}><MemoryRouter initialEntries={["/settings"]}><App /></MemoryRouter></RegistryContext></Provider>);
    const effects = screen.getByRole("slider", { name: "Effects" });
    fireEvent.change(effects, { target: { value: "35" } });
    fireEvent.pointerUp(effects);
    expect(output.play).toHaveBeenCalledTimes(1);
    fireEvent.keyUp(screen.getByRole("slider", { name: "Music" }));
    expect(output.play).toHaveBeenCalledTimes(1);
    expect(screen.getByText("35%")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Mute effects" }));
    expect(screen.getByRole("button", { name: "Unmute effects" })).toHaveTextContent("Unmute");
    expect(effects).toHaveAttribute("aria-valuetext", "35%, muted");
    expect(screen.getByRole("button", { name: "Mute master" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Reset sound" }));
    expect(effects).toHaveValue("80");
    await userEvent.click(screen.getByRole("button", { name: "Credits" }));
    expect(await screen.findByRole("heading", { name: "Credits" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "CC BY 4.0" })[0]).toHaveAttribute("href", "https://creativecommons.org/licenses/by/4.0/");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  it("says that it is saving data, and reaches Credits from the start screen and back", async () => {
    const { store } = sound({ effectiveType: "2g" });
    const at = (path: string) => render(<Provider store={store}><RegistryContext value={testRegistry()}><MemoryRouter initialEntries={[path]}><App /></MemoryRouter></RegistryContext></Provider>);
    at("/settings");
    expect(screen.getByText(/Saving data/)).toBeVisible();
    cleanup();
    at("/");
    await userEvent.click(screen.getByRole("button", { name: "Credits" }));
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));
    expect(screen.getByRole("heading", { name: "Spanish Diplomacy" })).toBeVisible();
  });

  it("is in the game's menu", async () => {
    render(<Provider store={testStore()}><MemoryRouter><GameMenu /></MemoryRouter></Provider>);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(within(screen.getByRole("region", { name: "Sound" })).getAllByRole("slider")).toHaveLength(3);
  });
});

describe("the detailed map picture", () => {
  const rect = (width: number): MapRect => ({ height: 10, width, x: 0, y: 0 });
  const layers = [{ bounds: rect(3000), url: "a" }, { bounds: rect(1000), url: "b" }];
  it("is wanted after a quiet moment, or at once when zoomed in, and then stays wanted", () => {
    vi.useFakeTimers();
    const quiet = renderHook(({ view }) => useDetailWanted(layers, view), { initialProps: { view: rect(900) } });
    act(() => { vi.advanceTimersByTime(3000); });
    quiet.rerender({ view: rect(901) });
    act(() => { vi.advanceTimersByTime(3000); });
    expect(quiet.result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(quiet.result.current).toBe(true);
    const zoomed = renderHook(({ view }) => useDetailWanted(layers, view), { initialProps: { view: rect(300) } });
    zoomed.rerender({ view: rect(900) });
    expect(zoomed.result.current).toBe(true);
    expect(renderHook(() => useDetailWanted(layers.slice(0, 1), rect(1))).result.current).toBe(false);
    vi.useRealTimers();
  });
});
