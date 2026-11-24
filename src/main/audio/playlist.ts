/** One music file pair; its fades are in the file. */
export interface Track {
  readonly id: string;
  /** How long before this track ends the next one starts. */
  readonly overlapSeconds: number;
  readonly seconds: number;
  readonly title: string;
}

export interface MusicSource {
  readonly type: "audio/mp4" | "audio/ogg";
  readonly url: string;
}

/** What the browser can do, found by trying it, never by its name. */
export interface MusicSupport {
  /** It plays AAC in MP4. */
  readonly aac: boolean;
  /** It plays Opus in Ogg. */
  readonly opus: boolean;
  /** A script can set an element's volume (not on iPhone and iPad). */
  readonly volume: boolean;
}

/** Seconds before the next track starts when its download begins. */
const prepareSeconds = 30;

/** Which of a track's files to play; undefined when the browser plays neither. */
export function chooseSource(support: MusicSupport, sources: readonly MusicSource[]): MusicSource | undefined {
  // Where volume needs a gain node, Opus does not obey it in some Safari releases; AAC does.
  const allowed = sources.filter(({ type }) => (type === "audio/mp4" ? support.aac : support.opus && support.volume));
  return allowed.find(({ type }) => type === "audio/ogg") ?? allowed[0];
}

/** The mix's order, round and round. */
export function nextTrack(index: number, count: number): number {
  return (index + 1) % count;
}

/** A session's first track: `roll` is 0 up to 1. */
export function firstTrack(count: number, roll: number): number {
  return Math.min(count - 1, Math.floor(roll * count));
}

export type JoinStep =
  | { readonly kind: "play" }
  | { readonly kind: "prepare" }
  | { readonly kind: "start"; readonly inMs: number };

/** What a track's position asks for: nothing yet, fetch the next one, or start it (very soon). */
export function joinStep(track: Track, position: number): JoinStep {
  const left = track.seconds - track.overlapSeconds - position;
  // `timeupdate` comes about four times a second, so the last part is timed.
  if (left <= 0.5) return { inMs: Math.max(0, Math.round(left * 1000)), kind: "start" };
  return left <= prepareSeconds ? { kind: "prepare" } : { kind: "play" };
}
