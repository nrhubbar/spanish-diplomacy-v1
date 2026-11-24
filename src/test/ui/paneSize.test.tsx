import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MapPane, type PaneContent } from "../../main/map/MapPane";
import { PaneGrip, SheetGrip } from "../../main/map/PaneGrip";
import { loadPanePreference, savePaneOpen, savePaneWidth } from "../../main/map/panePreference";
import { clampPaneWidth, paneKey, paneLimits, sheetKey, stopFor, tappedStop } from "../../main/map/paneSize";
import { usePaneView } from "../../main/map/usePaneView";
import { opensTall } from "../../main/state/paneSlice";
import { territory } from "../support";

beforeEach(() => { localStorage.clear(); });
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe("the pane's width", () => {
  it("stays between 300 and 640 and leaves the map 720 px, the minimum winning on a small map", () => {
    expect(paneLimits(1406)).toEqual({ max: 640, min: 300 });
    expect(paneLimits(1246)).toEqual({ max: 514, min: 300 });
    expect(paneLimits(990)).toEqual({ max: 300, min: 300 });
    expect([100, 400.4, 900].map((width) => clampPaneWidth(width, 1246))).toEqual([300, 400, 514]);
    expect(clampPaneWidth(500, 990)).toBe(300);
  });

  it("answers the grip's keys", () => {
    expect(paneKey("ArrowLeft", 400, 1406)).toBe(416);
    expect(paneKey("ArrowRight", 310, 1406)).toBe(300);
    expect(paneKey("Home", 400, 1406)).toBe(300);
    expect(paneKey("End", 400, 1406)).toBe(640);
    expect(paneKey("Enter", 400, 1406)).toBe("reset");
    expect(paneKey("Tab", 400, 1406)).toBeUndefined();
  });

  it("drags the grip, telling the map once at the end, and resets on a double-click", () => {
    const onWidth = vi.fn();
    const { container } = render(<div className="campaign-map"><PaneGrip mapWidth={1406} onWidth={onWidth} paneId="pane" width={400} /></div>);
    const grip = screen.getByRole("separator", { name: "Pane width" });
    grip.setPointerCapture = vi.fn();
    expect(grip).toHaveAttribute("aria-orientation", "vertical");
    expect(grip).toHaveAttribute("aria-valuetext", "400 pixels");
    expect([grip.getAttribute("aria-valuemin"), grip.getAttribute("aria-valuemax"), grip.getAttribute("aria-valuenow")]).toEqual(["300", "640", "400"]);
    fireEvent.pointerMove(grip, { clientX: 100 });
    fireEvent.pointerUp(grip);
    fireEvent.pointerDown(grip, { button: 2, clientX: 1000 });
    fireEvent.pointerUp(grip);
    expect(onWidth).not.toHaveBeenCalled();
    fireEvent.pointerDown(grip, { button: 0, clientX: 1000 });
    fireEvent.pointerMove(grip, { clientX: 950 });
    fireEvent.pointerMove(grip, { clientX: 900 });
    expect(container.querySelector<HTMLElement>(".campaign-map")?.style.getPropertyValue("--pane-width")).toBe("500px");
    expect(onWidth).not.toHaveBeenCalled();
    fireEvent.pointerUp(grip);
    expect(onWidth.mock.calls).toEqual([[500]]);
    // A press that goes nowhere changes nothing.
    fireEvent.pointerDown(grip, { button: 0, clientX: 1000 });
    fireEvent.pointerCancel(grip);
    expect(onWidth).toHaveBeenCalledTimes(1);
    fireEvent.doubleClick(grip);
    expect(onWidth).toHaveBeenLastCalledWith(undefined);
    const keys = vi.fn();
    window.addEventListener("keydown", keys);
    fireEvent.keyDown(grip, { key: "ArrowLeft" });
    expect(onWidth).toHaveBeenLastCalledWith(416);
    fireEvent.keyDown(grip, { key: "Enter" });
    expect(onWidth).toHaveBeenLastCalledWith(undefined);
    // The arrows on the grip never pan the map; other keys pass through.
    expect(keys).not.toHaveBeenCalled();
    fireEvent.keyDown(grip, { key: "Tab" });
    expect(keys).toHaveBeenCalledTimes(1);
    window.removeEventListener("keydown", keys);
  });
});

describe("a drag of the side pane that changes nothing", () => {
  function dragging(): { readonly drawn: () => string; readonly grip: HTMLElement; readonly onWidth: ReturnType<typeof vi.fn> } {
    const onWidth = vi.fn();
    const { container } = render(<div className="campaign-map"><PaneGrip mapWidth={1406} onWidth={onWidth} paneId="pane" width={400} /></div>);
    const map = container.querySelector<HTMLElement>(".campaign-map")!;
    map.style.setProperty("--pane-width", "400px");
    const grip = screen.getByRole("separator", { name: "Pane width" });
    grip.setPointerCapture = vi.fn();
    fireEvent.pointerDown(grip, { button: 0, clientX: 1000 });
    fireEvent.pointerMove(grip, { clientX: 900 });
    return { drawn: () => map.style.getPropertyValue("--pane-width"), grip, onWidth };
  }

  it.each(["pointerCancel", "lostPointerCapture"] as const)("goes back to the map's width on %s, and the rest of the gesture is ignored", (taken) => {
    const { drawn, grip, onWidth } = dragging();
    expect(drawn()).toBe("500px");
    fireEvent[taken](grip);
    expect(drawn()).toBe("400px");
    fireEvent.pointerMove(grip, { clientX: 800 });
    fireEvent.pointerUp(grip);
    expect(drawn()).toBe("400px");
    expect(onWidth).not.toHaveBeenCalled();
  });

  it("leaves the map's width in place when it ends where it began, and keeps a chosen one when its capture is then released", () => {
    const { drawn, grip, onWidth } = dragging();
    fireEvent.pointerMove(grip, { clientX: 1000 });
    fireEvent.pointerUp(grip);
    expect(drawn()).toBe("400px");
    expect(onWidth).not.toHaveBeenCalled();
    fireEvent.pointerDown(grip, { button: 0, clientX: 1000 });
    fireEvent.pointerMove(grip, { clientX: 950 });
    fireEvent.pointerUp(grip);
    fireEvent.lostPointerCapture(grip);
    expect(onWidth.mock.calls).toEqual([[450]]);
    expect(drawn()).toBe("450px");
  });
});

describe("the phone sheet's stops", () => {
  it("snaps to the nearest stop, toggles on a tap and answers keys", () => {
    expect([0.1, 0.3, 0.6, 0.7, 1].map(stopFor)).toEqual(["bar", "half", "half", "tall", "tall"]);
    expect((["bar", "half", "tall"] as const).map(tappedStop)).toEqual(["half", "tall", "half"]);
    expect(["ArrowUp", "ArrowDown", "Home", "End", "Enter", " ", "x"].map((key) => sheetKey(key, "half"))).toEqual(["tall", "bar", "bar", "tall", "tall", "tall", undefined]);
    expect([sheetKey("ArrowUp", "tall"), sheetKey("ArrowDown", "bar")]).toEqual(["tall", "bar"]);
  });

  it("drags, taps and takes keys on its grip", () => {
    const onStop = vi.fn();
    const { container } = render(<div className="campaign-map"><SheetGrip onStop={onStop} paneId="pane" stop="half" /></div>);
    const map = container.querySelector<HTMLElement>(".campaign-map")!;
    const box = vi.spyOn(map, "getBoundingClientRect").mockReturnValue({ bottom: 800, height: 800 } as DOMRect);
    const grip = screen.getByRole("separator", { name: "Pane height" });
    grip.setPointerCapture = vi.fn();
    expect(grip).toHaveAttribute("aria-valuenow", "46");
    const drag = (from: number, to: number): void => {
      fireEvent.pointerDown(grip, { button: 0, clientY: from });
      fireEvent.pointerUp(grip, { clientY: to });
    };
    drag(400, 402);
    drag(400, 100);
    drag(400, 780);
    expect(onStop.mock.calls).toEqual([["tall"], ["tall"], ["bar"]]);
    fireEvent.pointerUp(grip, { clientY: 100 });
    for (const taken of ["pointerCancel", "lostPointerCapture"] as const) {
      fireEvent.pointerDown(grip, { button: 0, clientY: 400 });
      fireEvent[taken](grip);
      fireEvent.pointerUp(grip, { clientY: 100 });
    }
    fireEvent.pointerDown(grip, { button: 2, clientY: 400 });
    fireEvent.pointerUp(grip, { button: 2, clientY: 100 });
    box.mockReturnValue({ bottom: 0, height: 0 } as DOMRect);
    drag(400, 100);
    expect(onStop).toHaveBeenCalledTimes(3);
    fireEvent.keyDown(grip, { key: "ArrowDown" });
    expect(onStop).toHaveBeenLastCalledWith("bar");
    fireEvent.keyDown(grip, { key: "Tab" });
    expect(onStop).toHaveBeenCalledTimes(4);
  });

  it("reads its stop aloud", () => {
    const { rerender } = render(<SheetGrip onStop={vi.fn()} paneId="pane" stop="bar" />);
    for (const [stop, text] of [["bar", "Bar"], ["half", "Half"], ["tall", "Tall"]] as const) {
      rerender(<SheetGrip onStop={vi.fn()} paneId="pane" stop={stop} />);
      expect(screen.getByRole("separator", { name: "Pane height" })).toHaveAttribute("aria-valuetext", text);
    }
  });

  it("opens tall for the long lists only", () => {
    const at = territory("madrid");
    expect([{ kind: "invade" as const, target: at }, { kind: "reinforce" as const, target: at }, { kind: "recruit" as const, territory: at }, { id: at, kind: "territory" as const, tab: "recruit" as const }].every(opensTall)).toBe(true);
    expect([{ kind: "thisTurn" as const }, { id: at, kind: "territory" as const }].some(opensTall)).toBe(false);
  });

  it("is a separator on both layouts, but not over a bar that asks for a choice", () => {
    const sizing = { mapWidth: 1406, onStop: vi.fn(), onToggle: vi.fn(), onWidth: vi.fn(), stop: "half" as const, width: 400 };
    const { rerender } = render(<MapPane {...sizing} content={{ body: "Body", title: "Orders" }} layout="side" open />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "400");
    rerender(<MapPane {...sizing} content={{ body: "Body", title: "Orders" }} layout="side" open={false} />);
    expect(screen.queryByRole("separator")).toBeNull();
    rerender(<MapPane {...sizing} content={{ body: "Body", title: "Orders" }} layout="sheet" open />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "horizontal");
    rerender(<MapPane {...sizing} content={{ body: "Body", sheetFocus: "Choose", title: "Orders" }} layout="sheet" open={false} />);
    expect(screen.queryByRole("separator")).toBeNull();
  });
});

describe("the player's pane choices", () => {
  const content: PaneContent = { attentionKey: "a", body: "Body", title: "Orders" };

  it("are kept in this browser, and anything unreadable is ignored", () => {
    expect(loadPanePreference()).toEqual({ open: {} });
    savePaneWidth(480);
    savePaneOpen("side", false);
    savePaneOpen("sheet", true);
    expect(loadPanePreference()).toEqual({ open: { sheet: true, side: false }, width: 480 });
    savePaneWidth(undefined);
    expect(loadPanePreference()).toEqual({ open: { sheet: true, side: false } });
    // One choice for both layouts, as once kept, does not say which layout it was for.
    for (const bad of ["{", "null", "3", "{\"open\":false}", "{\"open\":{\"side\":\"no\",\"sheet\":1},\"width\":\"wide\"}"]) {
      localStorage.setItem("spanish-diplomacy.pane", bad);
      expect(loadPanePreference()).toEqual({ open: {} });
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    expect(loadPanePreference()).toEqual({ open: {} });
    expect(() => { savePaneOpen("side", true); }).not.toThrow();
  });

  it("are one for each layout: a sheet left at its bar never closes the side pane, nor the reverse", () => {
    const reloaded = () => renderHook(() => usePaneView(content, undefined));
    const phone = reloaded();
    act(() => { phone.result.current.setStop("half"); });
    act(() => { phone.result.current.setStop("bar"); });
    expect([phone.result.current.isOpen("sheet"), phone.result.current.isOpen("side")]).toEqual([false, true]);
    phone.unmount();
    const desktop = reloaded();
    expect([desktop.result.current.isOpen("sheet"), desktop.result.current.isOpen("side")]).toEqual([false, true]);
    expect(desktop.result.current.insetsFor(1406).right).toBe(416);
    act(() => { desktop.result.current.togglePane("sheet", false); });
    act(() => { desktop.result.current.togglePane("side", true); });
    desktop.unmount();
    const again = reloaded();
    expect([again.result.current.isOpen("sheet"), again.result.current.isOpen("side")]).toEqual([true, false]);
    expect(again.result.current.insetsFor(1406).right).toBe(0);
  });

  it("survive a new map, are clamped to it, and go back to the default on a reset", () => {
    const first = renderHook(() => usePaneView(content, undefined));
    expect(first.result.current.widthFor(1406)).toBe(416);
    act(() => { first.result.current.setWidth(600); });
    expect(first.result.current.insetsFor(1406)).toEqual({ bottom: 0, right: 600 });
    expect(first.result.current.widthFor(1246)).toBe(514);
    act(() => { first.result.current.togglePane("side", true); });
    first.unmount();
    const again = renderHook(() => usePaneView(content, undefined));
    expect(again.result.current.isOpen("side")).toBe(false);
    expect(again.result.current.widthFor(1406)).toBe(600);
    act(() => { again.result.current.setWidth(undefined); });
    expect(again.result.current.widthFor(1406)).toBe(416);
  });

  it("do not include a pane the game opened", () => {
    const { rerender, result } = renderHook(({ key }) => usePaneView({ ...content, attentionKey: key }, undefined), { initialProps: { key: "a" } });
    act(() => { result.current.togglePane("side", true); });
    rerender({ key: "b" });
    expect(result.current.isOpen("side")).toBe(true);
    expect(loadPanePreference().open).toEqual({ side: false });
  });

  it("set the sheet's stop until the view changes, which opens at its own", () => {
    const { rerender, result } = renderHook(({ key, tall }) => usePaneView({ ...content, attentionKey: key, tall }, undefined), { initialProps: { key: "a", tall: false } });
    expect(result.current.stopIn("sheet")).toBe("bar");
    act(() => { result.current.setStop("tall"); });
    expect(result.current.stopIn("sheet")).toBe("tall");
    act(() => { result.current.setStop("half"); });
    expect(result.current.stopIn("sheet")).toBe("half");
    act(() => { result.current.setStop("bar"); });
    expect(result.current.isOpen("sheet")).toBe(false);
    rerender({ key: "b", tall: true });
    expect(result.current.stopIn("sheet")).toBe("tall");
  });
});
