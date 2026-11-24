import { transportBonus } from "../engine/movement/allowance";
import type { Scenario, UnitEffect, UnitTypeDefinition } from "../engine/types";
import { missionButtonOrder, missionNames } from "./airPane";
import { listNames } from "./text";

/** What transport adds to an army's movement. */
const further = `${territoriesLabel(transportBonus)} further`;

/** D7 (note 4): what a unit type does beyond its values, in the player's words and the scenario's own numbers. */
export function unitEffectLines(scenario: Scenario, type: UnitTypeDefinition): readonly string[] {
  return [...type.effects.map((effect) => effectLine(scenario, type, effect)), ...missionLines(type)];
}

function effectLine(scenario: Scenario, type: UnitTypeDefinition, effect: UnitEffect): string {
  switch (effect.kind) {
    case "roll-bonus-per-points": {
      const every = `+${String(effect.bonus)} on the ${effect.role} roll for every ${effect.per === 1 ? "" : `${String(effect.per)} `}${armOf(type)} ${effect.role} ${effect.per === 1 ? "point" : "points"}, up to +${String(effect.max)}.`;
      const weathers = effect.exceptWeather.map((id) => weatherName(scenario, id));
      return weathers.length === 0 ? every : `${every} Nothing in ${weathers.join(" or ")}.`;
    }
    case "cannot-attack-alone":
      return "Can't attack alone: needs at least one other ground unit in the attack.";
    case "transport":
      return `Carries ${unitsLabel(effect.carries)}. An army moves ${further} when its transport can carry every unit that needs it.`;
    case "mobile":
      return `Needs no transport: an army of only ${armOf(type)} moves ${further}, and rough ground does not slow it.`;
    case "raid-defence":
      return `Enemy raids here roll ${String(Math.abs(effect.roll))} lower. When defending, +${String(Math.abs(effect.roll))} for your side in an air battle.`;
    case "trains-in-contested":
      return "Keeps training even while the territory is contested.";
    case "command-bonus":
      return `+${String(effect.roll)} on the battle roll of its army. Only the best bonus counts for each side.`;
    case "rally":
      return "Restores the morale of the army it is in.";
    case "battle-support": {
      const most = scenario.air?.supportMax;
      const support = `+${String(effect.roll)} on the battle roll from ${missionNames.support}. If an air battle is fought, it counts only when your side wins, and aircraft may be shot down.`;
      return most === undefined ? support : `${support} At most ${String(most)} aircraft count for each side.`;
    }
    case "air-battle":
      return `+${String(effect.roll)} for your side in an air battle. Every aircraft counts.`;
  }
}

/** An aircraft's missions and how far it flies them. */
function missionLines({ air }: UnitTypeDefinition): readonly string[] {
  if (air === undefined) return [];
  const missions = listNames(missionButtonOrder.filter((mission) => air.missions.includes(mission)).map((mission) => missionNames[mission]));
  const flies = `Flies ${missions} up to ${territoriesLabel(air.range)} away.`;
  return [air.missions.includes("raid") ? `${flies} A raid can cut income or damage a building.` : flies];
}

/** The words that end a type's name when it is an arm and a formation, as in "Artillery group". */
const formations: ReadonlySet<string> = new Set(["battalion", "battery", "brigade", "column", "company", "corps", "detachment", "division", "flight", "group", "platoon", "regiment", "squad", "squadron", "wing"]);

/** The arm a type belongs to: "Artillery group" is "artillery". A name without a formation is the arm itself: "colonial veterans". */
function armOf(type: UnitTypeDefinition): string {
  const words = type.name.toLowerCase().split(" ");
  return (words.length > 1 && formations.has(words.slice(-1).join("")) ? words.slice(0, -1) : words).join(" ");
}

function territoriesLabel(count: number): string {
  return count === 1 ? "1 territory" : `${String(count)} territories`;
}

function unitsLabel(count: number): string {
  return count === 1 ? "1 unit" : `${String(count)} units`;
}

function weatherName(scenario: Scenario, id: string): string {
  return (scenario.weather?.outcomes.find((outcome) => outcome.id === id)?.name ?? id).toLowerCase();
}
