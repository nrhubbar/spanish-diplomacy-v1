import { firstTrack, joinStep, type MusicSource, nextTrack, type Track } from "./playlist";
import { ducking } from "./sounds";
import { dbGain } from "./levels";

/** What the player uses of an `<audio>` element. */
export interface MusicElement {
  addEventListener(type: "ended" | "error" | "loadedmetadata" | "timeupdate", listener: () => void): void;
  currentTime: number;
  load(): void;
  pause(): void;
  play(): Promise<void>;
  preload: string;
  removeAttribute(name: "src"): void;
  src: string;
}

export interface MusicTrack extends Track {
  /** The file this browser plays; undefined when it plays neither format. */
  readonly source: MusicSource | undefined;
}

export interface MusicPlayerDependencies<E extends MusicElement> {
  readonly clearTimer: (timer: number) => void;
  readonly createElement: () => E;
  /** 0 up to 1, for the session's first track. */
  readonly roll: number;
  readonly setTimer: (run: () => void, ms: number) => number;
  readonly setVolume: (element: E, gain: number) => void;
  readonly tracks: readonly MusicTrack[];
}

export interface MusicPlayer {
  readonly duck: () => void;
  /** Inside a gesture: starts music the browser refused to start before. */
  readonly retry: () => void;
  readonly set: (on: boolean, gain: number) => void;
}

interface Deck<E> {
  readonly element: E;
  failures: number;
  seekTo: number;
  track: number | undefined;
}

const fadeMs = 300;
const stepMs = 30;

/**
 * Streams the music through two elements in turn. The joins are in the files, so a track only has
 * to start at its moment in the one before; nothing is crossfaded here. Off means no element has
 * a source, so nothing downloads. A refused or failed play is silent.
 */
export function createMusicPlayer<E extends MusicElement>({ clearTimer, createElement, roll, setTimer, setVolume, tracks }: MusicPlayerDependencies<E>): MusicPlayer {
  let on = false;
  let gain = 0;
  let level = 0;
  let duckGain = 1;
  let track = firstTrack(tracks.length, roll);
  let position = 0;
  let current: Deck<E> | undefined;
  let decks: readonly Deck<E>[] = [];
  let ramp: number | undefined;
  let unduck: number | undefined;
  let join: number | undefined;

  const apply = (): void => { for (const deck of decks) setVolume(deck.element, level); };

  /** Moves the level to `target` in short steps, so no change clicks. */
  const rampTo = (target: number, ms: number, then?: () => void): void => {
    if (ramp !== undefined) clearTimer(ramp);
    const from = level;
    const steps = Math.max(1, Math.round(ms / stepMs));
    const step = (count: number): void => {
      level = from + ((target - from) * count) / steps;
      apply();
      ramp = undefined;
      if (count < steps) ramp = setTimer(() => { step(count + 1); }, stepMs);
      else then?.();
    };
    ramp = setTimer(() => { step(1); }, stepMs);
  };
  const wanted = (): number => (on ? gain * duckGain : 0);

  const cue = (deck: Deck<E>, index: number, at: number): boolean => {
    const source = tracks[index]?.source;
    if (source === undefined) return false;
    deck.seekTo = at;
    deck.track = index;
    deck.element.preload = "auto";
    deck.element.src = source.url;
    setVolume(deck.element, level);
    return true;
  };

  const release = (deck: Deck<E>): void => {
    deck.track = undefined;
    deck.element.pause();
    deck.element.removeAttribute("src");
    deck.element.load();
  };

  const cancelJoin = (): void => {
    if (join !== undefined) clearTimer(join);
    join = undefined;
  };

  const play = (deck: Deck<E>): void => { deck.element.play().catch(() => undefined); };

  const other = (deck: Deck<E>): Deck<E> | undefined => decks.find((each) => each !== deck);

  /** Takes the next track from the deck it was prepared on; refused, it waits for this one's end. */
  const startNext = (from: Deck<E>): void => {
    join = undefined;
    const deck = other(from);
    const index = nextTrack(track, tracks.length);
    if (deck === undefined || (deck.track !== index && !cue(deck, index, 0))) return;
    deck.element.play().then(() => {
      if (current !== from) return;
      current = deck;
      track = index;
      position = 0;
    }).catch(() => undefined);
  };

  const moved = (deck: Deck<E>): void => {
    const playing = tracks[track];
    // A parked deck can still report a position, and its own would be 0.
    if (!on || deck !== current || playing === undefined) return;
    position = deck.element.currentTime;
    const step = joinStep(playing, position);
    if (step.kind === "play") return;
    const index = nextTrack(track, tracks.length);
    const spare = other(deck);
    if (spare !== undefined && spare.track !== index && spare.failures === 0) cue(spare, index, 0);
    if (step.kind === "start" && join === undefined) join = setTimer(() => { startNext(deck); }, step.inMs);
  };

  const ended = (deck: Deck<E>): void => {
    if (deck !== current) {
      release(deck);
      return;
    }
    cancelJoin();
    track = nextTrack(track, tracks.length);
    position = 0;
    if (!on) release(deck);
    else if (cue(deck, track, 0)) play(deck);
  };

  const failed = (deck: Deck<E>): void => {
    if (deck.track === undefined) return;
    deck.failures += 1;
    if (on && deck === current && deck.failures === 1 && cue(deck, track, position)) play(deck);
    else release(deck);
  };

  const build = (): readonly Deck<E>[] => [0, 1].map(() => {
    const deck: Deck<E> = { element: createElement(), failures: 0, seekTo: 0, track: undefined };
    deck.element.addEventListener("timeupdate", () => { moved(deck); });
    deck.element.addEventListener("ended", () => { ended(deck); });
    deck.element.addEventListener("error", () => { failed(deck); });
    deck.element.addEventListener("loadedmetadata", () => {
      if (deck.seekTo > 0) deck.element.currentTime = deck.seekTo;
      deck.seekTo = 0;
    });
    return deck;
  });

  const start = (): void => {
    if (decks.length === 0) decks = build();
    current ??= decks[0];
    if (current === undefined) return;
    if (current.track === undefined && !cue(current, track, position)) return;
    play(current);
    rampTo(wanted(), fadeMs);
  };

  const park = (): void => {
    cancelJoin();
    // A duck still to come back would take over the fade, and the decks would never be released.
    if (unduck !== undefined) clearTimer(unduck);
    unduck = undefined;
    duckGain = 1;
    rampTo(0, fadeMs, () => {
      for (const deck of decks) {
        deck.failures = 0;
        release(deck);
      }
    });
  };

  return {
    duck: () => {
      if (!on) return;
      duckGain = dbGain(ducking.gainDb);
      rampTo(wanted(), ducking.attackMs);
      if (unduck !== undefined) clearTimer(unduck);
      unduck = setTimer(() => {
        duckGain = 1;
        rampTo(wanted(), ducking.releaseMs);
      }, ducking.holdMs);
    },
    retry: () => { if (on && current?.track !== undefined) play(current); },
    set: (nextOn, nextGain) => {
      const changed = nextOn !== on;
      const gainChanged = nextGain !== gain;
      on = nextOn;
      gain = nextGain;
      if (changed) {
        if (on) start();
        else park();
      } else if (on && gainChanged) rampTo(wanted(), fadeMs / 3);
    }
  };
}
