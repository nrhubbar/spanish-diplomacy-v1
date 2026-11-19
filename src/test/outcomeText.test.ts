import { describe, expect, it } from "vitest";
import { outcomeKeys } from "../main/presentation/outcomes";
import {
  fillLine,
  linePlaceholders,
  outcomeLine,
  outcomePlaceholders,
  outcomeText,
  type OutcomePlaceholder,
  type OutcomeValues
} from "../main/presentation/outcomeText";

const battle: OutcomeValues = { attacker: "Northern Command", defender: "Government", territory: "Aragón" };

/** Words a restrained dispatch about a real war's victims does not use, and names code must not hard-code. */
const banned = /massacre|slaughter|butcher|cut to pieces|execut|blood|corpse|atrocit|annihilat|extermina|wiped out|mown down|republican|nationalist|franco|\breds?\b|balance|popular resistance/i;

function supplied(names: readonly OutcomePlaceholder[]): OutcomeValues {
  return Object.fromEntries(names.map((name) => [name, `<${name}>`]));
}

describe("outcome text table", () => {
  it("gives every outcome key a title and two or three lines", () => {
    for (const key of outcomeKeys) {
      const entry = outcomeText[key];
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.lines.length).toBeGreaterThanOrEqual(2);
      expect(entry.lines.length).toBeLessThanOrEqual(3);
      expect(new Set(entry.lines).size).toBe(entry.lines.length);
    }
  });

  it("uses only placeholders the presenter supplies for that key", () => {
    for (const key of outcomeKeys) {
      const { lines, optional, required } = outcomeText[key];
      const allowed = new Set<string>([...required, ...optional]);
      for (const name of allowed) expect(outcomePlaceholders).toContain(name);
      for (const line of lines) {
        for (const name of linePlaceholders(line)) expect(allowed, `${key}: ${line}`).toContain(name);
      }
      for (const name of optional) expect(lines.some((line) => linePlaceholders(line).includes(name)), `${key} {${name}}`).toBe(true);
    }
  });

  it("can always write a line from the required values alone", () => {
    for (const key of outcomeKeys) {
      const { lines, required } = outcomeText[key];
      expect(lines.filter((line) => linePlaceholders(line).every((name) => required.some((r) => r === name))).length, key).toBeGreaterThanOrEqual(1);
      expect(outcomeLine(key, supplied(required), 0)).not.toContain("{");
    }
  });

  it("keeps the restrained dispatch tone in plain ASCII sentences", () => {
    for (const key of outcomeKeys) {
      for (const line of [outcomeText[key].title, ...outcomeText[key].lines]) {
        expect(line).toMatch(/^[\x20-\x7e]+$/);
        expect(line, line).not.toMatch(banned);
        expect(line, line).not.toMatch(/!|\s{2}/);
      }
      for (const line of outcomeText[key].lines) {
        expect(line, line).toMatch(/[.]$/);
        // Faction names never open a sentence: they need "the" or "forces of the" before them.
        expect(line, line).not.toMatch(/(^|[.;] )\{(attacker|defender)\}/);
      }
    }
  });
});

describe("outcomeLine", () => {
  it("fills placeholders, keeping accented names as given", () => {
    expect(outcomeLine("defender-eliminated", battle, 0)).toBe("Aragón has fallen. None of its defenders got away.");
    expect(outcomeLine("attacker-attrition", { ...battle, losses: "1,480" }, 1)).toBe(
      "Repeated assaults on Aragón broke against prepared positions, at a cost of 1,480 men."
    );
  });

  it("picks deterministically from the seed, wrapping negative and large seeds", () => {
    const lines = [0, 1, 2].map((seed) => outcomeLine("demoralized", { army: "Column", territory: "León" }, seed));
    expect(new Set(lines).size).toBe(3);
    expect(outcomeLine("demoralized", { army: "Column", territory: "León" }, 3)).toBe(lines[0]);
    expect(outcomeLine("demoralized", { army: "Column", territory: "León" }, -1)).toBe(lines[2]);
    expect(outcomeLine("demoralized", { army: "Column", territory: "León" }, Number.MAX_SAFE_INTEGER)).toBe(lines[Number.MAX_SAFE_INTEGER % 3]);
  });

  it("chooses lines with optional placeholders only when their values are supplied", () => {
    const without = [0, 1, 2, 3].map((seed) => outcomeLine("defender-eliminated", battle, seed));
    expect(without.every((line) => !line.includes("Cádiz"))).toBe(true);
    const withCity = [0, 1, 2].map((seed) => outcomeLine("defender-eliminated", { ...battle, city: "Cádiz" }, seed));
    expect(withCity).toContain("By nightfall, forces of the Northern Command held every road into Cádiz.");
  });

  it("rejects missing required values and seeds that are not integers", () => {
    expect(() => outcomeLine("attacker-attrition", battle, 0)).toThrow('Outcome "attacker-attrition" needs {losses}.');
    expect(() => outcomeLine("recovered", {}, 0)).toThrow("needs {army}, {territory}");
    for (const seed of [0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => outcomeLine("recovered", { army: "Column", territory: "León" }, seed)).toThrow("is not an integer");
    }
  });
});

describe("fillLine", () => {
  it("substitutes once, so values that look like placeholders stay literal", () => {
    expect(fillLine("The {army} holds {territory}.", { army: "{territory}", territory: "Madrid" })).toBe("The {territory} holds Madrid.");
  });

  it("refuses unknown or unsupplied placeholders", () => {
    expect(() => fillLine("The {general} arrived.", { army: "x" })).toThrow('No value for {general} in "The {general} arrived."');
    expect(() => fillLine("The {army} arrived.", {})).toThrow("No value for {army}");
    expect(linePlaceholders("{a} and {territory}")).toEqual(["a", "territory"]);
    expect(linePlaceholders("No names here.")).toEqual([]);
  });
});
