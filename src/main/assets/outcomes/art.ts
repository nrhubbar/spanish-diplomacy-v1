import type { OutcomeKey } from "../../presentation/outcomes";

/** Digging-in levels a "dug-in" medallion or emblem can show, one pip each. */
export type DugInLevel = 1 | 2 | 3;
import { emblemSources } from "./emblemSources";
import { medallionSources } from "./medallionSources";
import { sanitizeSvg } from "./sanitize";

/**
 * Outcome art by key, as SVG markup ready to inline. Each source is sanitized once, on first
 * use; every call returns a fresh string, so callers may memoize freely.
 *
 * The root carries `x`, `y`, `width`, and `height` matching its centred viewBox, so the same
 * markup sits at the origin of a scaled map `<g>` and has a sensible default size in HTML,
 * where CSS width and height override it. It is decorative (`aria-hidden`): the caller names
 * the outcome in text.
 */

export interface EmblemOptions {
  /** Pips shown on a "dug-in" emblem; ignored for every other key. Defaults to 1. */
  readonly level?: DugInLevel;
}

export interface MedallionOptions {
  /** The ring's fill: the color of the faction the outcome happened to, as `#rrggbb`. */
  readonly ring: string;
  /** Pips shown on a "dug-in" medallion; ignored for every other key. Defaults to 1. */
  readonly level?: DugInLevel;
}

const ringColor = /^#[0-9a-fA-F]{6}$/;

const templates = new Map<string, Element>();

/** Sanitizes a source once and fixes its root attributes; later calls reuse the result. */
function template(kind: string, key: OutcomeKey, source: string): Element {
  const cacheKey = `${kind}:${key}`;
  const cached = templates.get(cacheKey);
  if (cached !== undefined) return cached;
  const root = sanitizeSvg(source);
  const box = (root.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/);
  if (box.length !== 4 || box.some((value) => !Number.isFinite(Number(value)))) {
    throw new Error(`Outcome ${kind} "${key}" needs a viewBox.`);
  }
  ["x", "y", "width", "height"].forEach((name, index) => { root.setAttribute(name, String(box[index])); });
  root.setAttribute("class", `outcome-${kind}`);
  root.setAttribute("data-outcome", key);
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("focusable", "false");
  templates.set(cacheKey, root);
  return root;
}

/** A fresh copy of a template showing only the pips for `level`. */
function instantiate(base: Element, level: DugInLevel): Element {
  const root = base.ownerDocument.importNode(base, true);
  for (const group of root.querySelectorAll("[data-level]")) {
    if (group.getAttribute("data-level") === String(level)) group.removeAttribute("data-level");
    else group.remove();
  }
  return root;
}

/** A map medallion: the faction ring around a body colored by severity, with a white glyph. */
export function outcomeMedallion(key: OutcomeKey, { level = 1, ring }: MedallionOptions): string {
  if (!ringColor.test(ring)) throw new Error(`Medallion ring "${ring}" is not a #rrggbb color.`);
  const root = instantiate(template("medallion", key, medallionSources[key]), level);
  const ringElement = root.querySelector(".outcome-ring");
  if (ringElement === null) throw new Error(`Medallion "${key}" has no ring.`);
  ringElement.setAttribute("fill", ring);
  return new XMLSerializer().serializeToString(root);
}

/**
 * A turn-report emblem: an engraved seal drawn entirely in `currentColor`, so it follows the
 * surrounding text color in light and dark themes. Its band carries the severity as a
 * heraldic hatching, the monochrome counterpart of the medallion's body color.
 */
export function outcomeEmblem(key: OutcomeKey, { level = 1 }: EmblemOptions = {}): string {
  return new XMLSerializer().serializeToString(instantiate(template("emblem", key, emblemSources[key]), level));
}
