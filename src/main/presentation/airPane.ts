import type { AirMissionKind, GeneralDefinition, GeneralTrait, UnitTypeDefinition } from "../engine/types";
import { glyphs } from "./glyphs";

/**
 * U2, U3, U5 (`ux-air-a.webp`, `ux-pane-a-units.webp`): the words of the aircraft pane and of a
 * general's pill. The pane renders what these return.
 */

/** U2: mission names as the pane's buttons read them. */
export const missionNames: Readonly<Record<AirMissionKind, string>> = { intercept: "Intercept", raid: "Raid", recon: "Recon", support: "Support" };

export const missionHints: Readonly<Record<AirMissionKind, string>> = {
  intercept: "Fighters over a territory worsen enemy raids there and can shoot raiders down.",
  raid: "A raid on one sub-territory rolls: air eliminated, nothing hit, income cut for a turn, or a building hit.",
  recon: "Shows the territory's balances, queues and training next turn.",
  support: "Bombers over a battle add to their side's roll."
};

/** The line under the aircraft's name: type, base (paved or not) and range. */
export function aircraftMeta(type: UnitTypeDefinition | undefined, base: string, paved: boolean): string {
  return `${type?.name ?? "Aircraft"} ${glyphs.dot} based at ${base}${paved ? " (paved airfield)" : ""} ${glyphs.dot} range ${String(type?.air?.range ?? 0)} territories`;
}

/** The missions the type flies; the others are greyed. */
export function allowedMissions(type: UnitTypeDefinition | undefined): readonly AirMissionKind[] {
  return type?.air?.missions ?? [];
}

/** A mission button's tooltip: what the mission does, or why this type cannot fly it. */
export function missionTitle(type: UnitTypeDefinition | undefined, mission: AirMissionKind): string {
  return allowedMissions(type).includes(mission) ? missionHints[mission] : `A ${type?.name ?? "aircraft"} cannot fly this mission.`;
}

/** An aircraft in a list: its name and its mission this turn. */
export function aircraftLine(name: string, mission: AirMissionKind | undefined): string {
  return `${name} ${glyphs.dot} ${mission === undefined ? "standing down" : missionNames[mission]}`;
}

/** U3: the raid card's anti-air (a roll change, 0 or less) and the enemy fighters that may intercept. */
export function antiAirLabel(antiAir: number): string {
  return antiAir === 0 ? "none" : `${glyphs.minus}${String(Math.abs(antiAir))}`;
}

export function fightersLabel(fightersInReach: number): string {
  return fightersInReach === 0 ? "none" : "may intercept";
}

/** M11, T3: whether the aircraft flies from its base in this weather. */
export function baseWeatherVerdict(grounds: boolean, paved: boolean, weatherName: string): string {
  return !grounds ? "flies" : paved ? "flies (paved airfield)" : `grounded (${weatherName})`;
}

export function baseWeatherHeading(zone: string | undefined): string {
  return `Weather${zone === undefined ? "" : ` ${glyphs.dot} ${zone}`} `;
}

/** U5: a general's pill, his name and his trait. */
export function generalPill(general: GeneralDefinition, trait: GeneralTrait | undefined): { readonly text: string; readonly title: string } {
  return trait === undefined
    ? { text: general.name, title: general.name }
    : { text: `${general.name} ${glyphs.dot} ${trait.name}`, title: `${general.name}: ${trait.name}` };
}
