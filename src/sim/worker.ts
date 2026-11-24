import type { PackageSources } from "./engine";
import type { WorkerSetup } from "./main";
import type { FromWorker, ToWorker } from "./pool";
import { createTimedRunner, type GameTask, type PlayedGame } from "./run";

/** The worker thread's side of the pool: play each task it is sent and post the game back, timed by `clock` (milliseconds). */
export function serveWorker(
  setup: WorkerSetup,
  sources: readonly PackageSources[],
  port: { on(event: "message", listener: (message: ToWorker<GameTask>) => void): unknown; postMessage(message: FromWorker<PlayedGame>): void },
  clock: () => number
): void {
  const run = createTimedRunner(sources, setup.plan, clock);
  port.on("message", (message) => {
    try {
      port.postMessage({ kind: "result", result: { ...run(message.task), worker: setup.worker } });
    } catch (error) {
      port.postMessage({ kind: "failed", message: `seed ${message.task.seed}: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}
