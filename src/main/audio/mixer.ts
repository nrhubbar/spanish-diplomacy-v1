import { type CueId, joinMs, type Sound, type SoundGroup, sounds, voiceLimits } from "./sounds";

export interface Voice {
  readonly cue: CueId;
  /** When it frees its voice. */
  readonly endsAt: number;
  readonly id: number;
  readonly startsAt: number;
}

export interface MixerState {
  readonly lastStart: Readonly<Partial<Record<CueId, number>>>;
  readonly nextId: number;
  readonly voices: readonly Voice[];
}

export interface Play {
  readonly cue: CueId;
  /** Starts of the file, in milliseconds from now. */
  readonly delaysMs: readonly number[];
  readonly gainDb: number;
  readonly id: number;
}

export interface Decision {
  readonly duck: boolean;
  readonly plays: readonly Play[];
  readonly state: MixerState;
  /** Voices to fade out, replaced by a higher rank. */
  readonly stops: readonly number[];
}

export const silentMixer: MixerState = { lastStart: {}, nextId: 1, voices: [] };

const inGroup = (voices: readonly Voice[], group: SoundGroup): readonly Voice[] => voices.filter((voice) => sounds[voice.cue].group === group);

/** The same sound just started: one press, or a burst, is one sound. */
function justStarted(state: MixerState, cue: CueId, now: number, withinMs: number): boolean {
  const last = state.lastStart[cue];
  return last !== undefined && now - last < withinMs;
}

/** What a cue plays now: itself, the plain tick while it cools down, or nothing. */
function choose(state: MixerState, cue: CueId, now: number): CueId | undefined {
  const sound = sounds[cue];
  if (justStarted(state, cue, now, joinMs)) return undefined;
  if (!justStarted(state, cue, now, sound.cooldownMs)) return cue;
  return sound.group === "action" ? choose(state, "order", now) : undefined;
}

/**
 * Which cues sound now, against what is already sounding (audio rules 1 to 3). A full group gives
 * up its lowest-ranked voice to a higher rank; anything else is dropped, never queued. A battle
 * heard in the same moment as End turn starts as End turn fades: it is one sequence, not a queue.
 */
export function decide(before: MixerState, cues: readonly CueId[], now: number): Decision {
  let state: MixerState = { ...before, voices: before.voices.filter((voice) => voice.endsAt > now) };
  const plays: Play[] = [];
  const stops: number[] = [];
  let duck = false;
  for (const wanted of cues) {
    const cue = choose(state, wanted, now);
    if (cue === undefined) continue;
    const sound: Sound = sounds[cue];
    const prelude = plays.find((play) => play.cue === "end-turn");
    const startsAt = cue === "battle" && prelude !== undefined ? now + sounds["end-turn"].holdMs : now;
    const group = inGroup(state.voices.filter((voice) => voice.endsAt > startsAt), sound.group);
    let voices = state.voices;
    if (group.length >= voiceLimits[sound.group]) {
      const weakest = group.reduce((low, voice) => (sounds[voice.cue].rank < sounds[low.cue].rank ? voice : low));
      if (sounds[weakest.cue].rank >= sound.rank) continue;
      stops.push(weakest.id);
      voices = voices.filter((voice) => voice.id !== weakest.id);
    }
    const id = state.nextId;
    plays.push({ cue, delaysMs: (sound.starts ?? [0]).map((start) => startsAt - now + start), gainDb: sound.gainDb, id });
    duck ||= sound.duck === true;
    state = {
      lastStart: { ...state.lastStart, [cue]: startsAt },
      nextId: id + 1,
      voices: [...voices, { cue, endsAt: startsAt + sound.holdMs, id, startsAt }]
    };
  }
  return { duck, plays, state, stops };
}

/** After a play that could not sound: it holds no voice and starts no cooldown. */
export function withoutPlay(before: MixerState, after: MixerState, { cue, id }: Play): MixerState {
  return {
    ...after,
    lastStart: { ...after.lastStart, [cue]: before.lastStart[cue] },
    voices: after.voices.filter((voice) => voice.id !== id)
  };
}
