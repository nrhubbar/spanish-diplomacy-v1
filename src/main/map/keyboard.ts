export type PanDirection = "down" | "left" | "right" | "up";

export type MapKeyIntent =
  | { readonly direction: PanDirection; readonly kind: "pan" }
  | { readonly kind: "reset" }
  | { readonly kind: "select" }
  | { readonly kind: "zoom-in" }
  | { readonly kind: "zoom-out" };

/** How far a quick tap of a pan key moves the map, in screen pixels (K1). */
export const panStepPixels = 60;

export function mapKeyIntent(key: string): MapKeyIntent | undefined {
  switch (key) {
    case "Enter":
    case " ":
      return { kind: "select" };
    case "a":
    case "A":
    case "ArrowLeft":
      return { direction: "left", kind: "pan" };
    case "d":
    case "D":
    case "ArrowRight":
      return { direction: "right", kind: "pan" };
    case "w":
    case "W":
    case "ArrowUp":
      return { direction: "up", kind: "pan" };
    case "s":
    case "S":
    case "ArrowDown":
      return { direction: "down", kind: "pan" };
    case "+":
    case "=":
      return { kind: "zoom-in" };
    case "-":
    case "_":
      return { kind: "zoom-out" };
    case "0":
    case "Home":
      return { kind: "reset" };
    default:
      return undefined;
  }
}

/**
 * Smooth keyboard panning (K1). The view moves at `cruiseSpeed` screen pixels per second
 * after a linear ease-in of `easeMs`; a frame never integrates more than `maxFrameMs`, so a
 * late frame cannot jump.
 */
export const panMotion = { cruiseSpeed: 800, easeMs: 120, maxFrameMs: 50 } as const;

/**
 * The camera delta (as `panCamera` takes it) for one pixel of travel in each direction: the
 * view moves that way, so the map moves the other way.
 */
const panVectors: Readonly<Record<PanDirection, { readonly x: number; readonly y: number }>> = {
  down: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
  right: { x: -1, y: 0 },
  up: { x: 0, y: 1 }
};

export interface PanKey {
  readonly direction: PanDirection;
  readonly held: boolean;
  /** Pixels this key still owes along its direction, so a tap glides a full step. */
  readonly owed: number;
}

export interface PanState {
  /** Milliseconds since the motion started, for the ease-in. */
  readonly elapsed: number;
  /** Held keys, and released ones still gliding out their tap, by physical key code. */
  readonly keys: ReadonlyMap<string, PanKey>;
}

export interface PanStep {
  readonly deltaX: number;
  readonly deltaY: number;
  readonly state: PanState;
}

export const idlePan: PanState = { elapsed: 0, keys: new Map() };

export function isPanning(state: PanState): boolean {
  return state.keys.size > 0;
}

/**
 * A key goes down. Auto-repeat must not reach here (the caller drops `event.repeat`). Pressing
 * a key that is still gliding adds another step, so quick taps add up.
 */
export function panKeyDown(state: PanState, code: string, direction: PanDirection): PanState {
  const current = state.keys.get(code);
  if (current?.held === true) return state;
  const keys = new Map(state.keys);
  keys.set(code, { direction, held: true, owed: (current?.owed ?? 0) + panStepPixels });
  return { elapsed: isPanning(state) ? state.elapsed : 0, keys };
}

/** A key comes up: motion that way stops, once a tap has glided its step. */
export function panKeyUp(state: PanState, code: string): PanState {
  const current = state.keys.get(code);
  if (current === undefined) return state;
  const keys = new Map(state.keys);
  if (current.owed > 0) keys.set(code, { ...current, held: false });
  else keys.delete(code);
  return keys.size === 0 ? idlePan : { ...state, keys };
}

/** Pixels travelled at full speed `cruiseSpeed`, from `from` to `to` ms into the motion. */
export function easedDistance(from: number, to: number): number {
  const { cruiseSpeed, easeMs } = panMotion;
  // The integral of speed(t) = cruiseSpeed * min(1, t / easeMs), in pixels per millisecond.
  const ramp = (t: number): number => (t <= easeMs ? (t * t) / (2 * easeMs) : t - easeMs / 2);
  return (cruiseSpeed / 1000) * (ramp(to) - ramp(from));
}

/**
 * Advances the motion by one frame. Held directions add up and are normalised, so a diagonal
 * moves at the same speed as a straight pan; opposite keys cancel. With no key held, the
 * frame stops exactly where the last tap's step ends.
 */
export function advancePan(state: PanState, frameMs: number): PanStep {
  const unique = new Set([...state.keys.values()].map((key) => key.direction));
  const sum = [...unique].reduce((total, direction) => ({ x: total.x + panVectors[direction].x, y: total.y + panVectors[direction].y }), { x: 0, y: 0 });
  const length = Math.hypot(sum.x, sum.y);
  const along = (key: PanKey): number => (length === 0 ? 0 : (panVectors[key.direction].x * sum.x + panVectors[key.direction].y * sum.y) / length);
  // A released key that no longer moves the view (cancelled by its opposite) has nothing left to glide.
  const live = [...state.keys].filter(([, key]) => key.held || along(key) > 0);
  if (length === 0) return { deltaX: 0, deltaY: 0, state: live.length === 0 ? idlePan : { elapsed: 0, keys: new Map(live) } };
  const dt = Math.min(Math.max(frameMs, 0), panMotion.maxFrameMs);
  let distance = easedDistance(state.elapsed, state.elapsed + dt);
  if (live.every(([, key]) => !key.held)) {
    distance = Math.min(distance, ...live.map(([, key]) => key.owed / along(key)));
  }
  const keys = new Map<string, PanKey>();
  for (const [code, key] of live) {
    const owed = Math.max(0, key.owed - distance * along(key));
    if (key.held || owed > 1e-6) keys.set(code, { ...key, owed });
  }
  return {
    deltaX: (distance * sum.x) / length,
    deltaY: (distance * sum.y) / length,
    state: keys.size === 0 ? idlePan : { elapsed: state.elapsed + dt, keys }
  };
}

export type KeyTarget = "editable" | "native-control" | "map";

/**
 * B3: native buttons and form controls keep their own Enter/Space activation, and editable
 * fields keep every key. Only map surfaces (the map itself and SVG territories) get "select".
 */
export function shouldHandleMapKey(intent: MapKeyIntent, target: KeyTarget): boolean {
  if (target === "editable") return false;
  if (target === "native-control") return intent.kind !== "select";
  return true;
}

export function classifyKeyTarget(target: EventTarget | null): KeyTarget {
  if (!(target instanceof Element)) return "map";
  if (target.closest("input, textarea, select, [contenteditable='true']") !== null) return "editable";
  if (target.closest("button, a[href], summary") !== null) return "native-control";
  return "map";
}
