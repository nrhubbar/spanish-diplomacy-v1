import { type ConnectionHint, savingData } from "../connection";
import type { AudioState } from "../state/audioSlice";
import { parseSettings, type SoundSettings, storageKey } from "../state/soundLevels";

/** Reading the browser's storage can itself throw, so it is asked for each time. */
export type SoundStorage = () => Pick<Storage, "getItem" | "setItem">;

/** The levels this browser kept, for the store to start with: read once, before anything can change them. */
export function storedSound(storage: SoundStorage, connection: ConnectionHint | undefined): AudioState {
  const saving = savingData(connection);
  let raw: string | null = null;
  try {
    raw = storage().getItem(storageKey);
  } catch {
    // Storage is blocked: the defaults apply.
  }
  return { ...parseSettings(raw, saving), savingData: saving };
}

export function keepSound(storage: SoundStorage, { levels, noticeSeen }: SoundSettings): void {
  try {
    storage().setItem(storageKey, JSON.stringify({ levels, noticeSeen }));
  } catch {
    // Storage is full or blocked: the levels last until the page closes.
  }
}
