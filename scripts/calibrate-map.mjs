import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const root = new URL("../", import.meta.url);
const [svgSource, terrainBytes] = await Promise.all([
  readFile(new URL("assets/maps/iberia.svg", root), "utf8"),
  readFile(new URL("assets/maps/iberia-relief-aligned.jpg", root))
]);
const terrainUrl = `data:image/jpeg;base64,${terrainBytes.toString("base64")}`;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const result = await page.evaluate(async ({ svgSource, terrainUrl }) => {
  const size = 768;
  const parser = new DOMParser();
  const svgDocument = parser.parseFromString(svgSource, "image/svg+xml");
  const boundaryPaths = [];
  const landPaths = [];
  const excludedInsetIds = new Set(["ES63", "ES64", "ES70", "PT20", "PT30", "Gibraltar"]);
  svgDocument.querySelectorAll("path").forEach((path) => {
    const id = path.id;
    // Portugal's paths in this source are registered to a different projection.
    // It is a neutral visual surround, not part of the gameplay hit map, so only
    // Spain participates in calibration and the neutral terrain mask.
    if (!/^ES/.test(id)) return;
    if (excludedInsetIds.has(id)) return;
    const pathData = path.getAttribute("d");
    if (pathData === null) return;
    boundaryPaths.push(`<path d="${pathData}" fill="none" stroke="#ffffff" stroke-width="0.45"/>`);
    landPaths.push(`<path d="${pathData}" fill="#ffffff" stroke="none"/>`);
  });

  const loadImage = (url, label) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load ${label}`));
    image.src = url;
  });
  const boundaryBlob = new Blob(
    [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="238 515 225 225" width="${size}" height="${size}">${boundaryPaths.join("")}</svg>`],
    { type: "image/svg+xml" }
  );
  const landBlob = new Blob(
    [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="238 515 225 225" width="${size}" height="${size}">${landPaths.join("")}</svg>`],
    { type: "image/svg+xml" }
  );
  const boundaryUrl = URL.createObjectURL(boundaryBlob);
  const landUrl = URL.createObjectURL(landBlob);
  const [boundaryImage, landImage, terrainImage] = await Promise.all([
    loadImage(boundaryUrl, "SVG boundaries"),
    loadImage(landUrl, "SVG land mask"),
    loadImage(terrainUrl, "terrain texture")
  ]);
  const makeCanvas = () => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    return canvas;
  };
  const boundaryCanvas = makeCanvas();
  boundaryCanvas.getContext("2d").drawImage(boundaryImage, 0, 0, size, size);
  const boundaryData = boundaryCanvas.getContext("2d").getImageData(0, 0, size, size).data;
  const boundaryPoints = [];
  for (let y = 2; y < size - 2; y += 2) {
    for (let x = 2; x < size - 2; x += 2) {
      if (boundaryData[(y * size + x) * 4 + 3] > 40) boundaryPoints.push([x, y]);
    }
  }

  const landCanvas = makeCanvas();
  landCanvas.getContext("2d").drawImage(landImage, 0, 0, size, size);
  const landData = landCanvas.getContext("2d").getImageData(0, 0, size, size).data;
  const sourceLandMask = new Uint8Array(size * size);
  for (let pixelIndex = 0; pixelIndex < sourceLandMask.length; pixelIndex += 1) {
    sourceLandMask[pixelIndex] = landData[pixelIndex * 4 + 3] > 128 ? 1 : 0;
  }
  const sourceCoastPoints = [];
  for (let y = 2; y < size - 2; y += 2) {
    for (let x = 2; x < size - 2; x += 2) {
      if (sourceLandMask[y * size + x] === 0) continue;
      if (
        sourceLandMask[y * size + x - 2] === 0
        || sourceLandMask[y * size + x + 2] === 0
        || sourceLandMask[(y - 2) * size + x] === 0
        || sourceLandMask[(y + 2) * size + x] === 0
      ) sourceCoastPoints.push([x, y]);
    }
  }

  const terrainCanvas = makeCanvas();
  terrainCanvas.getContext("2d").drawImage(terrainImage, 0, 0, size, size);
  const terrainData = terrainCanvas.getContext("2d").getImageData(0, 0, size, size).data;
  const terrainLandMask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const red = terrainData[offset];
      const green = terrainData[offset + 1];
      const blue = terrainData[offset + 2];
      const northOfPyrenees = x > 500 && y < 100 + (x - 500) * 0.75;
      const southOfIberia = y > 680;
      if (
        !northOfPyrenees
        && !southOfIberia
        && Math.max(red, green) > blue * 1.04
        && red + green > 90
      ) terrainLandMask[y * size + x] = 1;
    }
  }
  for (let pass = 0; pass < 2; pass += 1) {
    const previousMask = terrainLandMask.slice();
    for (let y = 5; y < size - 5; y += 1) {
      for (let x = 5; x < size - 5; x += 1) {
        if (previousMask[y * size + x] === 1) continue;
        const bridgesHorizontalLine = previousMask[y * size + x - 5] === 1
          && previousMask[y * size + x + 5] === 1;
        const bridgesVerticalLine = previousMask[(y - 5) * size + x] === 1
          && previousMask[(y + 5) * size + x] === 1;
        if (bridgesHorizontalLine || bridgesVerticalLine) terrainLandMask[y * size + x] = 1;
      }
    }
  }
  const terrainCoastMask = new Uint8Array(terrainLandMask.length);
  for (let y = 2; y < size - 2; y += 1) {
    for (let x = 2; x < size - 2; x += 1) {
      if (terrainLandMask[y * size + x] === 0) continue;
      if (
        terrainLandMask[y * size + x - 2] === 0
        || terrainLandMask[y * size + x + 2] === 0
        || terrainLandMask[(y - 2) * size + x] === 0
        || terrainLandMask[(y + 2) * size + x] === 0
      ) terrainCoastMask[y * size + x] = 1;
    }
  }
  const expandedMask = new Uint8Array(terrainCoastMask.length);
  const radius = 7;
  for (let y = radius; y < size - radius; y += 1) {
    for (let x = radius; x < size - radius; x += 1) {
      let found = 0;
      for (let dy = -radius; dy <= radius && found === 0; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (terrainCoastMask[(y + dy) * size + x + dx] === 1) {
            found = 1;
            break;
          }
        }
      }
      expandedMask[y * size + x] = found;
    }
  }

  const center = size / 2;
  const score = ({ scaleX, scaleY, shearX, shearY, translateX, translateY }) => {
    let matches = 0;
    let inside = 0;
    for (const [x, y] of sourceCoastPoints) {
      const localX = x - center;
      const localY = y - center;
      const projectedX = Math.round(center + scaleX * localX + shearX * localY + translateX);
      const projectedY = Math.round(center + shearY * localX + scaleY * localY + translateY);
      if (projectedX < 0 || projectedX >= size || projectedY < 0 || projectedY >= size) continue;
      inside += 1;
      matches += expandedMask[projectedY * size + projectedX];
    }
    const coastlineScore = inside === 0 ? 0 : matches / inside;
    const determinant = scaleX * scaleY - shearX * shearY;
    if (Math.abs(determinant) < 0.01) return 0;
    let intersection = 0;
    let union = 0;
    for (let targetY = 0; targetY < size; targetY += 3) {
      for (let targetX = 0; targetX < size; targetX += 3) {
        const localTargetX = targetX - center - translateX;
        const localTargetY = targetY - center - translateY;
        const sourceX = Math.round(center + (scaleY * localTargetX - shearX * localTargetY) / determinant);
        const sourceY = Math.round(center + (-shearY * localTargetX + scaleX * localTargetY) / determinant);
        const sourceLand = sourceX >= 0 && sourceX < size && sourceY >= 0 && sourceY < size
          ? sourceLandMask[sourceY * size + sourceX]
          : 0;
        const terrainLand = terrainLandMask[targetY * size + targetX];
        if (sourceLand === 1 && terrainLand === 1) intersection += 1;
        if (sourceLand === 1 || terrainLand === 1) union += 1;
      }
    }
    const overlapScore = union === 0 ? 0 : intersection / union;
    return overlapScore * 0.78 + coastlineScore * 0.22;
  };

  const identity = {
    scaleX: 1,
    scaleY: 1,
    shearX: 0,
    shearY: 0,
    translateX: 0,
    translateY: 0
  };
  const projectionInitial = {
    scaleX: 0.9,
    scaleY: 1.07,
    shearX: 0,
    shearY: 0,
    translateX: 69,
    translateY: 66
  };
  let best = { ...projectionInitial };
  let bestScore = score(best);
  const baselineScore = score(identity);
  let randomState = 0x19360718;
  const random = () => {
    randomState = (1664525 * randomState + 1013904223) >>> 0;
    return randomState / 0x100000000;
  };
  let step = { scale: 0.04, shear: 0.025, translate: 24 };
  for (let generation = 0; generation < 8; generation += 1) {
    for (let candidateIndex = 0; candidateIndex < 900; candidateIndex += 1) {
      const candidate = {
        scaleX: Math.max(0.94, Math.min(1.12, best.scaleX + (random() * 2 - 1) * step.scale)),
        scaleY: Math.max(0.94, Math.min(1.16, best.scaleY + (random() * 2 - 1) * step.scale)),
        shearX: Math.max(-0.15, Math.min(0.15, best.shearX + (random() * 2 - 1) * step.shear)),
        shearY: 0,
        translateX: Math.max(-75, Math.min(75, best.translateX + (random() * 2 - 1) * step.translate)),
        translateY: Math.max(-75, Math.min(75, best.translateY + (random() * 2 - 1) * step.translate))
      };
      const candidateScore = score(candidate);
      if (candidateScore > bestScore) {
        best = candidate;
        bestScore = candidateScore;
      }
    }
    step = {
      scale: step.scale * 0.55,
      shear: step.shear * 0.55,
      translate: step.translate * 0.55
    };
  }
  const previewCanvas = makeCanvas();
  const previewContext = previewCanvas.getContext("2d");
  previewContext.drawImage(terrainImage, 0, 0, size, size);
  previewContext.globalAlpha = 0.9;
  previewContext.setTransform(
    best.scaleX,
    best.shearY,
    best.shearX,
    best.scaleY,
    center - best.scaleX * center - best.shearX * center + best.translateX,
    center - best.shearY * center - best.scaleY * center + best.translateY
  );
  previewContext.drawImage(boundaryImage, 0, 0, size, size);
  const projectionInitialCanvas = makeCanvas();
  const projectionInitialContext = projectionInitialCanvas.getContext("2d");
  projectionInitialContext.drawImage(terrainImage, 0, 0, size, size);
  projectionInitialContext.globalAlpha = 0.9;
  projectionInitialContext.setTransform(
    projectionInitial.scaleX,
    projectionInitial.shearY,
    projectionInitial.shearX,
    projectionInitial.scaleY,
    center - projectionInitial.scaleX * center - projectionInitial.shearX * center + projectionInitial.translateX,
    center - projectionInitial.shearY * center - projectionInitial.scaleY * center + projectionInitial.translateY
  );
  projectionInitialContext.drawImage(boundaryImage, 0, 0, size, size);
  const baselineCanvas = makeCanvas();
  const baselineContext = baselineCanvas.getContext("2d");
  baselineContext.drawImage(terrainImage, 0, 0, size, size);
  baselineContext.globalAlpha = 0.9;
  baselineContext.drawImage(boundaryImage, 0, 0, size, size);
  const terrainMaskCanvas = makeCanvas();
  const terrainMaskContext = terrainMaskCanvas.getContext("2d");
  const terrainMaskImage = terrainMaskContext.createImageData(size, size);
  for (let pixelIndex = 0; pixelIndex < terrainLandMask.length; pixelIndex += 1) {
    const value = terrainLandMask[pixelIndex] * 255;
    terrainMaskImage.data[pixelIndex * 4] = value;
    terrainMaskImage.data[pixelIndex * 4 + 1] = value;
    terrainMaskImage.data[pixelIndex * 4 + 2] = value;
    terrainMaskImage.data[pixelIndex * 4 + 3] = 255;
  }
  terrainMaskContext.putImageData(terrainMaskImage, 0, 0);
  const sourceMaskCanvas = makeCanvas();
  const sourceMaskContext = sourceMaskCanvas.getContext("2d");
  const sourceMaskImage = sourceMaskContext.createImageData(size, size);
  for (let pixelIndex = 0; pixelIndex < sourceLandMask.length; pixelIndex += 1) {
    const value = sourceLandMask[pixelIndex] * 255;
    sourceMaskImage.data[pixelIndex * 4] = value;
    sourceMaskImage.data[pixelIndex * 4 + 1] = value;
    sourceMaskImage.data[pixelIndex * 4 + 2] = value;
    sourceMaskImage.data[pixelIndex * 4 + 3] = 255;
  }
  sourceMaskContext.putImageData(sourceMaskImage, 0, 0);
  return {
    baselinePreviewUrl: baselineCanvas.toDataURL("image/png"),
    baselineScore,
    boundaryPointCount: boundaryPoints.length,
    coastlinePointCount: sourceCoastPoints.length,
    score: bestScore,
    previewUrl: previewCanvas.toDataURL("image/png"),
    projectionInitialPreviewUrl: projectionInitialCanvas.toDataURL("image/png"),
    terrainMaskPreviewUrl: terrainMaskCanvas.toDataURL("image/png"),
    sourceMaskPreviewUrl: sourceMaskCanvas.toDataURL("image/png"),
    transformInPixels: best,
    transformInViewBox: {
      a: best.scaleX,
      b: best.shearY,
      c: best.shearX,
      d: best.scaleY,
      e: 350.5 - best.scaleX * 350.5 - best.shearX * 627.5 + best.translateX * 225 / size,
      f: 627.5 - best.shearY * 350.5 - best.scaleY * 627.5 + best.translateY * 225 / size
    }
  };
}, { svgSource, terrainUrl });

const renderedAssets = await page.evaluate(async ({ sourceMaskUrl, terrainUrl, vectorTransform }) => {
  const size = 1024;
  const loadImage = (url, label) => new Promise((resolve, reject) => {
    const candidate = new Image();
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error(`Unable to load ${label} for asset processing`));
    candidate.src = url;
  });
  const [image, sourceMaskImage] = await Promise.all([
    loadImage(terrainUrl, "terrain"),
    loadImage(sourceMaskUrl, "source mask")
  ]);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, size, size);
  const source = context.getImageData(0, 0, size, size);
  const cleaned = new ImageData(new Uint8ClampedArray(source.data), size, size);
  const isBlueBoundary = (offset) => {
    const red = source.data[offset];
    const green = source.data[offset + 1];
    const blue = source.data[offset + 2];
    return blue > red * 1.25 && blue > green * 1.18 && red < 120 && green < 145 && blue < 230;
  };
  const isLandColor = (offset) => {
    const red = source.data[offset];
    const green = source.data[offset + 1];
    const blue = source.data[offset + 2];
    return Math.max(red, green) > blue * 1.04 && red + green > 90;
  };
  const sampleDirections = [
    [-8, 0], [8, 0], [0, -8], [0, 8],
    [-6, -6], [6, -6], [-6, 6], [6, 6],
    [-12, 0], [12, 0], [0, -12], [0, 12]
  ];
  const boundaryMask = new Uint8Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (isBlueBoundary((y * size + x) * 4)) boundaryMask[y * size + x] = 1;
    }
  }
  const expandedBoundaryMask = boundaryMask.slice();
  for (let y = 2; y < size - 2; y += 1) {
    for (let x = 2; x < size - 2; x += 1) {
      if (boundaryMask[y * size + x] === 1) continue;
      let nearBoundary = false;
      for (let deltaY = -2; deltaY <= 2 && !nearBoundary; deltaY += 1) {
        for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
          if (boundaryMask[(y + deltaY) * size + x + deltaX] === 1) {
            nearBoundary = true;
            break;
          }
        }
      }
      if (nearBoundary) expandedBoundaryMask[y * size + x] = 1;
    }
  }
  for (let y = 12; y < size - 12; y += 1) {
    for (let x = 12; x < size - 12; x += 1) {
      const offset = (y * size + x) * 4;
      if (expandedBoundaryMask[y * size + x] === 0) continue;
      let red = 0;
      let green = 0;
      let blue = 0;
      let samples = 0;
      for (const [deltaX, deltaY] of sampleDirections) {
        const sampleOffset = ((y + deltaY) * size + x + deltaX) * 4;
        if (
          expandedBoundaryMask[(y + deltaY) * size + x + deltaX] === 1
          || !isLandColor(sampleOffset)
        ) continue;
        red += source.data[sampleOffset];
        green += source.data[sampleOffset + 1];
        blue += source.data[sampleOffset + 2];
        samples += 1;
      }
      if (samples < 7) continue;
      cleaned.data[offset] = red / samples;
      cleaned.data[offset + 1] = green / samples;
      cleaned.data[offset + 2] = blue / samples;
    }
  }
  // The relief stays in its native projection. Registering the authoritative
  // Spain vector to it preserves continuous topography and avoids resampling
  // artifacts. This transformed mask is used only to neutralize surroundings.
  const registeredSpainCanvas = document.createElement("canvas");
  registeredSpainCanvas.width = size;
  registeredSpainCanvas.height = size;
  const registeredSpainContext = registeredSpainCanvas.getContext("2d");
  const pixelScale = size / 768;
  const center = size / 2;
  registeredSpainContext.setTransform(
    vectorTransform.scaleX,
    vectorTransform.shearY,
    vectorTransform.shearX,
    vectorTransform.scaleY,
    center - vectorTransform.scaleX * center - vectorTransform.shearX * center
      + vectorTransform.translateX * pixelScale,
    center - vectorTransform.shearY * center - vectorTransform.scaleY * center
      + vectorTransform.translateY * pixelScale
  );
  registeredSpainContext.drawImage(sourceMaskImage, 0, 0, size, size);
  const registeredSpainPixels = registeredSpainContext.getImageData(0, 0, size, size).data;

  context.putImageData(cleaned, 0, 0);
  const colorUrl = canvas.toDataURL("image/jpeg", 0.9);

  const heightCanvas = document.createElement("canvas");
  heightCanvas.width = size;
  heightCanvas.height = size;
  const heightContext = heightCanvas.getContext("2d");
  const heightImage = heightContext.createImageData(size, size);
  const neutralCanvas = document.createElement("canvas");
  neutralCanvas.width = size;
  neutralCanvas.height = size;
  const neutralContext = neutralCanvas.getContext("2d");
  const neutralImage = neutralContext.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const red = cleaned.data[offset];
      const green = cleaned.data[offset + 1];
      const blue = cleaned.data[offset + 2];
      const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      const height = Math.max(0, Math.min(255, (luminance - 128) * 1.35 + 108));
      heightImage.data[offset] = height;
      heightImage.data[offset + 1] = height;
      heightImage.data[offset + 2] = height;
      heightImage.data[offset + 3] = 255;

      const isLand = Math.max(red, green) > blue * 1.04 && red + green > 90;
      const belongsToIberianMap = registeredSpainPixels[offset + 3] > 128;
      if (isLand && !belongsToIberianMap) {
        neutralImage.data[offset] = 127;
        neutralImage.data[offset + 1] = 130;
        neutralImage.data[offset + 2] = 128;
        neutralImage.data[offset + 3] = 142;
      }
    }
  }
  heightContext.putImageData(heightImage, 0, 0);
  neutralContext.putImageData(neutralImage, 0, 0);
  return {
    colorUrl,
    heightUrl: heightCanvas.toDataURL("image/jpeg", 0.92),
    neutralUrl: neutralCanvas.toDataURL("image/png")
  };
}, {
  sourceMaskUrl: result.sourceMaskPreviewUrl,
  terrainUrl,
  vectorTransform: result.transformInPixels
});

const previewBytes = Buffer.from(result.previewUrl.split(",")[1], "base64");
const baselinePreviewBytes = Buffer.from(result.baselinePreviewUrl.split(",")[1], "base64");
const terrainMaskPreviewBytes = Buffer.from(result.terrainMaskPreviewUrl.split(",")[1], "base64");
const sourceMaskPreviewBytes = Buffer.from(result.sourceMaskPreviewUrl.split(",")[1], "base64");
const projectionInitialPreviewBytes = Buffer.from(result.projectionInitialPreviewUrl.split(",")[1], "base64");
const registeredColorBytes = Buffer.from(renderedAssets.colorUrl.split(",")[1], "base64");
const registeredHeightBytes = Buffer.from(renderedAssets.heightUrl.split(",")[1], "base64");
const neutralMaskBytes = Buffer.from(renderedAssets.neutralUrl.split(",")[1], "base64");
delete result.previewUrl;
delete result.baselinePreviewUrl;
delete result.terrainMaskPreviewUrl;
delete result.sourceMaskPreviewUrl;
delete result.projectionInitialPreviewUrl;
await mkdir(new URL("build/e2e/", root), { recursive: true });
await writeFile(new URL("build/e2e/map-calibration-preview.png", root), previewBytes);
await writeFile(new URL("build/e2e/map-calibration-baseline.png", root), baselinePreviewBytes);
await writeFile(new URL("build/e2e/map-calibration-terrain-mask.png", root), terrainMaskPreviewBytes);
await writeFile(new URL("build/e2e/map-calibration-source-mask.png", root), sourceMaskPreviewBytes);
await writeFile(new URL("build/e2e/map-calibration-projection-initial.png", root), projectionInitialPreviewBytes);
await writeFile(new URL("assets/maps/iberia-relief-registered.jpg", root), registeredColorBytes);
await writeFile(new URL("assets/maps/iberia-relief-registered-height.jpg", root), registeredHeightBytes);
await writeFile(new URL("assets/maps/iberia-neutral-surroundings.png", root), neutralMaskBytes);
console.log(JSON.stringify(result, null, 2));
await browser.close();
