import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const geoBoundariesRevision = "9469f09";
const geoBoundariesRoot = `https://github.com/wmgeolab/geoBoundaries/raw/${geoBoundariesRevision}/releaseData/gbOpen/ESP`;
const sourceNames = {
  ES11: "Galicia",
  ES12: "Principado de Asturias",
  ES13: "Cantabria",
  ES21: "País Vasco/Euskadi",
  ES22: "Comunidad Foral de Navarra",
  ES23: "La Rioja",
  ES24: "Aragón",
  ES30: "Comunidad de Madrid",
  ES41: "Castilla y León",
  ES42: "Castilla-La Mancha",
  ES43: "Extremadura",
  ES51: "Cataluña/Catalunya",
  ES52: "Comunitat Valenciana",
  ES53: "Illes Balears",
  ES61: "Andalucía",
  ES62: "Región de Murcia"
};

async function fetchGeoJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to download ${url}: ${response.status}`);
  return response.json();
}

const [terrainBytes, national, administrativeRegions] = await Promise.all([
  readFile(new URL("assets/maps/iberia-relief-aligned.jpg", root)),
  fetchGeoJson(`${geoBoundariesRoot}/ADM0/geoBoundaries-ESP-ADM0_simplified.geojson`),
  fetchGeoJson(`${geoBoundariesRoot}/ADM1/geoBoundaries-ESP-ADM1_simplified.geojson`)
]);
const regions = Object.entries(sourceNames).map(([id, sourceName]) => {
  const feature = administrativeRegions.features.find(
    (candidate) => candidate.properties.shapeName === sourceName
  );
  if (feature === undefined) throw new Error(`Missing geoBoundaries region ${sourceName}`);
  return { geometry: { type: "FeatureCollection", features: [feature] }, id };
});
const terrainUrl = `data:image/jpeg;base64,${terrainBytes.toString("base64")}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const result = await page.evaluate(async ({ national, regions, terrainUrl }) => {
  const size = 1024;
  const viewBox = { x: 238, y: 515, width: 225, height: 225 };
  const image = await new Promise((resolve, reject) => {
    const candidate = new Image();
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error("Unable to load relief texture"));
    candidate.src = terrainUrl;
  });
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;

  const targetBoundary = new Uint8Array(size * size);
  const landMask = new Uint8Array(size * size);
  const isLand = (offset) => {
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    return Math.max(red, green) > blue * 1.04 && red + green > 90;
  };
  const isBlueLine = (offset) => {
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    return blue > red * 1.24 && blue > green * 1.16 && red < 125 && green < 150;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelIndex = y * size + x;
      const offset = pixelIndex * 4;
      landMask[pixelIndex] = isLand(offset) ? 1 : 0;
      if (isBlueLine(offset)) targetBoundary[pixelIndex] = 1;
    }
  }
  for (let y = 3; y < size - 3; y += 1) {
    for (let x = 3; x < size - 3; x += 1) {
      const pixelIndex = y * size + x;
      if (landMask[pixelIndex] === 0) continue;
      if (
        landMask[pixelIndex - 3] === 0
        || landMask[pixelIndex + 3] === 0
        || landMask[pixelIndex - size * 3] === 0
        || landMask[pixelIndex + size * 3] === 0
      ) targetBoundary[pixelIndex] = 1;
    }
  }
  const expandedBoundary = targetBoundary.slice();
  const expansionRadius = 8;
  for (let y = expansionRadius; y < size - expansionRadius; y += 1) {
    for (let x = expansionRadius; x < size - expansionRadius; x += 1) {
      if (targetBoundary[y * size + x] === 1) continue;
      let found = false;
      for (let deltaY = -expansionRadius; deltaY <= expansionRadius && !found; deltaY += 2) {
        for (let deltaX = -expansionRadius; deltaX <= expansionRadius; deltaX += 2) {
          if (targetBoundary[(y + deltaY) * size + x + deltaX] === 1) {
            found = true;
            break;
          }
        }
      }
      if (found) expandedBoundary[y * size + x] = 1;
    }
  }

  const polygonRings = (featureCollection) => {
    const output = [];
    for (const feature of featureCollection.features) {
      const { coordinates, type } = feature.geometry;
      if (type === "Polygon") output.push(...coordinates);
      if (type === "MultiPolygon") {
        for (const polygon of coordinates) output.push(...polygon);
      }
    }
    return output;
  };
  const inIberia = ([longitude, latitude]) => (
    longitude > -10.5 && longitude < 4.6 && latitude > 35.4 && latitude < 44.6
  );
  const boundaryPoints = polygonRings(national)
    .flatMap((ring) => ring.filter(inIberia).filter((_, index) => index % 2 === 0));
  const project = ([longitude, latitude], transform) => ({
    x: longitude * transform.scaleX + latitude * transform.shearX + transform.translateX,
    y: longitude * transform.shearY + latitude * transform.scaleY + transform.translateY
  });
  const score = (transform) => {
    let matches = 0;
    let landMatches = 0;
    let visible = 0;
    for (const coordinate of boundaryPoints) {
      const position = project(coordinate, transform);
      const x = Math.round(position.x);
      const y = Math.round(position.y);
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      visible += 1;
      matches += expandedBoundary[y * size + x];
      landMatches += landMask[y * size + x];
    }
    if (visible === 0) return 0;
    const boundaryFit = matches / visible;
    const landFit = landMatches / visible;
    const visibility = visible / boundaryPoints.length;
    const geographicControlPoints = [
      // Approximate relief pixels for Spain's four geographic extremes. These
      // keep the optimizer out of false matches against rivers and coastlines
      // elsewhere in the image while the boundary mask supplies the fine fit.
      { coordinate: [-9.30, 43.05], pixel: [220, 205] },
      { coordinate: [3.32, 42.32], pixel: [958, 300] },
      { coordinate: [-7.70, 43.79], pixel: [285, 130] },
      { coordinate: [-5.61, 36.00], pixel: [425, 870] }
    ];
    const controlError = geographicControlPoints.reduce((total, control) => {
      const projected = project(control.coordinate, transform);
      return total + Math.hypot(projected.x - control.pixel[0], projected.y - control.pixel[1]);
    }, 0) / geographicControlPoints.length;
    const controlFit = Math.max(0, 1 - controlError / 180);
    return boundaryFit * 0.62 + landFit * 0.12 + visibility * 0.06 + controlFit * 0.20;
  };

  let best = {
    scaleX: 60,
    scaleY: -94,
    shearX: 0,
    shearY: 0,
    translateX: 760,
    translateY: 4225
  };
  let bestScore = score(best);
  let randomState = 0x19360718;
  const random = () => {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  let step = { scale: 8, shear: 1.5, translateX: 90, translateY: 180 };
  for (let generation = 0; generation < 11; generation += 1) {
    for (let candidateIndex = 0; candidateIndex < 1600; candidateIndex += 1) {
      const candidate = {
        scaleX: best.scaleX + (random() * 2 - 1) * step.scale,
        scaleY: best.scaleY + (random() * 2 - 1) * step.scale,
        shearX: best.shearX + (random() * 2 - 1) * step.shear,
        shearY: best.shearY + (random() * 2 - 1) * step.shear,
        translateX: best.translateX + (random() * 2 - 1) * step.translateX,
        translateY: best.translateY + (random() * 2 - 1) * step.translateY
      };
      if (
        candidate.scaleX < 54 || candidate.scaleX > 68
        || candidate.scaleY > -88 || candidate.scaleY < -106
        || candidate.translateX < 700 || candidate.translateX > 830
        || candidate.translateY < 4080 || candidate.translateY > 4450
        || Math.abs(candidate.shearX) > 3 || Math.abs(candidate.shearY) > 3
      ) continue;
      const candidateScore = score(candidate);
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    }
    step = {
      scale: step.scale * 0.58,
      shear: step.shear * 0.58,
      translateX: step.translateX * 0.58,
      translateY: step.translateY * 0.58
    };
  }

  const distanceToSegmentSquared = (point, start, end) => {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    if (segmentX === 0 && segmentY === 0) {
      return (point.x - start.x) ** 2 + (point.y - start.y) ** 2;
    }
    const ratio = Math.max(0, Math.min(1, (
      (point.x - start.x) * segmentX + (point.y - start.y) * segmentY
    ) / (segmentX ** 2 + segmentY ** 2)));
    const projectedX = start.x + ratio * segmentX;
    const projectedY = start.y + ratio * segmentY;
    return (point.x - projectedX) ** 2 + (point.y - projectedY) ** 2;
  };
  const simplifyProjectedRing = (ring) => {
    const projected = ring.filter(inIberia).map((coordinate) => project(coordinate, best));
    const first = projected[0];
    const last = projected[projected.length - 1];
    if (first !== undefined && last !== undefined && first.x === last.x && first.y === last.y) {
      projected.pop();
    }
    if (projected.length < 4) return projected;
    const keep = new Uint8Array(projected.length);
    keep[0] = 1;
    keep[projected.length - 1] = 1;
    const stack = [[0, projected.length - 1]];
    const toleranceSquared = 0.35 ** 2;
    while (stack.length > 0) {
      const [startIndex, endIndex] = stack.pop();
      let furthestDistance = 0;
      let furthestIndex = -1;
      for (let index = startIndex + 1; index < endIndex; index += 1) {
        const distance = distanceToSegmentSquared(
          projected[index], projected[startIndex], projected[endIndex]
        );
        if (distance > furthestDistance) {
          furthestDistance = distance;
          furthestIndex = index;
        }
      }
      if (furthestIndex !== -1 && furthestDistance > toleranceSquared) {
        keep[furthestIndex] = 1;
        stack.push([startIndex, furthestIndex], [furthestIndex, endIndex]);
      }
    }
    return projected.filter((_, index) => keep[index] === 1);
  };
  const pathForGeometry = (featureCollection) => polygonRings(featureCollection)
    .map((ring) => {
      const simplified = simplifyProjectedRing(ring);
      if (simplified.length < 3) return "";
      return simplified.map((pixel, index) => {
        const x = viewBox.x + pixel.x / size * viewBox.width;
        const y = viewBox.y + pixel.y / size * viewBox.height;
        return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(" ") + " Z";
    })
    .filter(Boolean)
    .join(" ");
  const paths = regions.map((region) => (
    `<path id="${region.id}" d="${pathForGeometry(region.geometry)}" fill-rule="evenodd"/>`
  )).join("");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}">`,
    `<g id="map-group">${paths}</g>`,
    "</svg>"
  ].join("");

  const spainMaskCanvas = document.createElement("canvas");
  spainMaskCanvas.width = size;
  spainMaskCanvas.height = size;
  const spainMaskContext = spainMaskCanvas.getContext("2d");
  spainMaskContext.fillStyle = "#fff";
  for (const region of regions) {
    spainMaskContext.beginPath();
    for (const ring of polygonRings(region.geometry)) {
      const filtered = ring.filter(inIberia);
      filtered.forEach((coordinate, index) => {
        const position = project(coordinate, best);
        if (index === 0) spainMaskContext.moveTo(position.x, position.y);
        else spainMaskContext.lineTo(position.x, position.y);
      });
      spainMaskContext.closePath();
    }
    spainMaskContext.fill("evenodd");
  }
  const spainMask = spainMaskContext.getImageData(0, 0, size, size).data;
  const neutralCanvas = document.createElement("canvas");
  neutralCanvas.width = size;
  neutralCanvas.height = size;
  const neutralContext = neutralCanvas.getContext("2d");
  const neutralImage = neutralContext.createImageData(size, size);
  for (let pixelIndex = 0; pixelIndex < landMask.length; pixelIndex += 1) {
    const offset = pixelIndex * 4;
    if (landMask[pixelIndex] === 0 || spainMask[offset + 3] > 128) continue;
    neutralImage.data[offset] = 127;
    neutralImage.data[offset + 1] = 130;
    neutralImage.data[offset + 2] = 128;
    neutralImage.data[offset + 3] = 150;
  }
  neutralContext.putImageData(neutralImage, 0, 0);

  context.save();
  context.lineJoin = "round";
  context.lineWidth = 2;
  for (const region of regions) {
    context.beginPath();
    for (const ring of polygonRings(region.geometry)) {
      const filtered = ring.filter(inIberia);
      filtered.forEach((coordinate, index) => {
        const position = project(coordinate, best);
        if (index === 0) context.moveTo(position.x, position.y);
        else context.lineTo(position.x, position.y);
      });
      context.closePath();
    }
    context.strokeStyle = "rgba(255,255,255,.92)";
    context.stroke();
  }
  context.restore();

  const ringArea = (ring) => Math.abs(ring.reduce((total, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return total + point[0] * next[1] - next[0] * point[1];
  }, 0) / 2);
  const ringCentroid = (ring) => {
    let areaAccumulator = 0;
    let xAccumulator = 0;
    let yAccumulator = 0;
    ring.forEach((point, index) => {
      const next = ring[(index + 1) % ring.length];
      const cross = point[0] * next[1] - next[0] * point[1];
      areaAccumulator += cross;
      xAccumulator += (point[0] + next[0]) * cross;
      yAccumulator += (point[1] + next[1]) * cross;
    });
    if (Math.abs(areaAccumulator) < 1e-8) return ring[Math.floor(ring.length / 2)];
    return [xAccumulator / (3 * areaAccumulator), yAccumulator / (3 * areaAccumulator)];
  };
  const anchors = Object.fromEntries(regions.map((region) => {
    const mainRing = polygonRings(region.geometry)
      .filter((ring) => ring.some(inIberia))
      .sort((left, right) => ringArea(right) - ringArea(left))[0];
    const coordinate = ringCentroid(mainRing);
    const pixel = project(coordinate, best);
    return [region.id, {
      x: Number((viewBox.x + pixel.x / size * viewBox.width).toFixed(1)),
      y: Number((viewBox.y + pixel.y / size * viewBox.height).toFixed(1))
    }];
  }));
  return {
    anchors,
    neutralUrl: neutralCanvas.toDataURL("image/png"),
    previewUrl: canvas.toDataURL("image/png"),
    score: bestScore,
    svg,
    transform: best
  };
}, { national, regions, terrainUrl });

await mkdir(new URL("build/e2e/", root), { recursive: true });
await writeFile(new URL("assets/maps/iberia-registered.svg", root), result.svg);
await writeFile(
  new URL("build/e2e/geography-registration-preview.png", root),
  Buffer.from(result.previewUrl.split(",")[1], "base64")
);
await writeFile(
  new URL("assets/maps/iberia-neutral-surroundings.png", root),
  Buffer.from(result.neutralUrl.split(",")[1], "base64")
);
delete result.previewUrl;
delete result.neutralUrl;
delete result.svg;
await writeFile(
  new URL("build/e2e/geography-registration.json", root),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(JSON.stringify(result, null, 2));
await browser.close();
