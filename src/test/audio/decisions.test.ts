import { describe, expect, it } from "vitest";
import { type HeardState, cuesFor, moveCue, moveModeOf } from "../../main/audio/cues";
import { channelGain, clampLevel, dbGain, defaultSettings, parseSettings, sliderGain } from "../../main/audio/levels";
import { decide, silentMixer } from "../../main/audio/mixer";
import { chooseSource, firstTrack, joinStep, nextTrack, type MusicSource } from "../../main/audio/playlist";
import type { CueId } from "../../main/audio/sounds";
import { connectionHint, savingData } from "../../main/connection";
import { initialGameState } from "../../main/engine/resolution";
import type { ActorKind, AirMissionOrder, BuildOrder, MoveOrder, RecruitOrder, SackOrder } from "../../main/engine/types";
import { layersToShow } from "../../main/map/useDetailWanted";
import { wantsDetail } from "../../main/map/terrainRendering";
import { changeRecruitQuantity, clickMapTerritory, endTurn, orderFromMuster, selectAllAvailableUnits } from "../../main/state/gameSlice";
import { type Assignments, type Draft, emptyDraft, type Session } from "../../main/state/session";
import { timeRanOut } from "../../main/state/timeout";
import { clockWarned, type TimerState } from "../../main/state/timerSlice";
import { faction, spainId, spainWithAir, territory, unit } from "../support";

type Planning = Extract<Session, { readonly phase: "planning" }>;

const scenario = spainWithAir();
const scenarioOf = () => scenario;
const state = initialGameState(scenario);

function planning(draft: Partial<Draft> = {}, humans = 1, factionId = "republic"): Planning {
  const kind = (at: number): ActorKind => (at < humans ? "local-human" : "computer");
  const assignments: Assignments = { [faction("republic")]: kind(0), [faction("north")]: kind(1), [faction("south")]: kind(2) };
  return { draft: { ...emptyDraft, ...draft }, factionId: faction(factionId), game: { assignments, history: [], locked: {}, scenarioId: spainId, seed: 1, state }, phase: "planning" };
}
const timer: TimerState = { minutes: 1 };
const at = (session: Session, clock: TimerState = timer): HeardState => ({ session, timer: clock });
const heard = (before: Session, after: Session, action: { readonly type: string } = { type: "any" }) => cuesFor(scenarioOf, at(before), at(after), action);

const moved = (unitId: string): MoveOrder => ({ factionId: faction("republic"), from: territory("madrid"), kind: "move", to: territory("valencia"), unitId: unit(unitId) });
const flight = { factionId: faction("republic"), kind: "air-mission", mission: { kind: "support", territoryId: territory("madrid") }, unitId: unit("f") } as unknown as AirMissionOrder;
const sack = { factionId: faction("republic"), kind: "sack", unitId: unit("g") } as unknown as SackOrder;
const build = { kind: "build" } as unknown as BuildOrder;
const recruit = { factionId: faction("republic"), kind: "recruit", territoryId: territory("madrid"), unitTypeId: "infantry" } as unknown as RecruitOrder;

describe("cues", () => {
  it.each<[string, Partial<Draft>, Partial<Draft>, readonly CueId[]]>([
    ["a march", {}, { orders: [moved("a")] }, ["march"]],
    ["aircraft over a march", {}, { airOrders: [flight], orders: [moved("a")] }, ["air"]],
    ["an air mission", {}, { airOrders: [flight] }, ["air"]],
    ["a stood-down aircraft", { airOrders: [flight] }, { airOrders: [] }, ["cancel"]],
    ["a Sack order", {}, { airOrders: [sack] }, ["order"]],
    ["a withdrawal", {}, { orders: [{ ...moved("a"), kind: "withdraw" }] }, ["order"]],
    ["a build", {}, { builds: [build] }, ["build"]],
    ["the same build again", { builds: [build] }, { builds: [build, build] }, ["build"]],
    ["the first recruit", {}, { recruits: [recruit] }, ["recruit"]],
    ["one more recruit", { recruits: [recruit] }, { recruits: [recruit, recruit] }, ["order"]],
    ["one recruit fewer", { recruits: [recruit, recruit] }, { recruits: [recruit] }, ["cancel"]],
    ["an army told to stay", {}, { orderedToStay: [unit("a")] }, ["order"]],
    ["a cancelled move", { orders: [moved("a")] }, {}, ["cancel"]],
    ["selecting", {}, { selectedUnitIds: [unit("a")] }, []]
  ])("%s", (_name, before, after, cues) => {
    expect(heard(planning(before), planning(after))).toEqual(cues);
  });

  it("is one sound for a group, the rarest way it goes", () => {
    expect(moveCue(["march", "rail", "motor"], true)).toBe("rail");
    expect(moveCue(["march", "motor"], true)).toBe("air");
    expect(moveCue(["march", "motor"], false)).toBe("truck");
    expect(moveCue(["sea", "march"], false)).toBe("march");
    expect(moveCue(["sea"], false)).toBe("order");
    expect(moveCue([], false)).toBeUndefined();
  });

  it("reads a move's way from the engine", () => {
    const modes = new Set(Object.values(state.units).filter((army) => army.factionId === "republic").flatMap((army) => scenario.territories.flatMap(({ id }) => {
      const order: MoveOrder = { factionId: army.factionId, from: army.territoryId, kind: "move", to: id, unitId: army.id };
      return [moveModeOf(scenario, planning(), order), moveModeOf(scenario, planning(), { ...order, legs: [{ kind: "rail", to: id }] })];
    })));
    expect([...modes]).toEqual(expect.arrayContaining(["march", "rail"]));
  });

  it("keeps every order secret between players at one device", () => {
    for (const after of [{ orders: [moved("a")] }, { airOrders: [flight] }, { builds: [build] }, { recruits: [recruit] }]) {
      expect(heard(planning({}, 2), planning(after, 2))).toEqual(["order"]);
      expect(heard(planning(after, 2), planning({}, 2))).toEqual(["order"]);
    }
    const orders = [moved("a")];
    expect(heard(planning({ orders }, 2), planning({ feedback: "No room.", orders }, 2), { type: orderFromMuster.type })).toEqual(["order"]);
  });

  it("sounds a refusal only for an order that changed nothing and was told why", () => {
    const orders = [moved("a")];
    const before = planning({ orders });
    const refused = planning({ feedback: "No room.", orders });
    expect(heard({ ...before, draft: { ...before.draft, orders } }, refused, changeRecruitQuantity({ quantity: 1, territoryId: territory("madrid"), unitTypeId: recruit.unitTypeId }))).toEqual(["refused"]);
    expect(heard(before, planning({ feedback: "Ordered.", orders: [moved("a")] }), { type: orderFromMuster.type })).toEqual([]);
    expect(heard(before, refused, selectAllAvailableUnits())).toEqual([]);
    expect(heard(before, refused, clickMapTerritory(territory("madrid")))).toEqual([]);
    const choosing = planning({ orders, stage: { orderKind: "move", step: "choose-destination" } });
    expect(heard(choosing, refused, clickMapTerritory(territory("madrid")))).toEqual(["refused"]);
  });

  it("is silent when an action is ignored, outside planning, or when the player changes", () => {
    const same = planning();
    expect(heard(same, same, endTurn())).toEqual([]);
    expect(heard({ phase: "idle" }, planning({ orders: [moved("a")] }))).toEqual([]);
    expect(heard(planning({}, 2), planning({ orders: [moved("a")] }, 2, "north"))).toEqual([]);
    expect(heard(planning(), { phase: "idle" })).toEqual([]);
  });

  it("ends the turn, and adds the guns when the report it opens has a battle", () => {
    const { game } = planning();
    const report = (outcomes: readonly unknown[]): Session => ({ game, phase: "resolution", result: { outcomes } }) as unknown as Session;
    expect(heard(planning(), report([]), endTurn())).toEqual(["end-turn"]);
    expect(heard(planning(), report([{ kind: "battle" }]), timeRanOut())).toEqual(["end-turn", "battle"]);
    expect(heard(planning(), { factionId: faction("north"), game, phase: "handoff" }, endTurn())).toEqual(["end-turn"]);
  });

  it("warns once at ten seconds", () => {
    const clock = { ...timer };
    expect(cuesFor(scenarioOf, at(planning()), at(planning(), clock), clockWarned(10))).toEqual(["time-warning"]);
    expect(cuesFor(scenarioOf, at(planning()), at(planning()), clockWarned(10))).toEqual([]);
    expect(cuesFor(scenarioOf, at(planning()), at(planning(), clock), clockWarned(60))).toEqual([]);
  });
});

describe("mixer", () => {
  const cues = (decision: ReturnType<typeof decide>) => decision.plays.map((play) => play.cue);

  it("joins one burst into one sound, and answers a cooling action with the tick", () => {
    const first = decide(silentMixer, ["rail"], 0);
    expect(cues(first)).toEqual(["rail"]);
    expect(cues(decide(first.state, ["rail"], 100))).toEqual([]);
    const second = decide(first.state, ["rail"], 1000);
    expect(cues(second)).toEqual(["order"]);
    expect(cues(decide(second.state, ["order"], 1050))).toEqual([]);
    expect(cues(decide(second.state, ["order"], 1140))).toEqual([]);
    expect(cues(decide(first.state, ["rail"], 4100))).toEqual(["rail"]);
  });

  it("gives a voice to a higher rank, drops equals, and frees voices with time", () => {
    const two = decide(decide(silentMixer, ["march"], 0).state, ["build"], 200);
    const third = decide(two.state, ["air"], 400);
    expect(cues(third)).toEqual(["air"]);
    expect(third.stops).toEqual([two.plays[0]?.id]);
    expect(cues(decide(third.state, ["truck"], 600))).toEqual([]);
    expect(cues(decide(third.state, ["truck"], 5000))).toEqual(["truck"]);
    expect(cues(decide(decide(silentMixer, ["order"], 0).state, ["cancel"], 300))).toEqual([]);
  });

  it("ducks the music, and starts the guns as End turn fades", () => {
    const decision = decide(silentMixer, ["end-turn", "battle"], 50);
    expect(decision.duck).toBe(true);
    expect(decision.plays.map(({ cue, delaysMs }) => [cue, delaysMs])).toEqual([["end-turn", [0]], ["battle", [1400]]]);
    expect(decision.stops).toEqual([]);
    expect(decide(silentMixer, ["battle"], 0).plays[0]?.delaysMs).toEqual([0]);
    expect(decide(silentMixer, ["time-warning"], 0).plays[0]?.delaysMs).toEqual([0, 600]);
    expect(decide(silentMixer, ["march"], 0).duck).toBe(false);
  });
});

describe("levels", () => {
  it("turns sliders and mutes into independent gains", () => {
    const { levels } = defaultSettings(false);
    expect(channelGain(levels, "music")).toBeCloseTo(0.64 * 0.36);
    expect(channelGain(levels, "effects")).toBeCloseTo(0.64 * 0.64);
    expect(channelGain({ ...levels, music: { level: 60, muted: true } }, "music")).toBe(0);
    expect(channelGain({ ...levels, music: { level: 60, muted: true } }, "effects")).toBeGreaterThan(0);
    expect(channelGain({ ...levels, master: { level: 80, muted: true } }, "effects")).toBe(0);
    expect(sliderGain(50)).toBe(0.25);
    expect(dbGain(-20)).toBeCloseTo(0.1);
    expect([clampLevel(-3), clampLevel(52), clampLevel(140)]).toEqual([0, 50, 100]);
  });

  it("repairs whatever the browser kept", () => {
    const defaults = defaultSettings(false);
    for (const raw of [null, "{", "7", "null", "{}", '{"levels":{"music":3,"master":{"level":"x","muted":1}}}']) expect(parseSettings(raw, false)).toEqual(defaults);
    const saved = { levels: { ...defaults.levels, effects: { level: 35, muted: true } }, noticeSeen: true };
    expect(parseSettings(JSON.stringify(saved), false)).toEqual(saved);
  });

  it("leaves music off on a connection that saves data, until asked", () => {
    expect(defaultSettings(true).levels.music.muted).toBe(true);
    expect([savingData(undefined), savingData({ effectiveType: "4g" }), savingData({ effectiveType: "3g" }), savingData({ saveData: true })]).toEqual([false, false, true, true]);
    expect(connectionHint({ connection: { saveData: true } } as unknown as Navigator)).toEqual({ saveData: true });
    expect(parseSettings('{"levels":{"music":{"level":60,"muted":false}}}', true).levels.music.muted).toBe(false);
  });
});

describe("playlist", () => {
  const ogg: MusicSource = { type: "audio/ogg", url: "a.ogg" };
  const m4a: MusicSource = { type: "audio/mp4", url: "a.m4a" };

  it("plays Opus first, AAC where Opus or a script's volume is missing, and nothing otherwise", () => {
    expect(chooseSource({ aac: true, opus: true, volume: true }, [m4a, ogg])).toBe(ogg);
    expect(chooseSource({ aac: true, opus: false, volume: true }, [ogg, m4a])).toBe(m4a);
    expect(chooseSource({ aac: true, opus: true, volume: false }, [ogg, m4a])).toBe(m4a);
    expect(chooseSource({ aac: false, opus: true, volume: false }, [ogg, m4a])).toBeUndefined();
  });

  it("starts anywhere, then goes round, with time to fetch the next track", () => {
    expect([firstTrack(4, 0), firstTrack(4, 0.99), firstTrack(4, 1), nextTrack(3, 4)]).toEqual([0, 3, 3, 0]);
    const track = { id: "a", overlapSeconds: 10, seconds: 100, title: "A" };
    expect(joinStep(track, 50)).toEqual({ kind: "play" });
    expect(joinStep(track, 60)).toEqual({ kind: "prepare" });
    expect(joinStep(track, 89.75)).toEqual({ inMs: 250, kind: "start" });
    expect(joinStep(track, 95)).toEqual({ inMs: 0, kind: "start" });
  });
});

describe("the detailed map picture", () => {
  const rect = (width: number) => ({ height: 100, width, x: 0, y: 0 });
  it("waits for a zoom, or a quiet moment on a connection that does not save data", () => {
    expect(wantsDetail(rect(800), rect(1000), false, undefined)).toBe(false);
    expect(wantsDetail(rect(400), rect(1000), false, { saveData: true })).toBe(true);
    expect(wantsDetail(rect(800), rect(1000), true, undefined)).toBe(true);
    expect(wantsDetail(rect(800), rect(1000), true, { effectiveType: "3g" })).toBe(false);
  });
  it("is the last of several layers", () => {
    const layers = [{ bounds: rect(9), url: "a" }, { bounds: rect(5), url: "b" }];
    expect(layersToShow(layers, false)).toEqual(layers.slice(0, 1));
    expect(layersToShow(layers, true)).toBe(layers);
    expect(layersToShow(layers.slice(0, 1), false)).toHaveLength(1);
  });
});

