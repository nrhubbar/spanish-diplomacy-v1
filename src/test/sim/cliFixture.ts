import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scenarioSources } from "../../sim/engine";
import type { CliIo, WorkerSetup } from "../../sim/main";
import type { FromWorker, PoolWorker, ToWorker } from "../../sim/pool";
import type { GameTask, PlayedGame } from "../../sim/run";
import { serveWorker } from "../../sim/worker";
import { fixtureSources } from "../fixtures/scenarios/fixtureSources";

/** The command line with the outside world stood in: worker threads on this thread, and a clock that steps. */

export const cliSources = [...scenarioSources(), fixtureSources];

/** Seeds in the order the stand-in workers finished them. */
export const finished: number[] = [];
/** Replies waiting to be released, all at once and highest seed first. */
const held: { readonly deliver: () => void; readonly seed: number }[] = [];

function release(): void {
  for (const reply of held.splice(0).sort((a, b) => b.seed - a.seed)) {
    finished.push(reply.seed);
    reply.deliver();
  }
}

/** A clock that moves `step` milliseconds each time it is read. */
export function stepClock(step: number): () => number {
  let now = 0;
  return () => {
    now += step;
    return now;
  };
}

/**
 * A worker thread stood in by the real worker code on this thread, over an in-memory port.
 * Replies posted in the same tick are held and released highest seed first, so with several
 * workers the games finish out of order, deterministically. Each game takes 7 ms by its clock.
 */
export function inProcessWorker(setup: WorkerSetup): PoolWorker<GameTask, PlayedGame> {
  let toWorker: (message: ToWorker<GameTask>) => void = () => undefined;
  let toPool: (message: FromWorker<PlayedGame>) => void = () => undefined;
  serveWorker(setup, cliSources, {
    on: (_event, listener) => { toWorker = listener; },
    postMessage: (message) => {
      if (held.length === 0) setTimeout(release, 0);
      held.push({ deliver: () => { toPool(message); }, seed: message.kind === "result" ? message.result.line.seed : 0 });
    }
  }, stepClock(7));
  return {
    onError: () => undefined,
    onExit: () => undefined,
    onMessage: (listener) => { toPool = listener; },
    post: (message) => { toWorker(message); },
    terminate: () => Promise.resolve(0)
  };
}

/** The command line's outside world; `moments` is what its wall clock reads, one a call, the last repeating. */
export function cliIo(files: Readonly<Record<string, string>> = {}, moments: readonly string[] = ["2026-11-19T14:05:09Z"]) {
  const out: string[] = [];
  const err: string[] = [];
  let read = 0;
  const value: CliIo = {
    cores: 3,
    now: () => new Date(moments[Math.min(read++, moments.length - 1)] ?? 0),
    readText: (path) => {
      const text = files[path];
      if (text === undefined) throw new Error(`ENOENT: ${path}`);
      return text;
    },
    sources: cliSources,
    spawn: inProcessWorker,
    stderr: (text) => err.push(text),
    stdout: (text) => out.push(text)
  };
  return { err, io: value, out };
}

const folders: string[] = [];

export const tempOut = (): string => {
  const folder = mkdtempSync(join(tmpdir(), "sim-test-"));
  folders.push(folder);
  return folder;
};

export function clearTempOut(): void {
  for (const folder of folders.splice(0)) rmSync(folder, { force: true, recursive: true });
}
