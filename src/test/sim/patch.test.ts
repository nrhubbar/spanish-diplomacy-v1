import { describe, expect, it } from "vitest";
import { applyPatch, parsePatch, parseVariantFile, PatchError } from "../../sim/patch";

const document = { combat: { diggingIn: { max: 3, perTurn: 1 } }, factions: [{ id: "red" }, { id: "blue" }], "a/b": { "c~d": 1 } };

describe("variant patches (RFC 6902 subset)", () => {
  it("replaces, adds and removes object members without touching the input", () => {
    const patched = applyPatch(document, parsePatch([
      { op: "replace", path: "/combat/diggingIn/max", value: 2 },
      { op: "add", path: "/combat/extra", value: { deep: [1] } },
      { op: "remove", path: "/combat/diggingIn/perTurn" }
    ], "test"));
    expect(patched).toEqual({ ...document, combat: { diggingIn: { max: 2 }, extra: { deep: [1] } } });
    expect(document.combat.diggingIn.max).toBe(3);
  });

  it("edits arrays by index and appends with -", () => {
    const patched = applyPatch(document, [
      { op: "test", path: "/factions/1/id", value: "blue" },
      { op: "add", path: "/factions/1", value: { id: "green" } },
      { op: "add", path: "/factions/-", value: { id: "last" } },
      { op: "replace", path: "/factions/0", value: { id: "crimson" } },
      { op: "remove", path: "/factions/2" }
    ]) as typeof document;
    expect(patched.factions.map((faction) => faction.id)).toEqual(["crimson", "green", "last"]);
  });

  it("unescapes ~1 and ~0 in pointers and can replace or test the whole document", () => {
    expect(applyPatch(document, [{ op: "replace", path: "/a~1b/c~0d", value: 2 }])).toMatchObject({ "a/b": { "c~d": 2 } });
    expect(applyPatch(document, [{ op: "test", path: "", value: document }, { op: "replace", path: "", value: { x: 1 } }])).toEqual({ x: 1 });
  });

  it("fails loudly, naming the path", () => {
    const fails = (operation: Parameters<typeof applyPatch>[1][number]) => () => applyPatch(document, [operation]);
    expect(fails({ op: "replace", path: "/combat/missing", value: 1 })).toThrow(/combat\/missing/);
    expect(fails({ op: "remove", path: "/nothing/here" })).toThrow(PatchError);
    expect(fails({ op: "test", path: "/combat/diggingIn/max", value: 4 })).toThrow(/test failed/);
    expect(fails({ op: "test", path: "", value: {} })).toThrow(/test failed/);
    expect(fails({ op: "remove", path: "" })).toThrow(/whole document/);
    expect(fails({ op: "replace", path: "/factions/2", value: {} })).toThrow(/out of range/);
    expect(fails({ op: "add", path: "/factions/9", value: {} })).toThrow(/out of range/);
    expect(fails({ op: "add", path: "/factions/x", value: {} })).toThrow(/out of range/);
    expect(fails({ op: "add", path: "/combat/diggingIn/max/deeper", value: 1 })).toThrow(/not an object or array/);
    expect(() => applyPatch([1, 2, 3], [{ op: "replace", path: "/01", value: 0 }])).toThrow(/out of range/);
    expect(applyPatch({ list: [{ a: [1, { b: 2 }] }] }, [{ op: "test", path: "/list/0", value: { a: [1, { b: 2 }] } }])).toBeDefined();
    expect(() => applyPatch({ list: [1] }, [{ op: "test", path: "/list", value: [1, 2] }])).toThrow(/test failed/);
    expect(() => applyPatch({ o: { a: 1 } }, [{ op: "test", path: "/o", value: { b: 1 } }])).toThrow(/test failed/);
  });

  it("checks the shape of a patch", () => {
    expect(() => parsePatch({}, "v")).toThrow(/JSON array/);
    expect(() => parsePatch([{ op: "move", path: "/a", from: "/b" }], "v")).toThrow(/v\[0\].*op/);
    expect(() => parsePatch(["nope"], "v")).toThrow(/op/);
    expect(() => parsePatch([{ op: "add", path: "a" }], "v")).toThrow(/JSON Pointer/);
    expect(() => parsePatch([{ op: "add", path: "/a" }], "v")).toThrow(/needs a "value"/);
    expect(parsePatch([{ op: "remove", path: "/a", value: 1 }], "v")).toEqual([{ op: "remove", path: "/a" }]);
  });

  it("reads a variant file as an object or a bare patch", () => {
    expect(parseVariantFile([{ op: "remove", path: "/a" }], "variants/dig-cap-2.json")).toEqual({ name: "dig-cap-2", patch: [{ op: "remove", path: "/a" }] });
    expect(parseVariantFile({ description: "Works cap at 2", name: "cap", patch: [] }, "x.json")).toEqual({ description: "Works cap at 2", name: "cap", patch: [] });
    expect(parseVariantFile({ patch: [] }, "C:\\v\\plain.JSON").name).toBe("plain");
    expect(() => parseVariantFile("text", "x.json")).toThrow(/patch array or an object/);
    expect(() => parseVariantFile({ name: "Bad Name", patch: [] }, "x.json")).toThrow(/lowercase/);
    expect(() => parseVariantFile({ description: 3, patch: [] }, "x.json")).toThrow(/description/);
    expect(() => parseVariantFile({ name: "ok" }, "x.json")).toThrow(/x.json patch/);
  });
});
