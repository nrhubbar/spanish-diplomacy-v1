/**
 * `npm run sim` (H1). One bundle plays both parts: on the main thread it is the CLI, and it
 * starts copies of itself as the worker threads that play the games.
 */
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { scenarioSources } from "./engine";
import type { GameLine } from "./game";
import { runCli, type WorkerSetup } from "./main";
import type { FromWorker, PoolWorker } from "./pool";
import type { GameTask } from "./run";
import { serveWorker } from "./worker";

function spawn(setup: WorkerSetup): PoolWorker<GameTask, GameLine> {
  const worker = new Worker(fileURLToPath(import.meta.url), { workerData: setup });
  return {
    onError: (listener) => worker.on("error", listener),
    onMessage: (listener) => worker.on("message", (message: FromWorker<GameLine>) => { listener(message); }),
    post: (message) => { worker.postMessage(message); },
    terminate: () => worker.terminate()
  };
}

if (isMainThread) {
  runCli(process.argv.slice(2), {
    cores: availableParallelism(),
    now: () => new Date(),
    readText: (path) => readFileSync(path, "utf8"),
    sources: scenarioSources(),
    spawn,
    stderr: (text) => process.stderr.write(text),
    stdout: (text) => process.stdout.write(text)
  }).then((code) => {
    process.exitCode = code;
  }, (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
    process.exitCode = 1;
  });
} else if (parentPort !== null) {
  serveWorker(workerData as WorkerSetup, scenarioSources(), parentPort);
}
