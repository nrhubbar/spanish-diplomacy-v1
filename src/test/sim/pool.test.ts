import { describe, expect, it } from "vitest";
import { type FromWorker, type PoolWorker, runPool, type ToWorker } from "../../sim/pool";

interface FakeOptions {
  readonly crashOn?: number;
  readonly exitOn?: number;
  readonly failOn?: number;
  readonly delay: (task: number) => number;
}

function fakeWorkers(options: FakeOptions) {
  const terminated: number[] = [];
  let spawned = 0;
  const spawn = (): PoolWorker<number, string> => {
    const id = spawned;
    spawned += 1;
    let onMessage: (message: FromWorker<string>) => void = () => undefined;
    let onError: (error: Error) => void = () => undefined;
    let onExit: (code: number) => void = () => undefined;
    return {
      onError: (listener) => { onError = listener; },
      onExit: (listener) => { onExit = listener; },
      onMessage: (listener) => { onMessage = listener; },
      post: ({ task }: ToWorker<number>) => {
        setTimeout(() => {
          if (task === options.crashOn) onError(new Error("worker crashed"));
          else if (task === options.exitOn) onExit(3);
          else if (task === options.failOn) onMessage({ kind: "failed", message: `task ${task} failed` });
          else onMessage({ kind: "result", result: `t${task}` });
        }, options.delay(task));
      },
      terminate: () => {
        terminated.push(id);
        onExit(1);
        return Promise.resolve(0);
      }
    };
  };
  return { spawn, spawned: () => spawned, terminated };
}

describe("worker pool", () => {
  it("returns results in task order whatever order the workers finish in", async () => {
    const fake = fakeWorkers({ delay: (task) => (task % 3) * 3 });
    const progress: number[] = [];
    const results = await runPool([0, 1, 2, 3, 4, 5, 6], 3, fake.spawn, (done) => progress.push(done));
    expect(results).toEqual(["t0", "t1", "t2", "t3", "t4", "t5", "t6"]);
    expect(progress).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fake.spawned()).toBe(3);
    expect(fake.terminated).toHaveLength(3);
  });

  it("never starts more workers than tasks, and none for no tasks", async () => {
    const fake = fakeWorkers({ delay: () => 0 });
    expect(await runPool([1], 8, fake.spawn)).toEqual(["t1"]);
    expect(fake.spawned()).toBe(1);
    expect(await runPool([], 8, fake.spawn)).toEqual([]);
    expect(fake.spawned()).toBe(1);
  });

  it("stops every worker on the first failure", async () => {
    const failing = fakeWorkers({ delay: (task) => task, failOn: 2 });
    await expect(runPool([0, 1, 2, 3, 4], 2, failing.spawn)).rejects.toThrow("task 2 failed");
    expect(failing.terminated).toHaveLength(2);
    const crashing = fakeWorkers({ crashOn: 0, delay: () => 0 });
    await expect(runPool([0, 1], 2, crashing.spawn)).rejects.toThrow("worker crashed");
  });

  it("rejects instead of hanging when a worker exits with a game unfinished", async () => {
    const exiting = fakeWorkers({ delay: () => 0, exitOn: 1 });
    await expect(runPool([0, 1, 2], 2, exiting.spawn)).rejects.toThrow("A worker thread exited (code 3) with game 2 of 3 unfinished.");
    expect(exiting.terminated).toHaveLength(2);
  });
});
