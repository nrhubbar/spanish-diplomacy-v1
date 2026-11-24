/** What the browser says of its connection (`navigator.connection`; Chromium only, so a hint). */
export interface ConnectionHint {
  readonly effectiveType?: string;
  readonly saveData?: boolean;
}

/** The player's connection hint; undefined where the browser gives none. */
export function connectionHint(from: Navigator = navigator): ConnectionHint | undefined {
  return (from as { readonly connection?: ConnectionHint }).connection;
}

/** The browser asks to save data, or is on a slow phone network: large downloads wait until asked for. */
export function savingData(connection: ConnectionHint | undefined): boolean {
  return connection?.saveData === true || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");
}
