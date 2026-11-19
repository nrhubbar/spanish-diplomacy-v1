/** Messages between the CLI and its worker threads. */
export type ToWorker<Task> = { readonly kind: "task"; readonly task: Task };
export type FromWorker<Result> =
  | { readonly kind: "result"; readonly result: Result }
  | { readonly kind: "failed"; readonly message: string };

/** The part of a worker thread the pool uses, so tests can stand one in. */
export interface PoolWorker<Task, Result> {
  onError(listener: (error: Error) => void): void;
  onMessage(listener: (message: FromWorker<Result>) => void): void;
  post(message: ToWorker<Task>): void;
  terminate(): Promise<unknown>;
}

/**
 * Hands tasks to `size` workers one at a time, the next task going to whichever worker
 * finishes first. Results come back in task order whatever the finishing order. The first
 * failure stops every worker and rejects.
 */
export async function runPool<Task, Result>(
  tasks: readonly Task[],
  size: number,
  spawn: () => PoolWorker<Task, Result>,
  onProgress?: (done: number, total: number) => void
): Promise<Result[]> {
  const results: Result[] = new Array<Result>(tasks.length);
  if (tasks.length === 0) return results;
  const workers: PoolWorker<Task, Result>[] = [];
  let next = 0;
  let done = 0;
  let failed = false;
  try {
    await new Promise<void>((resolve, reject) => {
      const fail = (error: Error) => {
        if (failed) return;
        failed = true;
        reject(error);
      };
      const feed = (worker: PoolWorker<Task, Result>, slot: { index: number }) => {
        const task = tasks[next];
        if (task === undefined) return;
        slot.index = next;
        next += 1;
        worker.post({ kind: "task", task });
      };
      for (let count = 0; count < Math.max(1, Math.min(size, tasks.length)); count += 1) {
        const worker = spawn();
        const slot = { index: -1 };
        workers.push(worker);
        worker.onError(fail);
        worker.onMessage((message) => {
          if (failed) return;
          if (message.kind === "failed") {
            fail(new Error(message.message));
            return;
          }
          results[slot.index] = message.result;
          done += 1;
          onProgress?.(done, tasks.length);
          if (done === tasks.length) resolve();
          else feed(worker, slot);
        });
        feed(worker, slot);
      }
    });
  } finally {
    await Promise.all(workers.map((worker) => worker.terminate()));
  }
  return results;
}
