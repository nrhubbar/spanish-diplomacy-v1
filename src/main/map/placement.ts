import type { MapPoint } from "../scenarios/loader";

export interface ScreenRect {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

export interface PlacementRequest {
  /** Units sharing an anchor (a city or a territory) are laid out together as one stack. */
  readonly anchor: MapPoint;
  readonly anchorKey: string;
  readonly id: string;
}

export interface CounterMetrics {
  readonly gap: number;
  readonly height: number;
  readonly perRow: number;
  readonly width: number;
}

/**
 * Deterministic collision-aware counter placement in screen space. Stacks sit just below
 * their anchor; a stack that would overlap a placed stack or an obstacle (labels, controls)
 * moves to the nearest free slot: below, beside, further below, then above. Input order
 * decides priority, so results are stable between renders.
 */
export function placeCounters(
  requests: readonly PlacementRequest[],
  metrics: CounterMetrics,
  obstacles: readonly ScreenRect[]
): ReadonlyMap<string, MapPoint> {
  return placeCounterStacks(requests, metrics, obstacles).positions;
}

export interface StackPlacement {
  /** How far, in screen pixels, the most displaced stack moved from its first-choice spot. */
  readonly maxDisplacement: number;
  readonly positions: ReadonlyMap<string, MapPoint>;
}

/** `placeCounters`, also reporting how far crowding pushed stacks from their anchors. */
export function placeCounterStacks(
  requests: readonly PlacementRequest[],
  metrics: CounterMetrics,
  obstacles: readonly ScreenRect[]
): StackPlacement {
  const stacks = new Map<string, { anchor: MapPoint; ids: string[] }>();
  for (const request of requests) {
    const stack = stacks.get(request.anchorKey) ?? { anchor: request.anchor, ids: [] };
    stack.ids.push(request.id);
    stacks.set(request.anchorKey, stack);
  }

  const placed: ScreenRect[] = [];
  const positions = new Map<string, MapPoint>();
  let maxDisplacement = 0;
  const step = metrics.height / 2 + metrics.gap;

  for (const { anchor, ids } of stacks.values()) {
    const columns = Math.min(metrics.perRow, ids.length);
    const rows = Math.ceil(ids.length / metrics.perRow);
    const width = columns * metrics.width + (columns - 1) * metrics.gap;
    const height = rows * metrics.height + (rows - 1) * metrics.gap;
    const base: ScreenRect = { height, width, x: anchor.x - width / 2, y: anchor.y + metrics.gap + 3 };

    const blocked = (rect: ScreenRect): boolean =>
      placed.some((other) => intersects(rect, other)) || obstacles.some((other) => intersects(rect, other));
    // Prefer staying close to the anchor: below, beside, further below, and above only as a
    // last resort (anchors sit near coasts, where "above" is often the sea).
    const side = width / 2 + metrics.gap + 4;
    const candidates = [
      { dx: 0, dy: 0 }, { dx: 0, dy: step }, { dx: side, dy: -step }, { dx: -side, dy: -step },
      { dx: side, dy: step }, { dx: -side, dy: step }, { dx: 0, dy: 2 * step }, { dx: 0, dy: 3 * step },
      { dx: 0, dy: 4 * step }, { dx: 0, dy: -2 * step - height },
      // Crowded fronts: further out to each side, then diagonally.
      ...[2, 3].flatMap((reach) => [-1, 0, 1, 2, 3].flatMap((rowsDown) => [
        { dx: reach * side, dy: rowsDown * step },
        { dx: -reach * side, dy: rowsDown * step }
      ]))
    ];
    const at = (candidate: { dx: number; dy: number }): ScreenRect => ({ ...base, x: base.x + candidate.dx, y: base.y + candidate.dy });
    // With no free slot, take the one that covers the least of its neighbours.
    const offset = candidates.find((candidate) => !blocked(at(candidate)))
      ?? candidates.reduce((best, candidate) => (overlap(at(candidate), [...placed, ...obstacles]) < overlap(at(best), [...placed, ...obstacles]) ? candidate : best));
    const box = { ...base, x: base.x + offset.dx, y: base.y + offset.dy };
    placed.push(box);
    maxDisplacement = Math.max(maxDisplacement, Math.hypot(offset.dx, offset.dy));

    ids.forEach((id, index) => {
      const column = index % metrics.perRow;
      const row = Math.floor(index / metrics.perRow);
      const rowCount = Math.min(metrics.perRow, ids.length - row * metrics.perRow);
      const rowWidth = rowCount * metrics.width + (rowCount - 1) * metrics.gap;
      positions.set(id, {
        x: box.x + (width - rowWidth) / 2 + column * (metrics.width + metrics.gap),
        y: box.y + row * (metrics.height + metrics.gap)
      });
    });
  }
  return { maxDisplacement, positions };
}

/** Total area of `rect` covered by the others. */
function overlap(rect: ScreenRect, others: readonly ScreenRect[]): number {
  return others.reduce((sum, other) => {
    const width = Math.min(rect.x + rect.width, other.x + other.width) - Math.max(rect.x, other.x);
    const height = Math.min(rect.y + rect.height, other.y + other.height) - Math.max(rect.y, other.y);
    return sum + Math.max(0, width) * Math.max(0, height);
  }, 0);
}

export function intersects(a: ScreenRect, b: ScreenRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Neutral geography labels ("Portugal"), in screen pixels. */
export const contextLabelType = { fontSize: 13, letterSpacing: 2.5 } as const;

/** Context labels are uppercase serif; this over-estimates their width so a fit is never optimistic. */
const contextGlyphEm = 0.78;

export interface ScreenSize {
  readonly height: number;
  readonly width: number;
}

/**
 * Whether a label's footprint lies wholly on screen and touches no counter. Labels that name
 * scenery (neighbouring land, water) are hidden instead of cut or covered; panning or zooming
 * brings them back. Everything is in screen pixels.
 */
export function clearOnScreen(footprint: readonly ScreenRect[], viewport: ScreenSize, counters: readonly ScreenRect[]): boolean {
  return footprint.every((rect) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= viewport.width && rect.y + rect.height <= viewport.height
    && !counters.some((counter) => intersects(rect, counter)));
}

/** The neutral context labels to draw: those that fit entirely on screen and touch no counter. */
export function visibleContextLabels<Label extends MapPoint & { readonly text: string }>(
  labels: readonly Label[],
  toScreen: (point: MapPoint) => MapPoint,
  viewport: ScreenSize,
  counters: readonly ScreenRect[]
): readonly Label[] {
  return labels.filter((label) => {
    const at = toScreen(label);
    const width = label.text.length * (contextLabelType.fontSize * contextGlyphEm + contextLabelType.letterSpacing);
    return clearOnScreen([{ height: contextLabelType.fontSize, width, x: at.x - width / 2, y: at.y - contextLabelType.fontSize }], viewport, counters);
  });
}
