import { describe, expect, it } from "vitest";
import { prepareSymbol } from "../main/map/markup";
import { spainId, testRegistry } from "./support";

const drawingElements = new Set(["svg", "path"]);

describe("unit symbols", () => {
  it("gives every Spain unit type its own symbol", () => {
    const { map, scenario } = testRegistry().require(spainId);
    const paths = scenario.unitTypes.map((type) => map.unitSymbolPaths.get(type.id));
    expect(paths.every((path) => path !== undefined)).toBe(true);
    expect(new Set(paths).size).toBe(scenario.unitTypes.length);
  });

  it("draws each symbol as plain paths that recolour by faction and need no fonts", async () => {
    const assets = await testRegistry().loadAssets(spainId);
    for (const [typeId, source] of assets.unitSymbols) {
      const root = new DOMParser().parseFromString(source, "image/svg+xml").documentElement;
      const elements = [root, ...root.querySelectorAll("*")];
      expect(elements.map((element) => element.localName).filter((name) => !drawingElements.has(name)), typeId).toEqual([]);
      const attributes = elements.flatMap((element) => [...element.attributes].map((attribute) => attribute.name));
      expect(attributes.filter((name) => name.toLowerCase().startsWith("on") || name.includes("href")), typeId).toEqual([]);
      expect(root.querySelector('[id="Friendly Fill"]'), typeId).not.toBeNull();
      expect(prepareSymbol(source, "#123456"), typeId).toContain("fill:#123456");
    }
  });
});
