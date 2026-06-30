import { rm } from "node:fs/promises";

export default async function globalSetup(): Promise<void> {
  await rm("build/e2e/screenshots", { force: true, recursive: true });
}
