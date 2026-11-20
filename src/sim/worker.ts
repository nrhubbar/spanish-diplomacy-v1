import type { PackageSources } from "./engine";
import type { GameLine } from "./game";
import type { WorkerSetup } from "./main";
import type { FromWorker, ToWorker } from "./pool";
import { createTaskRunner, type GameTask } from "./run";

/** The worker thread's side of the pool: play each task it is sent and post the game back. */
export function serveWorker(
  setup: WorkerSetup,
  sources: readonly PackageSources[],
  port: { on(event: "message", listener: (message: ToWorker<GameTask>) => void): unknown; postMessage(message: FromWorker<GameLine>): void }
): void {
  const run = createTaskRunner(sources, setup.plan);
  port.on("message", (message) => {
    try {
      port.postMessage({ kind: "result", result: run(message.task) });
    } catch (error) {
      port.postMessage({ kind: "failed", message: `seed ${message.task.seed}: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
}
