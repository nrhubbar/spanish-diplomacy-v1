const svgNamespace = "http://www.w3.org/2000/svg";

/** Plain drawing elements only: no scripts, styles, links, images, references, or text. */
const allowedElements = new Set(["svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);

const allowedAttributes = new Set([
  "class",
  "cx",
  "cy",
  "d",
  "data-level",
  "fill",
  "fill-opacity",
  "fill-rule",
  "height",
  "opacity",
  "points",
  "r",
  "rx",
  "ry",
  "stroke",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "transform",
  "viewBox",
  "width",
  "x",
  "x1",
  "x2",
  "xmlns",
  "y",
  "y1",
  "y2"
]);

/**
 * Parses an SVG source and strips everything but plain drawing: unknown elements are removed
 * with their content, and unknown attributes, event handlers, ids, and `url(...)` references
 * are dropped. Throws when the source is not well-formed SVG.
 */
export function sanitizeSvg(source: string): Element {
  const document = new DOMParser().parseFromString(source, "image/svg+xml");
  const root = document.documentElement;
  if (document.getElementsByTagName("parsererror").length > 0 || root.namespaceURI !== svgNamespace || root.localName !== "svg") {
    throw new Error("Outcome art is not well-formed SVG.");
  }
  for (const element of [...root.querySelectorAll("*")]) {
    if (element.namespaceURI !== svgNamespace || !allowedElements.has(element.localName)) element.remove();
  }
  for (const element of [root, ...root.querySelectorAll("*")]) {
    for (const attribute of [...element.attributes]) {
      if (!allowedAttributes.has(attribute.name) || /url\s*\(|javascript:/i.test(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  return root;
}
