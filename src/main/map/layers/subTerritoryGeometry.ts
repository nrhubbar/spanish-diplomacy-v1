import { useEffect, useState } from "react";
import type { SubTerritoryId } from "../../engine/types";
import { builtInAssetSources } from "../../scenarios/assetSources";

/**
 * X2: the sub-territory paths live in a separate SVG (D12) that loads only when a map layer
 * first needs it, so neither the initial chunk nor the map's first paint waits for it.
 */
export type SubTerritoryPaths = ReadonlyMap<SubTerritoryId, string>;

const cache = new Map<string, Promise<SubTerritoryPaths>>();
const loaded = new Map<string, SubTerritoryPaths>();

/** One `d` per path element, keyed by its id. The paths are drawn even-odd. */
export function parseSubTerritoryPaths(svg: string): SubTerritoryPaths {
  const paths = new Map<SubTerritoryId, string>();
  for (const match of svg.matchAll(/<path\s+id="([^"]+)"\s+d="([^"]+)"/g)) {
    const [, id, d] = match;
    if (id !== undefined && d !== undefined) paths.set(id as SubTerritoryId, d);
  }
  return paths;
}

/** Repository-relative, as the glob keys are with their leading slash dropped (registry rule). */
const normalizeSourcePath = (path: string): string => path.replace(/^\/+/, "");

type RawLoader = () => Promise<string>;

function loaderFor(svgPath: string, sources: Readonly<Record<string, RawLoader>>): RawLoader | undefined {
  const wanted = normalizeSourcePath(svgPath);
  return Object.entries(sources).find(([path]) => normalizeSourcePath(path) === wanted)?.[1];
}

export function loadSubTerritoryPaths(svgPath: string, sources: Readonly<Record<string, RawLoader>> = builtInAssetSources.rawAssets): Promise<SubTerritoryPaths> {
  const cached = cache.get(svgPath);
  if (cached !== undefined) return cached;
  const load = loaderFor(svgPath, sources);
  const pending = (load === undefined ? Promise.resolve(new Map<SubTerritoryId, string>()) : load().then(parseSubTerritoryPaths))
    .then((paths) => { loaded.set(svgPath, paths); return paths; });
  pending.catch(() => cache.delete(svgPath));
  cache.set(svgPath, pending);
  return pending;
}

/** The paths once loaded; undefined while loading, or when `svgPath` is undefined (no sub-territories, or not needed yet). */
export function useSubTerritoryPaths(svgPath: string | undefined): SubTerritoryPaths | undefined {
  const [paths, setPaths] = useState<SubTerritoryPaths | undefined>(() => (svgPath === undefined ? undefined : loaded.get(svgPath)));
  useEffect(() => {
    if (svgPath === undefined) return undefined;
    let live = true;
    loadSubTerritoryPaths(svgPath).then((result) => { if (live) setPaths(result); }, () => undefined);
    return () => { live = false; };
  }, [svgPath]);
  return svgPath === undefined ? undefined : paths ?? loaded.get(svgPath);
}
