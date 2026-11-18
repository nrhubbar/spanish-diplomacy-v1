import type { TerritoryId } from "../engine/types";
import type { MapPackage } from "../scenarios/loader";

const svgNamespace = "http://www.w3.org/2000/svg";

/**
 * Parses a map package's geometry once (B14) and returns the inner markup for the vector
 * layer. Bound regions become focusable territory buttons; everything else is inert context.
 * Selection and control styling is applied later through generated CSS, never by reparsing.
 */
export interface PreparedGeometry {
  readonly markup: string;
  /** Unstyled copies of each territory's region elements, used for highlight outlines. */
  readonly outlines: ReadonlyMap<TerritoryId, string>;
}

export function prepareGeometry(
  svgSource: string,
  map: MapPackage,
  territoryName: (id: TerritoryId) => string
): PreparedGeometry {
  const document = new DOMParser().parseFromString(svgSource, "image/svg+xml");
  for (const selector of [...map.stripSelectors, "script", "foreignObject", "style"]) {
    document.querySelectorAll(selector).forEach((element) => { element.remove(); });
  }
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
    }
  }
  const serializer = new XMLSerializer();
  const outlines = new Map<TerritoryId, string>();
  for (const [regionId, territoryId] of map.regions) {
    const element = document.getElementById(regionId);
    if (element === null) continue;
    const outline = document.importNode(element, true);
    outline.removeAttribute("id");
    outline.removeAttribute("class");
    outline.removeAttribute("style");
    outline.querySelectorAll("[id]").forEach((child) => { child.removeAttribute("id"); });
    outlines.set(territoryId, (outlines.get(territoryId) ?? "") + serializer.serializeToString(outline));
    const name = territoryName(territoryId);
    element.setAttribute("class", "map-region");
    element.setAttribute("data-territory-id", territoryId);
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", name);
    const title = document.createElementNS(svgNamespace, "title");
    title.textContent = name;
    element.prepend(title);
  }
  return {
    markup: [...document.documentElement.childNodes].map((node) => serializer.serializeToString(node)).join(""),
    outlines
  };
}

/** Recolors a NATO symbol's friendly fill for one faction and makes it scale to its box. */
export function prepareSymbol(svgSource: string, color: string): string {
  const document = new DOMParser().parseFromString(svgSource, "image/svg+xml");
  const root = document.documentElement;
  const width = root.getAttribute("width") ?? "600";
  const height = root.getAttribute("height") ?? "400";
  if (root.getAttribute("viewBox") === null) root.setAttribute("viewBox", `0 0 ${width} ${height}`);
  root.removeAttribute("width");
  root.removeAttribute("height");
  root.setAttribute("aria-hidden", "true");
  root.setAttribute("focusable", "false");
  root.setAttribute("preserveAspectRatio", "xMidYMid meet");
  document.getElementById("Friendly Fill")?.setAttribute(
    "style",
    `fill:${color};fill-opacity:0.92;stroke:#241d18;stroke-width:14;stroke-linejoin:miter`
  );
  document.querySelectorAll("[id]").forEach((element) => { element.removeAttribute("id"); });
  return new XMLSerializer().serializeToString(root);
}
