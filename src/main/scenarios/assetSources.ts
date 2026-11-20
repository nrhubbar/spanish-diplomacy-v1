import type { PackageSources } from "./registry";

/** Map assets for every shipped package, always loaded on demand (map screens). */
export const builtInAssetSources: Pick<PackageSources, "rawAssets" | "urlAssets"> = {
  rawAssets: import.meta.glob<string>(["/assets/maps/**/*.svg", "/assets/icons/**/*.svg"], {
    import: "default",
    query: "?raw"
  }),
  urlAssets: import.meta.glob<string>("/assets/maps/**/*.{png,jpg,webp}", { import: "default", query: "?url" })
};
