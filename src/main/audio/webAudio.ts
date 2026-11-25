import type { SoundOutput } from "./director";
import { effectUrl, musicTracks } from "./files";
import { dbGain } from "../state/soundLevels";
import { createMusicPlayer } from "./musicPlayer";
import type { MusicSupport } from "./playlist";
import { type EffectFile, sounds } from "./sounds";

const fadeInSeconds = 0.006;
const fadeOutSeconds = 0.06;

/** Found by trying, never by the browser's name. */
export function musicSupport(): MusicSupport {
  const probe = document.createElement("audio");
  probe.volume = 0.5;
  return {
    aac: probe.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "",
    opus: probe.canPlayType('audio/ogg; codecs="opus"') !== "",
    volume: probe.volume === 0.5
  };
}

interface Graph {
  readonly context: AudioContext;
  readonly effects: GainNode;
}

/** Effects go through one gain and then a limiter, the last thing before the speakers. */
function openGraph(effectsGain: number): Graph | undefined {
  try {
    // Plays with the phone's silent switch, and beside other audio, where the browser allows it.
    const session = (navigator as { readonly audioSession?: { type: string } }).audioSession;
    if (session !== undefined) session.type = "ambient";
    const context = new AudioContext();
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.ratio.value = 20;
    limiter.knee.value = 0;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;
    const effects = context.createGain();
    effects.gain.value = effectsGain;
    effects.connect(limiter).connect(context.destination);
    return { context, effects };
  } catch {
    // No Web Audio, or the browser refuses a context: the game is silent.
    return undefined;
  }
}

/** The browser's sound: effects decoded into memory, music streamed by `<audio>`. */
export function createWebAudioOutput(): SoundOutput {
  const support = musicSupport();
  const buffers = new Map<EffectFile, AudioBuffer>();
  /** Asked for and not here yet. A file that fails leaves, so a later gesture asks again. */
  const loading = new Set<EffectFile>();
  const voices = new Map<number, { readonly gain: GainNode; readonly sources: readonly AudioBufferSourceNode[] }>();
  const musicGains = new Map<HTMLAudioElement, GainNode>();
  let graph: Graph | undefined;
  let effectsGain = 0;

  /** Where a script cannot set an element's volume (iPhone), it goes through a gain node. */
  const setVolume = (element: HTMLAudioElement, gain: number): void => {
    if (support.volume) {
      element.volume = Math.min(1, Math.max(0, gain));
      return;
    }
    if (graph === undefined) return;
    const { context } = graph;
    let node = musicGains.get(element);
    if (node === undefined) {
      node = context.createGain();
      context.createMediaElementSource(element).connect(node).connect(context.destination);
      musicGains.set(element, node);
    }
    node.gain.setTargetAtTime(gain, context.currentTime, 0.01);
  };

  const player = createMusicPlayer({
    clearTimer: (timer) => { window.clearTimeout(timer); },
    createElement: () => {
      const element = document.createElement("audio");
      element.preload = "none";
      return element;
    },
    roll: Math.random(),
    setTimer: (run, ms) => window.setTimeout(run, ms),
    setVolume,
    tracks: musicTracks(support)
  });

  const load = (to: AudioContext): void => {
    if (effectsGain === 0) return;
    for (const file of new Set(Object.values(sounds).map((sound) => sound.file))) {
      const url = effectUrl(file);
      if (url === undefined || buffers.has(file) || loading.has(file)) continue;
      loading.add(file);
      fetch(url)
        .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(response.statusText))))
        .then((bytes) => to.decodeAudioData(bytes))
        .then((buffer) => { buffers.set(file, buffer); })
        .catch(() => undefined)
        .finally(() => { loading.delete(file); });
    }
  };

  return {
    duckMusic: () => { player.duck(); },
    play: ({ cue, delaysMs, gainDb, id }) => {
      const buffer = buffers.get(sounds[cue].file);
      // Not running, or not loaded yet: dropped, because a late sound feels broken.
      if (graph?.context.state !== "running" || buffer === undefined) return false;
      const { context, effects } = graph;
      const gain = context.createGain();
      gain.connect(effects);
      // A little of both, so a repeated sound never sounds like a machine.
      const rate = 0.97 + Math.random() * 0.06;
      const level = dbGain(gainDb + Math.random() * 2 - 1);
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + fadeInSeconds);
      const sources = delaysMs.map((delay) => {
        const source = new AudioBufferSourceNode(context, { buffer, playbackRate: rate });
        source.connect(gain);
        source.start(now + delay / 1000);
        return source;
      });
      voices.set(id, { gain, sources });
      const last = sources[sources.length - 1];
      last?.addEventListener("ended", () => {
        voices.delete(id);
        gain.disconnect();
      });
      return true;
    },
    setEffectsGain: (gain) => {
      effectsGain = gain;
      if (graph === undefined) return;
      graph.effects.gain.setTargetAtTime(gain, graph.context.currentTime, 0.015);
      if (graph.context.state === "running") load(graph.context);
    },
    setMusic: (on, gain) => { player.set(on, gain); },
    stop: (id) => {
      const voice = voices.get(id);
      if (voice === undefined) return;
      const now = voice.gain.context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + fadeOutSeconds);
      for (const source of voice.sources) source.stop(now + fadeOutSeconds);
    },
    unlock: () => {
      graph ??= openGraph(effectsGain);
      if (graph !== undefined) {
        if (graph.context.state !== "running") graph.context.resume().catch(() => undefined);
        load(graph.context);
      }
      player.retry();
    }
  };
}
