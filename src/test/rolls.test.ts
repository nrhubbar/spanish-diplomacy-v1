import { createHmac, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { keyedRolls, numericRolls, rollSource } from "../main/engine/rolls";
import { deriveSeed, seededRandom } from "../main/engine/random";
import { rollStream } from "../main/engine/dice";
import { hmacSha256, sha256 } from "../main/engine/sha256";

const nodeHmac = (key: string, message: string): string => createHmac("sha256", key).update(message).digest("hex");
const hexOf = (words: readonly number[]): string => words.map((word) => word.toString(16).padStart(8, "0")).join("");

describe("SHA-256", () => {
  it("matches the published vectors", () => {
    expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hexOf(hmacSha256("Jefe", "what do ya want for nothing?"))).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  it("agrees with Node at every padding length, in any script, and for long keys", () => {
    for (let length = 0; length < 140; length += 1) expect(sha256("x".repeat(length))).toBe(createHash("sha256").update("x".repeat(length)).digest("hex"));
    for (const text of ["Aragón", "€", "\u{1f3b2} dice"]) expect(sha256(text)).toBe(createHash("sha256").update(text).digest("hex"));
    for (const key of ["", "k".repeat(64), "k".repeat(65), "k".repeat(200)]) expect(hexOf(hmacSha256(key, "m"))).toBe(nodeHmac(key, "m"));
  });
});

describe("roll sources", () => {
  it("replays the harness's numeric streams exactly", () => {
    const rolls = numericRolls(42);
    expect(rolls.stream("battle", 3, 1)()).toBe(rollStream(42, "battle", 3, 1)());
    expect(rolls.computer(3, 1)()).toBe(seededRandom(deriveSeed(42, 3, 1))());
    expect(rollSource(42).stream("raid", 1, 0)()).toBe(rolls.stream("raid", 1, 0)());
    expect(rollSource(rolls)).toBe(rolls);
  });

  it("draws a game's dice from its whole text seed, each stream apart from the others", () => {
    const draw = (seed: string, count = 20): number[] => { const next = keyedRolls(seed).stream("battle", 1, 0); return Array.from({ length: count }, next); };
    expect(draw("madrid")).toEqual(draw("madrid"));
    expect(draw("madrid")).not.toEqual(draw("madrid "));
    expect(new Set(draw("madrid", 64)).size).toBe(64);
    for (const value of draw("madrid", 64)) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThan(1); }
    const rolls = keyedRolls("madrid");
    const firsts = [rolls.stream("battle", 1, 0), rolls.stream("battle", 1, 1), rolls.stream("battle", 2, 0), rolls.stream("raid", 1, 0), rolls.computer(1, 0), rolls.computer(1, 1)].map((next) => next());
    expect(new Set(firsts).size).toBe(firsts.length);
  });

  it("is even over a d20", () => {
    const next = keyedRolls("even").stream("battle", 1, 0);
    const counts = Array.from({ length: 20 }, () => 0);
    for (let roll = 0; roll < 4000; roll += 1) { const face = Math.floor(next() * 20); counts[face] = (counts[face] ?? 0) + 1; }
    for (const count of counts) expect(Math.abs(count - 200)).toBeLessThan(70);
  });
});
