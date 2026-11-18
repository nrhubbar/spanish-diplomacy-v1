// Grid operations for baking terrain: sampling, distance fields, blur, and shading. Every grid
// is a row-major Float32Array with an explicit width and height.

export interface Grid {
  readonly data: Float32Array;
  readonly height: number;
  readonly width: number;
}

export function createGrid(width: number, height: number): Grid {
  return { data: new Float32Array(width * height), height, width };
}

function cubic(a: number, b: number, c: number, d: number, t: number): number {
  // Catmull-Rom: passes through the samples, so source values are preserved.
  return b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
}

/** Catmull-Rom bicubic sample at continuous coordinates where (0, 0) is the first texel centre. */
export function sampleBicubic(grid: Grid, x: number, y: number): number {
  const { data, height, width } = grid;
  const baseX = Math.floor(x);
  const baseY = Math.floor(y);
  const tx = x - baseX;
  const ty = y - baseY;
  const rows: number[] = [];
  for (let row = -1; row <= 2; row += 1) {
    const sy = Math.min(height - 1, Math.max(0, baseY + row)) * width;
    const at = (column: number): number => data[sy + Math.min(width - 1, Math.max(0, baseX + column))] ?? 0;
    rows.push(cubic(at(-1), at(0), at(1), at(2), tx));
  }
  return cubic(rows[0] ?? 0, rows[1] ?? 0, rows[2] ?? 0, rows[3] ?? 0, ty);
}

/** One-dimensional squared distance transform of a sampled function (Felzenszwalb and Huttenlocher 2012). */
function transform1d(f: Float32Array, n: number, d: Float32Array, v: Int32Array, z: Float32Array): void {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q += 1) {
    let s: number;
    for (;;) {
      const p = v[k] ?? 0;
      s = ((f[q] ?? 0) + q * q - ((f[p] ?? 0) + p * p)) / (2 * q - 2 * p);
      if (s > (z[k] ?? 0) || k === 0) break;
      k -= 1;
    }
    if (s <= (z[k] ?? 0)) {
      v[0] = q;
      z[0] = -Infinity;
      z[1] = Infinity;
      k = 0;
      continue;
    }
    k += 1;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q += 1) {
    while ((z[k + 1] ?? Infinity) < q) k += 1;
    const p = v[k] ?? 0;
    d[q] = (q - p) * (q - p) + (f[p] ?? 0);
  }
}

/** Euclidean distance, in texels, from every texel to the nearest texel where `inside` is true. */
export function distanceField(width: number, height: number, inside: (index: number) => boolean): Float32Array {
  const huge = 1e20;
  const field = new Float32Array(width * height);
  for (let index = 0; index < field.length; index += 1) field[index] = inside(index) ? 0 : huge;
  const size = Math.max(width, height);
  const f = new Float32Array(size);
  const d = new Float32Array(size);
  const v = new Int32Array(size);
  const z = new Float32Array(size + 1);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) f[y] = field[y * width + x] ?? huge;
    transform1d(f, height, d, v, z);
    for (let y = 0; y < height; y += 1) field[y * width + x] = d[y] ?? huge;
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) f[x] = field[y * width + x] ?? huge;
    transform1d(f, width, d, v, z);
    for (let x = 0; x < width; x += 1) field[y * width + x] = Math.sqrt(d[x] ?? huge);
  }
  return field;
}

/** Separable box blur, applied three times (a close approximation of a Gaussian of sigma ~ radius). */
export function blur(grid: Grid, radius: number): Grid {
  const { height, width } = grid;
  let source = Float32Array.from(grid.data);
  let target = new Float32Array(source.length);
  const r = Math.max(1, Math.round(radius));
  const pass = (horizontal: boolean): void => {
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    const stride = horizontal ? 1 : width;
    for (let line = 0; line < lines; line += 1) {
      const start = horizontal ? line * width : line;
      const at = (position: number): number => source[start + Math.min(length - 1, Math.max(0, position)) * stride] ?? 0;
      let sum = 0;
      for (let offset = -r; offset <= r; offset += 1) sum += at(offset);
      for (let position = 0; position < length; position += 1) {
        target[start + position * stride] = sum / (2 * r + 1);
        sum += at(position + r + 1) - at(position - r);
      }
    }
    [source, target] = [target, source];
  };
  for (let iteration = 0; iteration < 3; iteration += 1) {
    pass(true);
    pass(false);
  }
  return { data: source, height, width };
}

export interface Light {
  /** Compass direction the light comes from, degrees clockwise from north. */
  readonly azimuth: number;
  /** Angle above the horizon, degrees. */
  readonly altitude: number;
  readonly weight: number;
}

/**
 * Lambertian shading of a height field (metres) on a square grid (`cellSize` metres), with
 * Horn's 3x3 gradient. Returns brightness in [0, 1] where flat ground under a single 45-degree
 * light is cos(45) ~ 0.71. Several weighted lights give a multi-directional hillshade.
 */
export function hillshade(elevation: Grid, cellSize: number, exaggeration: number, lights: readonly Light[]): Float32Array {
  const { data, height, width } = elevation;
  const output = new Float32Array(width * height);
  const total = lights.reduce((sum, light) => sum + light.weight, 0);
  const vectors = lights.map((light) => {
    const azimuth = light.azimuth * Math.PI / 180;
    const altitude = light.altitude * Math.PI / 180;
    return {
      weight: light.weight / total,
      x: Math.sin(azimuth) * Math.cos(altitude),
      y: Math.cos(azimuth) * Math.cos(altitude),
      z: Math.sin(altitude)
    };
  });
  const at = (x: number, y: number): number => data[Math.min(height - 1, Math.max(0, y)) * width + Math.min(width - 1, Math.max(0, x))] ?? 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const a = at(x - 1, y - 1);
      const b = at(x, y - 1);
      const c = at(x + 1, y - 1);
      const d = at(x - 1, y);
      const f = at(x + 1, y);
      const g = at(x - 1, y + 1);
      const h = at(x, y + 1);
      const i = at(x + 1, y + 1);
      // East-positive and north-positive slopes (grid rows grow southward).
      const east = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * cellSize) * exaggeration;
      const north = ((a + 2 * b + c) - (g + 2 * h + i)) / (8 * cellSize) * exaggeration;
      const length = Math.hypot(east, north, 1);
      let light = 0;
      for (const vector of vectors) light += vector.weight * Math.max(0, (-east * vector.x - north * vector.y + vector.z) / length);
      output[y * width + x] = light;
    }
  }
  return output;
}

export type Color = readonly [number, number, number];

/** Linear interpolation through sorted (value, color) stops, clamped at both ends. */
export function colorRamp(stops: readonly (readonly [number, Color])[], value: number): Color {
  const first = stops[0];
  const last = stops[stops.length - 1];
  if (first === undefined || last === undefined) throw new Error("A color ramp needs stops.");
  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];
  for (let index = 1; index < stops.length; index += 1) {
    const [upper, upperColor] = stops[index] as readonly [number, Color];
    const [lower, lowerColor] = stops[index - 1] as readonly [number, Color];
    if (value <= upper) {
      const t = (value - lower) / (upper - lower);
      return [
        lowerColor[0] + (upperColor[0] - lowerColor[0]) * t,
        lowerColor[1] + (upperColor[1] - lowerColor[1]) * t,
        lowerColor[2] + (upperColor[2] - lowerColor[2]) * t
      ];
    }
  }
  return last[1];
}

/** Smooth Hermite step between two edges. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
