import { z } from "zod";

/**
 * Map package schema (spec version 2). Presentation data only: the engine never reads it.
 * All coordinates are in `viewBox` space; packages are pre-registered to that space by their
 * build pipeline, so the renderer applies no projection.
 */

const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Ids are lowercase kebab-case.");
const point = { x: z.number(), y: z.number() };
const rect = z.strictObject({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() });
const assetPath = z
  .string()
  .regex(/^[\w./-]+\.(svg|png|jpg|webp)$/, "Asset paths are repository-relative .svg, .png, .jpg, or .webp files.")
  .meta({ description: "Repository-relative path to a local asset. Runtime map services are not allowed." });
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
// Numbers are separated by a space, or run together before a minus sign, as the pipeline writes them.
const number = String.raw`-?(?:\d+(?:\.\d+)?|\.\d+)`;
const gap = String.raw`(?: |(?=-))`;
const pair = `${number}${gap}${number}`;
/** Open polylines as SVG path data: one or more `M x y` moves, each followed by relative `l` steps. */
const polyline = z
  .string()
  .regex(new RegExp(`^(?:M${pair}l${pair}(?:${gap}${pair})*)+$`), "Polylines are SVG path data of M moves followed by relative l steps.");
const waterTier = z.enum(["overview", "operational", "detail"]).meta({
  description: "overview: always shown; operational: from the operational zoom; detail: from the detail zoom."
});

export const mapSchema = z
  .strictObject({
    $schema: z.string().optional(),
    specVersion: z.literal(2),
    id: slug,
    viewBox: rect.meta({ description: "Coordinate space for geometry, anchors, and labels." }),
    focus: rect.meta({ description: "Area framed by the camera when a game starts." }),
    background: color.meta({ description: "Fill for space outside the terrain layers; relief layers fade into it at their edges." }),
    geometry: z.strictObject({
      svg: assetPath,
      stripSelectors: z.array(z.string().min(1)).default([])
    }),
    terrain: z
      .strictObject({
        layers: z
          .array(z.strictObject({
            image: assetPath.meta({ description: "Baked relief image with square texels." }),
            bounds: rect.meta({ description: "Area the image covers, in view box units." })
          }))
          .min(1)
          .meta({ description: "Relief images, coarsest first; later layers draw over earlier ones." })
      })
      .optional()
      .meta({ description: "Optional relief, pre-registered to the view box. Without it the renderer draws flat region fills." }),
    regions: z
      .record(z.string().min(1), z.strictObject({ territoryId: slug }))
      .meta({ description: "SVG element id to territory id. Several regions may share one territory." }),
    territories: z.record(
      slug,
      z.strictObject({
        unitAnchor: z.strictObject(point),
        label: z.strictObject({ ...point, tier: z.enum(["overview", "detail"]) }),
        shape: z
          .discriminatedUnion("@type", [
            z
              .strictObject({ "@type": z.literal("circle"), "@data": z.strictObject({ ...point, r: z.number().positive() }) })
              .transform(({ "@data": data }) => ({ kind: "circle" as const, ...data }))
          ])
          .optional()
          .meta({ description: "Drawn and hit-tested when the territory has no SVG region." })
      })
    ),
    subTerritories: z
      .strictObject({
        svg: assetPath.meta({ description: "SVG with one path per sub-territory, its element id the sub-territory id, read even-odd." }),
        entries: z.record(
          slug,
          z.strictObject({
            territoryId: slug.meta({ description: "The territory this sub-territory is part of." }),
            label: z.strictObject(point).meta({ description: "Where the sub-territory name is drawn: inside it, far from its edges." }),
            capital: z.strictObject(point).meta({ description: "The sub-territory's chief town, inside it." })
          })
        )
      })
      .optional()
      .meta({ description: "Optional sub-territories (provinces and scenario splits). Their outer edges follow the territory regions." }),
    cities: z.record(slug, z.strictObject({ ...point, tier: z.enum(["overview", "detail"]) })),
    contextLabels: z.array(z.strictObject({ text: z.string().min(1), ...point })),
    rivers: z
      .array(z.strictObject({
        id: slug,
        name: z.string().min(1),
        rank: z.enum(["main", "tributary"]).meta({ description: "main: drawn at every zoom and labelled; tributary: drawn from the operational zoom." }),
        path: polyline.meta({ description: "The river's course on playable land, downstream." }),
        mouth: polyline.optional().meta({ description: "The final stretch into the sea, drawn tapering." }),
        labelPath: polyline.optional().meta({ description: "Curve the name follows, west to east, from the operational zoom." })
      }))
      .default([])
      .meta({ description: "Rivers: scenery drawn above the territory wash and below the borders. No rules effect." }),
    waterLabels: z
      .array(z.union([
        z.strictObject({ text: z.string().min(1), tier: waterTier, ...point }),
        z.strictObject({
          text: z.string().min(1),
          tier: waterTier,
          paths: z.array(polyline).min(1).meta({ description: "Curves the name may follow, in order of preference; the first that fits on screen is used." })
        })
      ]))
      .default([])
      .meta({ description: "Names of seas, gulfs, and bays: straight at a point, or along a curve." }),
    unitSymbols: z.record(slug, assetPath).meta({ description: "Unit type id to symbol SVG." }),
    attribution: z.array(z.strictObject({ text: z.string().min(1), url: z.url().optional() })).min(1)
  })
  .meta({ title: "Spanish Diplomacy map package", description: "Presentation data interpreted by the map renderer." });

export type MapDocument = z.infer<typeof mapSchema>;
