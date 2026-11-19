/** Collects loader issues, each naming its JSON path and rule id. */
export interface Issues {
  readonly list: string[];
  /** L2: every id in `items` is unique within `name`. */
  unique(name: string, items: readonly { readonly id: string }[]): void;
  /** L3: `id` names a known record of `kind`. */
  ref(path: string, id: string, known: ReadonlySet<string> | ReadonlyMap<string, unknown>, kind: string): void;
  add(issue: string): void;
}

export function createIssues(): Issues {
  const list: string[] = [];
  return {
    list,
    add: (issue) => { list.push(issue); },
    ref: (path, id, known, kind) => {
      if (!known.has(id)) list.push(`${path}: unknown ${kind} "${id}" (L3)`);
    },
    unique: (name, items) => {
      for (const id of duplicates(items.map((item) => item.id))) list.push(`${name}: duplicate id "${id}" (L2)`);
    }
  };
}

export function duplicates(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

export function idSet(items: readonly { readonly id: string }[]): ReadonlySet<string> {
  return new Set(items.map((item) => item.id));
}

/** L20, L25: bands of a d20 table run strictly upward and end at 20. */
export function bandsCoverD20(bands: readonly { readonly upTo: number }[]): boolean {
  return bands.every((band, index) => index === 0 || band.upTo > (bands[index - 1]?.upTo ?? 0)) && bands.at(-1)?.upTo === 20;
}
