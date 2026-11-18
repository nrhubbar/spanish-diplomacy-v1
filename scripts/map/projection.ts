// Map projection shared by every layer of a generated map package. Terrain rasters, region
// geometry, cities, anchors, and labels all pass through the same function, so they agree by
// construction. Map units are kilometres; x grows east and y grows south (SVG convention).

export interface LambertConformalConic {
  /** Latitude of the projection origin, degrees. */
  readonly originLatitude: number;
  /** Central meridian, degrees. */
  readonly centralMeridian: number;
  /** The two standard parallels, degrees. Scale is true along both. */
  readonly standardParallels: readonly [number, number];
  /** Sphere radius in kilometres. */
  readonly radius: number;
}

export interface Projection {
  readonly forward: (longitude: number, latitude: number) => { readonly x: number; readonly y: number };
  readonly inverse: (x: number, y: number) => { readonly latitude: number; readonly longitude: number };
}

const degree = Math.PI / 180;
const halfPi = Math.PI / 2;

/** Spherical Lambert conformal conic (Snyder, Map Projections: A Working Manual, eq. 15-1 to 15-5). */
export function lambertConformalConic(definition: LambertConformalConic): Projection {
  const [first, second] = definition.standardParallels.map((value) => value * degree) as [number, number];
  const origin = definition.originLatitude * degree;
  const meridian = definition.centralMeridian * degree;
  const tangent = (latitude: number): number => Math.tan(Math.PI / 4 + latitude / 2);
  const cone = first === second
    ? Math.sin(first)
    : Math.log(Math.cos(first) / Math.cos(second)) / Math.log(tangent(second) / tangent(first));
  const scale = definition.radius * Math.cos(first) * tangent(first) ** cone / cone;
  const originRadius = scale / tangent(origin) ** cone;

  return {
    forward: (longitude, latitude) => {
      const radius = scale / tangent(latitude * degree) ** cone;
      const theta = cone * (longitude * degree - meridian);
      return { x: radius * Math.sin(theta), y: radius * Math.cos(theta) - originRadius };
    },
    inverse: (x, y) => {
      const northing = originRadius + y;
      const radius = Math.sign(cone) * Math.hypot(x, northing);
      const theta = Math.atan2(Math.sign(cone) * x, Math.sign(cone) * northing);
      return {
        latitude: (2 * Math.atan((scale / radius) ** (1 / cone)) - halfPi) / degree,
        longitude: (meridian + theta / cone) / degree
      };
    }
  };
}

/** Longitude/latitude to Web Mercator pixel coordinates at a tile zoom (256-pixel tiles). */
export function webMercatorPixel(longitude: number, latitude: number, zoom: number): { readonly x: number; readonly y: number } {
  const size = 256 * 2 ** zoom;
  const phi = latitude * degree;
  return {
    x: (longitude + 180) / 360 * size,
    y: (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * size
  };
}
