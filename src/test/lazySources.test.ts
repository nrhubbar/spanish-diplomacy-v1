import { describe, expect, it } from "vitest";
import { loadBuiltInRegistry } from "../main/scenarios/lazySources";
import { fixtureSources } from "./fixtures/scenarios/fixtureSources";

describe("the app's lazily loaded registry", () => {
  it("loads the same packages as the eager sources, plus any extra sources", async () => {
    const registry = await loadBuiltInRegistry(fixtureSources);
    expect(registry.problems).toEqual([]);
    expect(registry.list().map((summary) => summary.id)).toEqual(["spanish-civil-war-1936", "tiny-front"]);
  });
});
