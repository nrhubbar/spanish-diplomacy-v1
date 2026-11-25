/**
 * SHA-256 and HMAC-SHA-256 (FIPS 180-4, RFC 2104), synchronous and the same everywhere. The
 * platform's own (Web Crypto) is asynchronous, and the engine resolves a turn in one call.
 */

type Bytes = readonly number[];

const blockBytes = 64;

/** The first 32 bits of the fractional part of a root of a prime. */
function rootBits(prime: number, root: number): number {
  const value = prime ** (1 / root);
  return Math.floor((value - Math.floor(value)) * 0x100000000) >>> 0;
}

const primes = ((): readonly number[] => {
  const found: number[] = [];
  for (let candidate = 2; found.length < 64; candidate += 1) if (found.every((prime) => candidate % prime !== 0)) found.push(candidate);
  return found;
})();
const roundConstants = primes.map((prime) => rootBits(prime, 3));
const initialHash = primes.slice(0, 8).map((prime) => rootBits(prime, 2));

const rotate = (value: number, bits: number): number => ((value >>> bits) | (value << (32 - bits))) >>> 0;
const at = (values: readonly number[], index: number): number => values[index] ?? 0;

function padded(message: Bytes): Bytes {
  const zeros = (blockBytes * 2 - 9 - (message.length % blockBytes)) % blockBytes;
  const bits = message.length * 8;
  const length = [0, 0, 0, Math.floor(bits / 0x100000000), bits >>> 24, (bits >>> 16) & 255, (bits >>> 8) & 255, bits & 255];
  return [...message, 0x80, ...Array.from({ length: zeros }, () => 0), ...length];
}

function compress(hash: readonly number[], block: Bytes): readonly number[] {
  const words = Array.from({ length: 16 }, (_, index) =>
    ((at(block, index * 4) << 24) | (at(block, index * 4 + 1) << 16) | (at(block, index * 4 + 2) << 8) | at(block, index * 4 + 3)) >>> 0);
  for (let index = 16; index < 64; index += 1) {
    const early = at(words, index - 15);
    const late = at(words, index - 2);
    const small0 = rotate(early, 7) ^ rotate(early, 18) ^ (early >>> 3);
    const small1 = rotate(late, 17) ^ rotate(late, 19) ^ (late >>> 10);
    words.push((at(words, index - 16) + small0 + at(words, index - 7) + small1) >>> 0);
  }
  let [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0] = hash;
  for (let index = 0; index < 64; index += 1) {
    const big1 = rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25);
    const first = (h + big1 + ((e & f) ^ (~e & g)) + at(roundConstants, index) + at(words, index)) >>> 0;
    const big0 = rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22);
    const second = (big0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
    [a, b, c, d, e, f, g, h] = [(first + second) >>> 0, a, b, c, (d + first) >>> 0, e, f, g];
  }
  return [a, b, c, d, e, f, g, h].map((value, index) => (value + at(hash, index)) >>> 0);
}

function digest(message: Bytes): readonly number[] {
  const bytes = padded(message);
  let hash: readonly number[] = initialHash;
  for (let start = 0; start < bytes.length; start += blockBytes) hash = compress(hash, bytes.slice(start, start + blockBytes));
  return hash;
}

const bytesOf = (words: readonly number[]): Bytes => words.flatMap((word) => [word >>> 24, (word >>> 16) & 255, (word >>> 8) & 255, word & 255]);

/** A string's UTF-8 bytes. */
export function utf8(text: string): Bytes {
  return Array.from(text).flatMap((character) => {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x80) return [code];
    if (code < 0x800) return [0xc0 | (code >> 6), 0x80 | (code & 63)];
    if (code < 0x10000) return [0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63)];
    return [0xf0 | (code >> 18), 0x80 | ((code >> 12) & 63), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63)];
  });
}

const hex = (words: readonly number[]): string => words.map((word) => word.toString(16).padStart(8, "0")).join("");

/** The SHA-256 of a text, in hex. */
export function sha256(text: string): string {
  return hex(digest(utf8(text)));
}

/** HMAC-SHA-256 as eight 32-bit words. */
export function hmacSha256(key: string, message: string): readonly number[] {
  const raw = utf8(key);
  const short = raw.length > blockBytes ? bytesOf(digest(raw)) : raw;
  const block = Array.from({ length: blockBytes }, (_, index) => at(short, index));
  const inner = digest([...block.map((byte) => byte ^ 0x36), ...utf8(message)]);
  return digest([...block.map((byte) => byte ^ 0x5c), ...bytesOf(inner)]);
}
