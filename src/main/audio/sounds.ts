/** Every sound the game can make. The table below is the whole of what players hear as effects. */
export type CueId =
  | "air"
  | "battle"
  | "build"
  | "cancel"
  | "end-turn"
  | "march"
  | "order"
  | "rail"
  | "recruit"
  | "refused"
  | "time-warning"
  | "truck";

export type EffectFile = "air-a" | "battle-a" | "blocked-a" | "build-a" | "end-turn" | "march-a" | "order-a" | "rail-a" | "recruit-a" | "truck-a";

/** Sounds share voices by group: one tick, two action sounds and one event at once. */
export type SoundGroup = "action" | "event" | "tick";

export interface Sound {
  /** No second start within this time. Action sounds play the plain order tick instead. */
  readonly cooldownMs: number;
  /** Lowers the music while it plays. */
  readonly duck?: true;
  readonly file: EffectFile;
  /** Level before the player's sliders. */
  readonly gainDb: number;
  readonly group: SoundGroup;
  /** How long it holds its voice: its length, less a long baked fade. */
  readonly holdMs: number;
  /** A higher rank takes the voice of a lower one; equals never do. */
  readonly rank: number;
  /** Starts of the file, in milliseconds from the cue; one start at 0 when absent. */
  readonly starts?: readonly number[];
}

export const sounds: Readonly<Record<CueId, Sound>> = {
  "end-turn": { cooldownMs: 2000, duck: true, file: "end-turn", gainDb: -6, group: "event", holdMs: 1400, rank: 5 },
  "time-warning": { cooldownMs: 2000, file: "order-a", gainDb: -10, group: "event", holdMs: 1150, rank: 5, starts: [0, 600] },
  battle: { cooldownMs: 2000, duck: true, file: "battle-a", gainDb: -10, group: "event", holdMs: 1600, rank: 4 },
  rail: { cooldownMs: 4000, file: "rail-a", gainDb: -12, group: "action", holdMs: 2700, rank: 3 },
  air: { cooldownMs: 4000, file: "air-a", gainDb: -9, group: "action", holdMs: 2400, rank: 3 },
  truck: { cooldownMs: 4000, file: "truck-a", gainDb: -10, group: "action", holdMs: 2200, rank: 3 },
  march: { cooldownMs: 4000, file: "march-a", gainDb: -6, group: "action", holdMs: 2000, rank: 3 },
  build: { cooldownMs: 1200, file: "build-a", gainDb: -10, group: "action", holdMs: 1150, rank: 2 },
  recruit: { cooldownMs: 1200, file: "recruit-a", gainDb: -10, group: "action", holdMs: 950, rank: 2 },
  order: { cooldownMs: 150, file: "order-a", gainDb: -14, group: "tick", holdMs: 550, rank: 1 },
  cancel: { cooldownMs: 150, file: "order-a", gainDb: -18, group: "tick", holdMs: 550, rank: 1 },
  refused: { cooldownMs: 300, file: "blocked-a", gainDb: -16, group: "tick", holdMs: 150, rank: 1 }
};

export const voiceLimits: Readonly<Record<SoundGroup, number>> = { action: 2, event: 1, tick: 1 };

/** Two triggers of one sound this close together are one. */
export const joinMs = 120;

/** Music under a ducking sound: how far down, how fast, and how slowly it returns. */
export const ducking = { attackMs: 60, gainDb: -8, holdMs: 1400, releaseMs: 1500 } as const;
