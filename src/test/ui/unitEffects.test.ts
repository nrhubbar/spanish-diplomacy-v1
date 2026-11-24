import { describe, expect, it, vi } from "vitest";
import { transportBonus } from "../../main/engine/movement/allowance";
import { unitEffectKinds } from "../../main/engine/types/effects";
import type { Scenario, UnitEffect, UnitTypeDefinition, UnitTypeId, WeatherId } from "../../main/engine/types";
import { unitEffectLines } from "../../main/presentation/unitEffects";
import { spain } from "../support";

const scenario = spain();
const typeOf = (id: string): UnitTypeDefinition => scenario.index.unitTypes.get(id as UnitTypeId)!;
const withEffects = (id: string, ...effects: readonly UnitEffect[]): UnitTypeDefinition => ({ ...typeOf(id), effects });
const lines = (id: string, ...effects: readonly UnitEffect[]): readonly string[] => unitEffectLines(scenario, withEffects(id, ...effects));

describe("a unit type's special effects in words (D7, note 4)", () => {
  it("gives every effect kind in the scenario a line", () => {
    const seen = new Set(scenario.unitTypes.flatMap((type) => type.effects.map((effect) => effect.kind)));
    expect([...seen].sort()).toEqual([...unitEffectKinds].sort());
    for (const type of scenario.unitTypes) {
      const text = unitEffectLines(scenario, type);
      expect(text).toHaveLength(type.effects.length + (type.air === undefined ? 0 : 1));
      for (const line of text) expect(line).toMatch(/^[A-Z+].*\.$/u);
    }
  });

  it("says nothing for a type with no effects", () => {
    expect(unitEffectLines(scenario, typeOf("infantry-regiment"))).toEqual([]);
  });

  it("roll bonus: reads the artillery's step, bonus and limit from the data", () => {
    const artillery = typeOf("artillery-group");
    const bonus = artillery.effects.find((effect) => effect.kind === "roll-bonus-per-points")!;
    expect(unitEffectLines(scenario, artillery)[0]).toBe(`+${String(bonus.bonus)} on the attack roll for every ${String(bonus.per)} artillery attack points, up to +${String(bonus.max)}.`);
    expect(lines("artillery-group", { ...bonus, max: 5, per: 4 })).toEqual([`+${String(bonus.bonus)} on the attack roll for every 4 artillery attack points, up to +5.`]);
    expect(lines("artillery-group", { ...bonus, bonus: 2, per: 1, role: "defence" })[0]).toMatch(/^\+2 on the defence roll for every artillery defence point, up to/u);
  });

  it("roll bonus: names the weathers that take it away", () => {
    const tanks = typeOf("tank-company").effects.find((effect) => effect.kind === "roll-bonus-per-points")!;
    expect(lines("tank-company", tanks)[0]).toMatch(/tank attack points, up to \+\d+\. Nothing in mud or snow\.$/u);
    expect(lines("tank-company", { ...tanks, exceptWeather: ["sandstorm" as WeatherId] })[0]).toContain("Nothing in sandstorm.");
  });

  it("cannot attack alone", () => {
    expect(lines("artillery-group", { kind: "cannot-attack-alone" })).toEqual(["Can't attack alone: needs at least one other ground unit in the attack."]);
  });

  it("transport", () => {
    expect(lines("truck-column", { carries: 2, kind: "transport" })[0]).toMatch(/^Carries 2 units\. An army moves 1 territory further/u);
    expect(lines("truck-column", { carries: 1, kind: "transport" })[0]).toMatch(/^Carries 1 unit\./u);
  });

  it("mobile", () => {
    expect(lines("cavalry-regiment", { kind: "mobile" })[0]).toMatch(/^Needs no transport: an army of only cavalry moves 1 territory further/u);
    expect(unitEffectLines(scenario, { ...withEffects("cavalry-regiment", { kind: "mobile" }), name: "Cavalry" })[0]).toContain("an army of only cavalry moves");
  });

  it("moves an army further by the engine's own transport bonus, whatever it is", async () => {
    vi.resetModules();
    vi.doMock("../../main/engine/movement/allowance", async (original) => ({ ...(await original<object>()), transportBonus: transportBonus + 1 }));
    const { unitEffectLines: linesThen } = await import("../../main/presentation/unitEffects");
    vi.doUnmock("../../main/engine/movement/allowance");
    expect(lines("truck-column", { carries: 2, kind: "transport" })[0]).toContain("An army moves 1 territory further");
    expect(linesThen(scenario, withEffects("truck-column", { carries: 2, kind: "transport" }))[0]).toContain("An army moves 2 territories further");
    expect(linesThen(scenario, withEffects("cavalry-regiment", { kind: "mobile" }))[0]).toContain("an army of only cavalry moves 2 territories further");
  });

  it("names the arm without its formation, and the whole type when its name has none", () => {
    const named = (name: string): string | undefined => unitEffectLines(scenario, { ...withEffects("cavalry-regiment", { kind: "mobile" }), name })[0];
    expect(named("Motor rifle battalion")).toContain("an army of only motor rifle moves");
    expect(named("Colonial veterans")).toContain("an army of only colonial veterans moves");
    expect(named("Security forces")).toContain("an army of only security forces moves");
    expect(named("Column")).toContain("an army of only column moves");
  });

  it("raid defence", () => {
    expect(lines("anti-air-battery", { kind: "raid-defence", roll: -3 })).toEqual(["Enemy raids here roll 3 lower. When defending, +3 for your side in an air battle."]);
  });

  it("trains in contested ground", () => {
    expect(lines("militia-column", { kind: "trains-in-contested" })).toEqual(["Keeps training even while the territory is contested."]);
  });

  it("command bonus", () => {
    expect(lines("general", { kind: "command-bonus", roll: 2 })).toEqual(["+2 on the battle roll of its army. Only the best bonus counts for each side."]);
  });

  it("rally", () => {
    expect(lines("general", { kind: "rally" })).toEqual(["Restores the morale of the army it is in."]);
  });

  it("battle support, with the scenario's limit when it has one", () => {
    const limited: Scenario = { ...scenario, air: { ...scenario.air!, supportMax: 2 } };
    const type = { ...withEffects("infantry-regiment", { kind: "battle-support", roll: 3 }) };
    expect(unitEffectLines(limited, type)).toEqual(["+3 on the battle roll from Ground Support. If an air battle is fought, it counts only when your side wins, and aircraft may be shot down. At most 2 aircraft count for each side."]);
    const unlimited: Scenario = { ...scenario, air: { ...scenario.air!, supportMax: undefined } };
    expect(unitEffectLines(unlimited, type)).toEqual(["+3 on the battle roll from Ground Support. If an air battle is fought, it counts only when your side wins, and aircraft may be shot down."]);
  });

  it("air battle", () => {
    expect(lines("infantry-regiment", { kind: "air-battle", roll: 1 })).toEqual(["+1 for your side in an air battle. Every aircraft counts."]);
  });

  it("an aircraft's missions and range, and what a raid does", () => {
    const fighter = typeOf("fighter-squadron");
    expect(unitEffectLines(scenario, fighter).at(-1)).toBe(`Flies Patrol and Ground Support up to ${String(fighter.air!.range)} territories away.`);
    expect(unitEffectLines(scenario, typeOf("bomber-squadron")).at(-1)).toMatch(/A raid can cut income or damage a building\.$/u);
    expect(unitEffectLines(scenario, { ...typeOf("recon-flight"), air: { missions: ["recon"], range: 1 } })).toEqual(["Flies Recon up to 1 territory away."]);
  });
});
