import type { UnknownAction } from "@reduxjs/toolkit";
import type { Scenario, ScenarioId } from "../engine/types";
import { type AudioState, musicNoticeShown, previewSound, setMuted } from "../state/audioSlice";
import { addNotification } from "../state/notificationSlice";
import { isInGame } from "../state/session";
import { cuesFor, type HeardState } from "./cues";
import { channelGain } from "./levels";
import { decide, type MixerState, type Play, silentMixer, withoutPlay } from "./mixer";
import type { CueId } from "./sounds";

/** Where sound comes out. The browser's is `webAudio.ts`; tests use a fake. Every call may be silent. */
export interface SoundOutput {
  readonly duckMusic: () => void;
  /** False when it could not sound, so the next sound does not wait for it. */
  readonly play: (play: Play) => boolean;
  readonly setEffectsGain: (gain: number) => void;
  /** Music plays, or fades out and stops downloading. */
  readonly setMusic: (on: boolean, gain: number) => void;
  readonly stop: (id: number) => void;
  /** Called inside every click and key press: browsers allow sound only then. */
  readonly unlock: () => void;
}

export interface DirectorState extends HeardState {
  readonly audio: AudioState;
}

export interface DirectorDependencies {
  readonly dispatch: (action: UnknownAction) => void;
  readonly now: () => number;
  readonly output: SoundOutput;
  readonly scenarioOf: (id: ScenarioId) => Scenario;
}

export interface SoundDirector {
  readonly gesture: () => void;
  readonly heard: (before: DirectorState, after: DirectorState, action: UnknownAction) => void;
  readonly setHidden: (hidden: boolean, state: DirectorState) => void;
  /** Brings the output in line with the state, at the start and after a change. */
  readonly sync: (state: DirectorState) => void;
}

/** Music plays during a game, while it can be heard and the tab is in view. */
function musicWanted(state: DirectorState, hidden: boolean): boolean {
  return !hidden && isInGame(state.session) && channelGain(state.audio.levels, "music") > 0;
}

/** Joins the pure decisions (cues, mixer, levels) to an output. */
export function createDirector({ dispatch, now, output, scenarioOf }: DirectorDependencies): SoundDirector {
  let hidden = false;
  let mixer: MixerState = silentMixer;

  const sync = (state: DirectorState): void => {
    output.setEffectsGain(channelGain(state.audio.levels, "effects"));
    output.setMusic(musicWanted(state, hidden), channelGain(state.audio.levels, "music"));
  };

  const sound = (cues: readonly CueId[], state: DirectorState): void => {
    if (cues.length === 0 || hidden || channelGain(state.audio.levels, "effects") === 0) return;
    const before = mixer;
    const decision = decide(before, cues, now());
    for (const id of decision.stops) output.stop(id);
    const dropped = decision.plays.filter((play) => !output.play(play));
    mixer = dropped.reduce((state, play) => withoutPlay(before, state, play), decision.state);
    if (decision.duck && dropped.length < decision.plays.length) output.duckMusic();
  };

  /** Leaving a game ends what it was still saying. */
  const hush = (): void => {
    for (const voice of mixer.voices) output.stop(voice.id);
    mixer = { ...mixer, voices: [] };
  };

  return {
    gesture: () => { output.unlock(); },
    heard: (before, after, action) => {
      const started = musicWanted(after, hidden) && !musicWanted(before, hidden);
      if (before.audio !== after.audio || before.session.phase !== after.session.phase) sync(after);
      if (isInGame(before.session) && !isInGame(after.session)) hush();
      sound(previewSound.match(action) ? ["order"] : cuesFor(scenarioOf, before, after, action), after);
      if (started && !after.audio.noticeSeen) {
        dispatch(musicNoticeShown());
        dispatch(addNotification({
          action: { label: "Mute music", run: setMuted({ channel: "music", muted: true }) },
          message: "Music is on. Turn it down or off in Settings.",
          tone: "info"
        }));
      }
    },
    setHidden: (value, state) => {
      hidden = value;
      if (hidden) hush();
      sync(state);
    },
    sync
  };
}
