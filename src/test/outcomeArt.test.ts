import { describe, expect, it } from "vitest";
import { outcomeEmblem, outcomeMedallion } from "../main/assets/outcomes/art";
import { emblemSources } from "../main/assets/outcomes/emblemSources";
import { outcomeKeys, resultKeys, statusKeys } from "../main/presentation/outcomes";
import { medallionSources } from "../main/assets/outcomes/medallionSources";
import { sanitizeSvg } from "../main/assets/outcomes/sanitize";

const svgNamespace = "http://www.w3.org/2000/svg";
const drawingElements = new Set(["svg", "g", "path", "circle", "ellipse", "line", "polyline", "polygon", "rect"]);

function parse(markup: string): Element {
  return new DOMParser().parseFromString(markup, "image/svg+xml").documentElement;
}

function shape(root: Element): string {
  return [root, ...root.querySelectorAll("*")]
    .map((element) => `${element.localName}(${[...element.attributes].map((attribute) => attribute.name).sort().join(",")})`)
    .join(" ");
}

describe("outcome keys", () => {
  it("lists the seven results and five statuses of the combat contract", () => {
    expect(resultKeys).toEqual([
      "attacker-eliminated",
      "attacker-attrition",
      "attacker-demoralized",
      "both-demoralized",
      "defender-demoralized",
      "defender-exchange",
      "defender-eliminated"
    ]);
    expect(statusKeys).toEqual(["demoralized", "dug-in", "recovered", "reinforcement-arrived", "surrendered"]);
    expect(new Set(outcomeKeys).size).toBe(12);
  });
});

describe("sanitizeSvg", () => {
  it("keeps plain drawing and strips scripts, styles, links, references, ids, and handlers", () => {
    const root = sanitizeSvg(
      `<svg xmlns="${svgNamespace}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)" id="top">` +
        "<style>circle{fill:red}</style><script>alert(1)</script>" +
        '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>' +
        '<a href="https://example.com"><circle r="1"/></a><image href="x.png"/><use xlink:href="#top"/><text>hi</text>' +
        '<g class="keep" style="fill:red" onclick="x()"><path d="M0 0 H 1" fill="url(#paint)" stroke="javascript:x" stroke-width="2"/></g>' +
        "</svg>"
    );
    expect(shape(root)).toBe("svg(viewBox,xmlns) g(class) path(d,stroke-width)");
  });

  it("rejects sources that are not well-formed SVG", () => {
    expect(() => sanitizeSvg("<svg")).toThrow("not well-formed SVG");
    expect(() => sanitizeSvg('<html xmlns="http://www.w3.org/1999/xhtml"/>')).toThrow("not well-formed SVG");
    expect(() => sanitizeSvg("<svg/>")).toThrow("not well-formed SVG");
  });
});

describe("outcome medallions", () => {
  it("draws every outcome key in the ring and body grammar", () => {
    for (const key of outcomeKeys) {
      const root = parse(outcomeMedallion(key, { ring: "#b1493f" }));
      expect(root.getAttribute("data-outcome")).toBe(key);
      expect(root.getAttribute("class")).toBe("outcome-medallion");
      expect(root.getAttribute("viewBox")).toBe("-12.5 -12.5 25 25");
      expect([root.getAttribute("x"), root.getAttribute("y"), root.getAttribute("width"), root.getAttribute("height")]).toEqual(["-12.5", "-12.5", "25", "25"]);
      expect(root.getAttribute("aria-hidden")).toBe("true");
      expect(root.querySelector(".outcome-ring")?.getAttribute("fill")).toBe("#b1493f");
      expect(root.querySelector(".outcome-ring")?.getAttribute("r")).toBe("11.5");
      expect(root.querySelector(".outcome-body")?.getAttribute("r")).toBe("8.2");
      expect(root.querySelector(".outcome-glyph")?.children.length).toBeGreaterThan(0);
      expect(root.querySelector("[data-level]")).toBeNull();
    }
  });

  it("gives every key its own body color and glyph", () => {
    const glyphs = outcomeKeys.map((key) => parse(outcomeMedallion(key, { ring: "#000000" })).querySelector(".outcome-glyph")?.innerHTML);
    expect(new Set(glyphs).size).toBe(outcomeKeys.length);
    const body = (key: (typeof outcomeKeys)[number]): string | null | undefined =>
      parse(outcomeMedallion(key, { ring: "#000000" })).querySelector(".outcome-body")?.getAttribute("fill");
    expect(body("attacker-eliminated")).toBe("#9e2b2b");
    expect(body("defender-eliminated")).toBe("#9e2b2b");
    expect(body("attacker-attrition")).toBe(body("defender-exchange"));
    expect(body("attacker-demoralized")).toBe(body("both-demoralized"));
    expect(new Set([body("attacker-eliminated"), body("attacker-attrition"), body("attacker-demoralized"), body("defender-demoralized")]).size).toBe(4);
  });

  it("shows one to three pips when dug in, and ignores the level elsewhere", () => {
    for (const level of [1, 2, 3] as const) {
      const root = parse(outcomeMedallion("dug-in", { level, ring: "#665089" }));
      expect(root.querySelectorAll(".outcome-glyph g circle")).toHaveLength(level);
    }
    expect(parse(outcomeMedallion("dug-in", { ring: "#665089" })).querySelectorAll(".outcome-glyph g circle")).toHaveLength(1);
    expect(outcomeMedallion("recovered", { level: 3, ring: "#665089" })).toBe(outcomeMedallion("recovered", { ring: "#665089" }));
  });

  it("rejects ring colors that are not #rrggbb", () => {
    for (const ring of ["red", "#abc", "#b1493f;", 'x" onload="y']) {
      expect(() => outcomeMedallion("recovered", { ring })).toThrow("not a #rrggbb color");
    }
  });
});

describe("outcome emblems", () => {
  it("engraves every outcome key at report size", () => {
    for (const key of outcomeKeys) {
      const root = parse(outcomeEmblem(key));
      expect(root.getAttribute("data-outcome")).toBe(key);
      expect(root.getAttribute("class")).toBe("outcome-emblem");
      expect(root.getAttribute("viewBox")).toBe("-48 -48 96 96");
      expect([root.getAttribute("width"), root.getAttribute("height")]).toEqual(["96", "96"]);
      expect(root.getAttribute("aria-hidden")).toBe("true");
      expect(root.querySelector("[data-level]")).toBeNull();
    }
    expect(new Set(outcomeKeys.map((key) => outcomeEmblem(key))).size).toBe(outcomeKeys.length);
  });

  it("draws only in currentColor, so it follows the theme's text color", () => {
    for (const key of outcomeKeys) {
      const root = parse(outcomeEmblem(key));
      for (const element of [root, ...root.querySelectorAll("*")]) {
        for (const name of ["fill", "stroke"]) {
          expect(["none", "currentColor", null]).toContain(element.getAttribute(name));
        }
      }
    }
  });

  it("shows one to three pips when dug in", () => {
    for (const level of [1, 2, 3] as const) {
      expect(parse(outcomeEmblem("dug-in", { level })).querySelectorAll("g circle")).toHaveLength(level);
    }
    expect(parse(outcomeEmblem("dug-in")).querySelectorAll("g circle")).toHaveLength(1);
  });
});

describe("outcome art sources", () => {
  it("ships sources the sanitizer leaves untouched, drawn only with plain elements in ASCII", () => {
    for (const source of [...Object.values(medallionSources), ...Object.values(emblemSources)]) {
      expect(source).toMatch(/^[\x20-\x7e\n]*$/);
      expect(source.length).toBeLessThan(4096);
      const raw = parse(source);
      expect(shape(sanitizeSvg(source))).toBe(shape(raw));
      for (const element of [raw, ...raw.querySelectorAll("*")]) {
        expect(element.namespaceURI).toBe(svgNamespace);
        expect(drawingElements.has(element.localName)).toBe(true);
      }
    }
  });
});
