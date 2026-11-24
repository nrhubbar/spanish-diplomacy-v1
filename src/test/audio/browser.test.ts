import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startBrowserSound } from "../../main/audio/browser";
import type { Play } from "../../main/audio/mixer";
import { createWebAudioOutput, musicSupport } from "../../main/audio/webAudio";
import { testRegistry, testStore } from "../support";

type Event = readonly [name: string, ...values: readonly number[]];

class FakeParam {
  readonly events: Event[] = [];
  value = 0;
  cancelScheduledValues(at: number): void { this.events.push(["cancel", at]); }
  linearRampToValueAtTime(value: number, at: number): void { this.events.push(["ramp", value, at]); }
  setTargetAtTime(value: number, at: number): void { this.events.push(["target", value, at]); }
  setValueAtTime(value: number, at: number): void { this.events.push(["set", value, at]); }
}

class FakeNode {
  readonly to: FakeNode[] = [];
  readonly gain = new FakeParam();
  readonly context: FakeContext;
  constructor(context: FakeContext) { this.context = context; }
  connect(node: FakeNode): FakeNode {
    this.to.push(node);
    return node;
  }
  disconnect(): void { this.to.length = 0; }
}

class FakeLimiter extends FakeNode {
  readonly threshold = new FakeParam();
  readonly ratio = new FakeParam();
  readonly knee = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

class FakeSource extends FakeNode {
  readonly starts: number[] = [];
  readonly stops: number[] = [];
  end: () => void = () => undefined;
  constructor(context: FakeContext, readonly options: { readonly buffer: unknown; readonly playbackRate: number }) {
    super(context);
    context.sources.push(this);
  }
  addEventListener(_type: string, listener: () => void): void { this.end = listener; }
  start(at: number): void { this.starts.push(at); }
  stop(at: number): void { this.stops.push(at); }
}

class FakeContext {
  currentTime = 10;
  readonly destination = new FakeNode(this);
  readonly gains: FakeNode[] = [];
  readonly limiter = new FakeLimiter(this);
  readonly media: FakeNode[] = [];
  readonly sources: FakeSource[] = [];
  state = "suspended";
  resume = vi.fn(() => Promise.resolve());
  decodeAudioData = vi.fn(() => Promise.resolve({}));
  createDynamicsCompressor(): FakeNode { return this.limiter; }
  createGain(): FakeNode {
    const node = new FakeNode(this);
    this.gains.push(node);
    return node;
  }
  createMediaElementSource(): FakeNode {
    const node = new FakeNode(this);
    this.media.push(node);
    return node;
  }
}

let contexts: FakeContext[] = [];
const fetched = vi.fn<(url: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer>; ok: boolean; statusText: string }>>(() => Promise.resolve({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)), ok: true, statusText: "" }));
const opened = (): FakeContext => contexts[0] as FakeContext;
const effects = (): FakeNode => opened().gains[0] as FakeNode;
const tick: Play = { cue: "order", delaysMs: [0, 600], gainDb: 0, id: 1 };
const loaded = () => vi.waitFor(() => { expect(opened().decodeAudioData).toHaveBeenCalledTimes(fetched.mock.calls.length); }).then(() => new Promise((done) => { setTimeout(done, 0); }));

/** An output after its first gesture, with its effects loaded and its context running. */
async function running() {
  const output = createWebAudioOutput();
  output.setEffectsGain(0.5);
  output.unlock();
  opened().state = "running";
  await loaded();
  return output;
}

beforeEach(() => {
  contexts = [];
  fetched.mockClear();
  vi.stubGlobal("AudioContext", class extends FakeContext {
    constructor() {
      super();
      contexts.push(this);
    }
  });
  vi.stubGlobal("AudioBufferSourceNode", FakeSource);
  vi.stubGlobal("fetch", fetched);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("probably");
  vi.spyOn(HTMLMediaElement.prototype, "load").mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "audioSession");
  Reflect.deleteProperty(navigator, "mediaSession");
});

describe("effects", () => {
  it("wait for a gesture, then go through one gain and a limiter last", async () => {
    const session = { type: "auto" };
    Object.defineProperty(navigator, "audioSession", { configurable: true, value: session });
    const output = createWebAudioOutput();
    output.setEffectsGain(0.5);
    output.stop(1);
    expect(output.play(tick)).toBe(false);
    expect(contexts).toHaveLength(0);
    output.unlock();
    expect(session.type).toBe("ambient");
    expect(effects().gain.value).toBe(0.5);
    expect(effects().to).toEqual([opened().limiter]);
    expect(opened().limiter.to).toEqual([opened().destination]);
    expect([opened().limiter.threshold.value, opened().limiter.ratio.value]).toEqual([-3, 20]);
    await loaded();
    output.unlock();
    expect(contexts).toHaveLength(1);
    expect(opened().resume).toHaveBeenCalledTimes(2);
    expect(new Set(fetched.mock.calls.map(([url]) => url)).size).toBe(fetched.mock.calls.length);
  });

  it("fade in from each start, and free their voice at the end", async () => {
    const output = await running();
    expect(output.play(tick)).toBe(true);
    const [first, last] = opened().sources as [FakeSource, FakeSource];
    const gain = opened().gains[1] as FakeNode;
    expect([first.starts, last.starts]).toEqual([[10], [10.6]]);
    expect(first.options.playbackRate).toBeCloseTo(1);
    expect(first.to).toEqual([gain]);
    expect(gain.to).toEqual([effects()]);
    expect(gain.gain.events).toEqual([["set", 0, 10], ["ramp", 1, 10.006]]);
    last.end();
    expect(gain.to).toEqual([]);
    output.stop(1);
    expect(first.stops).toEqual([]);
  });

  it("fade out when they are replaced", async () => {
    const output = await running();
    output.play(tick);
    const gain = opened().gains[1] as FakeNode;
    gain.gain.value = 0.7;
    opened().currentTime = 11;
    output.stop(1);
    expect(gain.gain.events.slice(2)).toEqual([["cancel", 11], ["set", 0.7, 11], ["ramp", 0, 11.06]]);
    expect(opened().sources.map(({ stops }) => stops)).toEqual([[11.06], [11.06]]);
  });

  it("are dropped while the context resumes, and the next plays", async () => {
    const output = await running();
    opened().state = "suspended";
    opened().resume.mockRejectedValueOnce(new Error("refused"));
    output.unlock();
    expect(output.play(tick)).toBe(false);
    opened().state = "running";
    expect(output.play(tick)).toBe(true);
  });

  it.each([
    ["is not found", () => { fetched.mockResolvedValueOnce({ arrayBuffer: () => Promise.reject(new Error("unread")), ok: false, statusText: "Not Found" }); }],
    ["does not arrive", () => { fetched.mockRejectedValueOnce(new Error("offline")); }]
  ])("ask again for a file that %s, at a later gesture", async (_name, fail) => {
    fail();
    const output = createWebAudioOutput();
    output.setEffectsGain(0.5);
    output.unlock();
    const files = fetched.mock.calls.length;
    const [lost] = fetched.mock.calls[0] as [string];
    opened().state = "running";
    await vi.waitFor(() => { expect(opened().decodeAudioData).toHaveBeenCalledTimes(files - 1); });
    await new Promise((done) => { setTimeout(done, 0); });
    output.unlock();
    expect(fetched.mock.calls.slice(files)).toEqual([[lost]]);
    await new Promise((done) => { setTimeout(done, 0); });
    expect(opened().decodeAudioData).toHaveBeenCalledTimes(files);
    output.unlock();
    expect(fetched).toHaveBeenCalledTimes(files + 1);
  });

  it("ask again for a file that does not decode, and then play it", async () => {
    const output = createWebAudioOutput();
    output.setEffectsGain(0);
    output.unlock();
    opened().state = "running";
    opened().decodeAudioData.mockImplementation(() => Promise.reject(new Error("bad file")));
    expect(fetched).not.toHaveBeenCalled();
    output.setEffectsGain(0.5);
    expect(effects().gain.events).toEqual([["target", 0.5, 10]]);
    await loaded();
    expect(output.play(tick)).toBe(false);
    opened().decodeAudioData.mockImplementation(() => Promise.resolve({}));
    output.unlock();
    await loaded();
    expect(output.play(tick)).toBe(true);
  });

  it("are silent where the browser has no Web Audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    const output = createWebAudioOutput();
    output.setEffectsGain(0.5);
    output.unlock();
    expect(output.play(tick)).toBe(false);
    expect(fetched).not.toHaveBeenCalled();
  });
});

describe("music", () => {
  const ignoreVolume = () => vi.spyOn(HTMLMediaElement.prototype, "volume", "get").mockReturnValue(1);
  /** The elements music was asked to play on, in order. */
  const played = (): HTMLAudioElement[] => vi.mocked(HTMLMediaElement.prototype.play).mock.contexts as HTMLAudioElement[];

  it("finds what the browser can do by trying it", () => {
    expect(musicSupport()).toEqual({ aac: true, opus: true, volume: true });
    ignoreVolume();
    vi.spyOn(HTMLMediaElement.prototype, "canPlayType").mockReturnValue("");
    expect(musicSupport()).toEqual({ aac: false, opus: false, volume: false });
  });

  it("sets the element's own volume where it can", async () => {
    const output = createWebAudioOutput();
    output.setMusic(true, 0.4);
    const [first] = played() as [HTMLAudioElement];
    expect(first.src).toContain(".ogg");
    await vi.waitFor(() => { expect(first.volume).toBeCloseTo(0.4); });
    output.duckMusic();
    await vi.waitFor(() => { expect(first.volume).toBeCloseTo(0.4 * 0.398, 2); });
    expect(contexts).toHaveLength(0);
    output.setMusic(false, 0);
    await vi.waitFor(() => { expect(first.getAttribute("src")).toBeNull(); });
  });

  it("goes through a gain node where it cannot", async () => {
    ignoreVolume();
    const output = createWebAudioOutput();
    output.setMusic(true, 0.4);
    expect(played()[0]?.src).toContain(".m4a");
    output.unlock();
    const context = opened();
    await vi.waitFor(() => { expect(context.gains[1]?.gain.events.at(-1)).toEqual(["target", 0.4, 10]); });
    expect(context.media).toHaveLength(2);
    expect(context.media[0]?.to).toEqual([context.gains[1]]);
    expect(context.gains[1]?.to).toEqual([context.destination]);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2);
    output.setMusic(false, 0);
  });
});

describe("the browser's own controls", () => {
  it("mute and unmute the music, and a gesture opens sound until it is stopped", () => {
    const handlers = new Map<string, () => void>();
    const mediaSession = { metadata: undefined as unknown, setActionHandler: (name: string, handler: () => void) => { handlers.set(name, handler); } };
    Object.defineProperty(navigator, "mediaSession", { configurable: true, value: mediaSession });
    vi.stubGlobal("MediaMetadata", class { readonly title: string; constructor({ title }: { title: string }) { this.title = title; } });
    const store = testStore();
    const stop = startBrowserSound(store, testRegistry());
    expect(mediaSession.metadata).toMatchObject({ title: "Spanish Diplomacy" });
    handlers.get("pause")?.();
    expect(store.getState().audio.levels.music.muted).toBe(true);
    handlers.get("play")?.();
    expect(store.getState().audio.levels.music.muted).toBe(false);
    document.dispatchEvent(new MouseEvent("pointerdown"));
    expect(contexts).toHaveLength(1);
    stop();
  });

  it("are not needed", () => {
    expect("mediaSession" in navigator).toBe(false);
    const stop = startBrowserSound(testStore(), testRegistry());
    expect(contexts).toHaveLength(0);
    stop();
  });
});
