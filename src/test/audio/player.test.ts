import { beforeEach, describe, expect, it, vi } from "vitest";
import { effectUrl, musicTracks } from "../../main/audio/files";
import { createMusicPlayer, type MusicElement, type MusicTrack } from "../../main/audio/musicPlayer";

class FakeElement implements MusicElement {
  currentTime = 0;
  playing = false;
  preload = "";
  refuse = false;
  src = "";
  volume = 0;
  readonly #listeners = new Map<string, () => void>();
  addEventListener(type: string, listener: () => void): void { this.#listeners.set(type, listener); }
  load(): void { this.currentTime = 0; }
  pause(): void { this.playing = false; }
  play(): Promise<void> {
    if (this.refuse) return Promise.reject(new Error("refused"));
    this.playing = true;
    return Promise.resolve();
  }
  removeAttribute(): void { this.src = ""; }
  fire(type: string, time?: number): void {
    if (time !== undefined) this.currentTime = time;
    this.#listeners.get(type)?.();
  }
}

const track = (id: string): MusicTrack => ({ id, overlapSeconds: 10, seconds: 100, source: { type: "audio/ogg", url: `${id}.ogg` }, title: id });
let elements: FakeElement[] = [];

function player(tracks: readonly MusicTrack[] = [track("a"), track("b")]) {
  elements = [];
  const made = createMusicPlayer({
    clearTimer: (timer) => { clearTimeout(timer); },
    createElement: () => {
      const element = new FakeElement();
      elements.push(element);
      return element;
    },
    roll: 0,
    setTimer: (run, ms) => setTimeout(run, ms) as unknown as number,
    setVolume: (element, gain) => { element.volume = gain; },
    tracks
  });
  return { made, first: () => elements[0] as FakeElement, second: () => elements[1] as FakeElement };
}

beforeEach(() => { vi.useFakeTimers(); return () => { vi.useRealTimers(); }; });

describe("music player", () => {
  it("has no source until music is on, and fades in", async () => {
    const { first, made, second } = player();
    made.duck();
    expect(elements).toHaveLength(0);
    made.set(true, 0.5);
    expect(first().src).toBe("a.ogg");
    expect(second().src).toBe("");
    await vi.advanceTimersByTimeAsync(400);
    expect(first()).toMatchObject({ playing: true, volume: 0.5 });
    made.set(true, 0.2);
    await vi.advanceTimersByTimeAsync(200);
    expect(first().volume).toBeCloseTo(0.2);
    made.set(true, 0.2);
  });

  it("fades out, drops its source, and resumes where it was", async () => {
    const { first, made } = player();
    made.set(true, 0.5);
    await vi.advanceTimersByTimeAsync(400);
    first().fire("timeupdate", 42);
    made.set(false, 0);
    expect(first().playing).toBe(true);
    await vi.advanceTimersByTimeAsync(400);
    expect(first()).toMatchObject({ playing: false, src: "", volume: 0 });
    first().fire("error");
    made.set(true, 0.5);
    first().fire("loadedmetadata");
    expect(first()).toMatchObject({ currentTime: 42, playing: true, src: "a.ogg" });
    made.retry();
  });

  it("is released when music goes off under a ducking sound, and comes back at full level", async () => {
    const { first, made } = player();
    made.set(true, 1);
    await vi.advanceTimersByTimeAsync(400);
    made.duck();
    await vi.advanceTimersByTimeAsync(1300);
    made.set(false, 0);
    await vi.advanceTimersByTimeAsync(3000);
    expect(first()).toMatchObject({ playing: false, src: "", volume: 0 });
    made.set(true, 1);
    made.duck();
    made.set(false, 0);
    made.set(true, 1);
    await vi.advanceTimersByTimeAsync(400);
    expect(first().volume).toBe(1);
  });

  it("stays off when an element reports late", async () => {
    const { first, made, second } = player();
    made.set(true, 1);
    await vi.advanceTimersByTimeAsync(400);
    first().fire("timeupdate", 42);
    made.set(false, 0);
    first().fire("error");
    expect(first().src).toBe("");
    await vi.advanceTimersByTimeAsync(400);
    first().fire("timeupdate", 95);
    await vi.advanceTimersByTimeAsync(400);
    expect(second()).toMatchObject({ playing: false, src: "" });
    made.set(true, 1);
    first().fire("loadedmetadata");
    expect(first().currentTime).toBe(42);
    made.set(false, 0);
    first().fire("ended");
    expect(first().src).toBe("");
    made.set(true, 1);
    expect(first()).toMatchObject({ playing: true, src: "b.ogg" });
  });

  it("starts the next track at its moment, on the other element", async () => {
    const { first, made, second } = player();
    made.set(true, 0.5);
    first().fire("timeupdate", 30);
    expect(second().src).toBe("");
    first().fire("timeupdate", 61);
    expect(second()).toMatchObject({ playing: false, src: "b.ogg" });
    first().fire("timeupdate", 89.8);
    first().fire("timeupdate", 89.9);
    expect(second().playing).toBe(false);
    await vi.advanceTimersByTimeAsync(250);
    expect(second().playing).toBe(true);
    first().fire("timeupdate", 95);
    first().fire("ended");
    expect(first().src).toBe("");
    second().fire("timeupdate", 65);
    expect(first().src).toBe("a.ogg");
  });

  it("reuses the first element when the second is refused", async () => {
    const { first, made, second } = player();
    made.set(true, 0.5);
    second().refuse = true;
    first().fire("timeupdate", 95);
    await vi.advanceTimersByTimeAsync(10);
    first().fire("ended");
    expect(first()).toMatchObject({ playing: true, src: "b.ogg" });
  });

  it("retries a failed file once, then is silent", () => {
    const { first, made, second } = player();
    made.set(true, 0.5);
    first().fire("timeupdate", 61);
    second().fire("error");
    expect(second().src).toBe("");
    first().fire("error");
    expect(first()).toMatchObject({ playing: true, src: "a.ogg" });
    first().fire("error");
    expect(first()).toMatchObject({ playing: false, src: "" });
  });

  it("is silent where the browser plays neither format, or refuses to start", async () => {
    const silent = player([{ ...track("a"), source: undefined }]);
    silent.made.set(true, 0.5);
    expect(silent.first().playing).toBe(false);
    silent.made.retry();
    const refused = player();
    refused.made.set(false, 0);
    refused.made.set(true, 0.5);
    refused.first().refuse = true;
    refused.made.retry();
    await vi.advanceTimersByTimeAsync(10);
    refused.first().refuse = false;
    refused.made.retry();
    expect(refused.first().playing).toBe(true);
  });

  it("goes down under a ducking sound and comes back", async () => {
    const { first, made } = player();
    made.set(true, 1);
    await vi.advanceTimersByTimeAsync(400);
    made.duck();
    await vi.advanceTimersByTimeAsync(200);
    expect(first().volume).toBeCloseTo(0.398, 2);
    made.duck();
    await vi.advanceTimersByTimeAsync(4000);
    expect(first().volume).toBe(1);
  });
});

it("finds every file it names", () => {
  expect(effectUrl("end-turn")).toContain("end-turn");
  const tracks = musicTracks({ aac: true, opus: true, volume: true });
  expect(tracks).toHaveLength(4);
  for (const { overlapSeconds, seconds, source } of tracks) {
    expect(source?.type).toBe("audio/ogg");
    expect(overlapSeconds).toBeLessThan(seconds);
  }
});
