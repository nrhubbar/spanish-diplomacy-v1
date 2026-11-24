/** A channel the player can set on its own. */
export const channels = ["master", "music", "effects"] as const;
export type Channel = (typeof channels)[number];

export interface ChannelLevel {
  /** 0 to 100, in steps of `levelStep`. */
  readonly level: number;
  readonly muted: boolean;
}

export type SoundLevels = Readonly<Record<Channel, ChannelLevel>>;

/** What is kept in the browser. */
export interface SoundSettings {
  readonly levels: SoundLevels;
  /** The "music is on" notice has been shown in this browser. */
  readonly noticeSeen: boolean;
}

export const levelStep = 5;
export const storageKey = "spanish-diplomacy.audio.v1";

const defaultLevels: Readonly<Record<Channel, number>> = { effects: 80, master: 80, music: 60 };

export function defaultSettings(saving: boolean): SoundSettings {
  return {
    levels: {
      effects: { level: defaultLevels.effects, muted: false },
      master: { level: defaultLevels.master, muted: false },
      music: { level: defaultLevels.music, muted: saving }
    },
    noticeSeen: false
  };
}

/** The nearest step from 0 to 100. */
export function clampLevel(level: number): number {
  return Math.min(100, Math.max(0, Math.round(level / levelStep) * levelStep));
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function repairChannel(value: unknown, fallback: ChannelLevel): ChannelLevel {
  if (!isRecord(value)) return fallback;
  const { level, muted } = value;
  return {
    level: typeof level === "number" && Number.isFinite(level) ? clampLevel(level) : fallback.level,
    muted: typeof muted === "boolean" ? muted : fallback.muted
  };
}

/** Settings from what the browser kept; anything missing or malformed takes its default. */
export function parseSettings(raw: string | null, saving: boolean): SoundSettings {
  const defaults = defaultSettings(saving);
  if (raw === null) return defaults;
  let saved: unknown;
  try {
    saved = JSON.parse(raw);
  } catch {
    return defaults;
  }
  if (!isRecord(saved)) return defaults;
  const levels = isRecord(saved["levels"]) ? saved["levels"] : {};
  return {
    levels: {
      effects: repairChannel(levels["effects"], defaults.levels.effects),
      master: repairChannel(levels["master"], defaults.levels.master),
      music: repairChannel(levels["music"], defaults.levels.music)
    },
    noticeSeen: saved["noticeSeen"] === true
  };
}

/** A slider's loudness: half way is 12 dB down, so the change is spread over the slider. */
export function sliderGain(level: number): number {
  return (level / 100) ** 2;
}

/** The gain of music or effects after Master and both mutes. */
export function channelGain(levels: SoundLevels, channel: Exclude<Channel, "master">): number {
  const { master } = levels;
  const own = levels[channel];
  return master.muted || own.muted ? 0 : sliderGain(master.level) * sliderGain(own.level);
}

export function dbGain(db: number): number {
  return 10 ** (db / 20);
}
