/**
 * Variant patches (H4): a subset of RFC 6902 JSON Patch over the raw `scenario.json`. The
 * operations are `add`, `remove`, `replace` and `test`; `test` guards an array index against
 * a reordered scenario. Paths are RFC 6901 JSON Pointers (`~1` for `/`, `~0` for `~`).
 */
export type PatchOperation =
  | { readonly op: "add" | "replace" | "test"; readonly path: string; readonly value: unknown }
  | { readonly op: "remove"; readonly path: string };

const operations = new Set(["add", "remove", "replace", "test"]);

export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks that a parsed JSON value is a list of supported patch operations. */
export function parsePatch(value: unknown, source: string): readonly PatchOperation[] {
  if (!Array.isArray(value)) throw new PatchError(`${source}: a patch is a JSON array of operations.`);
  return value.map((entry: unknown, index): PatchOperation => {
    if (!isRecord(entry) || typeof entry["op"] !== "string" || !operations.has(entry["op"])) {
      throw new PatchError(`${source}[${index}]: "op" must be one of add, remove, replace, test.`);
    }
    const { op, path } = entry;
    if (typeof path !== "string" || (path !== "" && !path.startsWith("/"))) {
      throw new PatchError(`${source}[${index}]: "path" must be a JSON Pointer such as "/combat/diggingIn/max".`);
    }
    if (op === "remove") return { op, path };
    if (!("value" in entry)) throw new PatchError(`${source}[${index}]: "${op}" needs a "value".`);
    return { op: op as "add" | "replace" | "test", path, value: entry["value"] };
  });
}

function tokens(path: string): string[] {
  return path === "" ? [] : path.slice(1).split("/").map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function arrayIndex(container: unknown[], token: string, path: string, allowEnd: boolean): number {
  if (allowEnd && token === "-") return container.length;
  const index = /^(0|[1-9][0-9]*)$/.test(token) ? Number(token) : Number.NaN;
  if (!Number.isInteger(index) || index > container.length || (!allowEnd && index === container.length)) {
    throw new PatchError(`${path}: index "${token}" is out of range.`);
  }
  return index;
}

function child(container: unknown, token: string, path: string): unknown {
  if (Array.isArray(container)) return container[arrayIndex(container, token, path, false)];
  if (isRecord(container) && Object.hasOwn(container, token)) return container[token];
  throw new PatchError(`${path}: "${token}" does not exist.`);
}

function equal(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((item, index) => equal(item, b[index]));
  if (isRecord(a) && isRecord(b)) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]));
  }
  return a === b;
}

function applyOne(document: unknown, operation: PatchOperation): unknown {
  const path = tokens(operation.path);
  const last = path.pop();
  if (last === undefined) {
    if (operation.op === "remove") throw new PatchError(`"": the whole document cannot be removed.`);
    if (operation.op === "test") {
      if (!equal(document, operation.value)) throw new PatchError(`"": test failed.`);
      return document;
    }
    return structuredClone(operation.value);
  }
  const parent = path.reduce((node, token) => child(node, token, operation.path), document);
  if (operation.op === "test") {
    if (!equal(child(parent, last, operation.path), operation.value)) throw new PatchError(`${operation.path}: test failed.`);
    return document;
  }
  if (Array.isArray(parent)) {
    if (operation.op === "add") {
      parent.splice(arrayIndex(parent, last, operation.path, true), 0, structuredClone(operation.value));
    } else {
      const index = arrayIndex(parent, last, operation.path, false);
      if (operation.op === "remove") parent.splice(index, 1);
      else parent[index] = structuredClone(operation.value);
    }
    return document;
  }
  if (!isRecord(parent)) throw new PatchError(`${operation.path}: the parent is not an object or array.`);
  if (operation.op !== "add" && !Object.hasOwn(parent, last)) throw new PatchError(`${operation.path}: "${last}" does not exist.`);
  if (operation.op === "remove") Reflect.deleteProperty(parent, last);
  else parent[last] = structuredClone(operation.value);
  return document;
}

/** Applies a patch to a copy of `document`. Throws a `PatchError` naming the failing path. */
export function applyPatch(document: unknown, patch: readonly PatchOperation[]): unknown {
  return patch.reduce(applyOne, structuredClone(document));
}

/** A variant file's contents: a name, an optional description, and its patch. */
export interface VariantFile {
  readonly description?: string;
  readonly name: string;
  readonly patch: readonly PatchOperation[];
}

/**
 * Reads a variant file: either `{ "name", "description", "patch": [...] }` or a bare patch
 * array, which takes its name from the file name.
 */
export function parseVariantFile(value: unknown, fileName: string): VariantFile {
  const fallback = fileName.replace(/^.*[\\/]/, "").replace(/\.json$/i, "");
  if (Array.isArray(value)) return { name: fallback, patch: parsePatch(value, fileName) };
  if (!isRecord(value)) throw new PatchError(`${fileName}: a variant is a patch array or an object with "patch".`);
  const { description, name } = value;
  if (name !== undefined && (typeof name !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(name))) {
    throw new PatchError(`${fileName}: "name" must be lowercase letters, digits and hyphens.`);
  }
  if (description !== undefined && typeof description !== "string") throw new PatchError(`${fileName}: "description" must be a string.`);
  return {
    ...(description === undefined ? {} : { description }),
    name: name ?? fallback,
    patch: parsePatch(value["patch"], `${fileName} patch`)
  };
}
