import { type JSX, useEffect, useReducer, useRef, useState } from "react";
import type { MapRect } from "../scenarios/loader";
import type { TerrainLayerAsset } from "../scenarios/registry";
import { detailProgress, imageFading, isClear, isDetail, nextRelief, picturesToLoad, type Relief, reliefRefined, startRelief } from "./reliefSequence";
import { fadeOpacity, terrainFrustum, terrainRenderingConfig, terrainRenderMetrics } from "./terrainRendering";
import { layersToShow, useDetailWanted } from "./useDetailWanted";

export type TerrainRenderer = "image-fallback" | "webgl";

interface TerrainLayerProps {
  readonly layers: readonly TerrainLayerAsset[];
  readonly onFallback: (reason: string) => void;
  /** Screen rectangle of a view box rectangle at the current camera. */
  readonly place: (rect: MapRect) => MapRect;
  readonly visible: MapRect;
}

interface TerrainScene {
  readonly dispose: () => void;
  /** Loads and shows a picture; asked again, it does nothing. */
  readonly load: (layer: number) => void;
  readonly render: (visible: MapRect) => void;
}

function firstRelief(pictures: number): Relief {
  return startRelief(pictures, typeof window.WebGLRenderingContext === "undefined" ? "images" : "webgl");
}

const detailFade = `opacity ${String(terrainRenderingConfig.detailFadeMs)}ms`;

/**
 * Relief terrain. The relief is baked into the layer images (lighting, tint, and the coastline
 * mask all come from the map build), so WebGL only draws each layer as an unlit, mipmapped
 * quad through an orthographic camera that matches the map camera exactly. The same images,
 * placed with CSS, are the loading state and the fallback when WebGL is unavailable. WebGL is
 * live once the first (coarsest) layer is drawn; finer layers sharpen it as they arrive. The last
 * and largest of several loads only when it is wanted (`useDetailWanted`), and fades in;
 * `reliefSequence.ts` decides which picture's turn it is. Other pictures start all of it again.
 */
export function TerrainLayer(props: TerrainLayerProps): JSX.Element {
  return <ReliefPictures key={JSON.stringify(props.layers)} {...props} />;
}

function ReliefPictures({ layers: given, onFallback, place, visible }: TerrainLayerProps): JSX.Element {
  // The key changes with the pictures, so the first list is this relief's for good.
  const [layers] = useState(given);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TerrainScene | undefined>(undefined);
  const visibleRef = useRef(visible);
  const fallbackRef = useRef(onFallback);
  // While WebGL loads, only the small first layer is placed as an image; every layer is placed
  // once the images are the renderer (no WebGL, a lost context, or failed textures).
  const [relief, dispatch] = useReducer(nextRelief, layers.length, firstRelief);
  const detailWanted = useDetailWanted(layers, visible);
  const renderer: TerrainRenderer = relief.renderer === "webgl" && relief.stages[0] === "shown" ? "webgl" : "image-fallback";
  const fading = imageFading(relief);
  const imageLayers = relief.renderer === "images" ? layersToShow(layers, detailWanted) : layers.slice(0, 1);

  useEffect(() => {
    fallbackRef.current = onFallback;
  }, [onFallback]);

  useEffect(() => {
    if (!fading) return undefined;
    const faded = window.setTimeout(() => { dispatch({ by: "images", kind: "faded", layer: layers.length - 1 }); }, terrainRenderingConfig.detailFadeMs);
    return () => { window.clearTimeout(faded); };
  }, [fading, layers]);

  /* v8 ignore start -- WebGL lifecycle; covered by the e2e "terrain renders" and "fallback" stories */
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null || typeof window.WebGLRenderingContext === "undefined") return undefined;
    let cancelled = false;

    // The first layer's image already shows the relief, so WebGL starts once the map has had
    // a moment to take its first input: texture uploads never compete with the first click.
    const begin = (): void => { void import("three").then((THREE) => {
      if (cancelled) return;
      let gl: import("three").WebGLRenderer;
      try {
        // No MSAA: the scene is axis-aligned textured quads, so it would only cost memory.
        gl = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
      } catch {
        dispatch({ kind: "images-only" });
        fallbackRef.current("WebGL is unavailable on this device.");
        return;
      }
      gl.domElement.className = "terrain-canvas";
      gl.outputColorSpace = THREE.SRGBColorSpace;
      gl.toneMapping = THREE.NoToneMapping;
      gl.setClearColor(0x000000, 0);
      surface.prepend(gl.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
      camera.position.set(0, 0, 5);
      // Decoded off the main thread, already flipped and unpremultiplied, so a frame only uploads
      // pixels instead of decoding a multi-megapixel image synchronously.
      const loader = new THREE.ImageBitmapLoader().setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
      const meshes = layers.map((layer, order) => {
        const texture = new THREE.Texture();
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = false;
        const geometry = new THREE.PlaneGeometry(layer.bounds.width, layer.bounds.height);
        // Transparent so a layer's feathered edges blend into the coarser layer beneath it.
        const material = new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, map: texture, toneMapped: false, transparent: true });
        const mesh = new THREE.Mesh(geometry, material);
        // World y grows upward; map y grows downward.
        mesh.position.set(layer.bounds.x + layer.bounds.width / 2, -(layer.bounds.y + layer.bounds.height / 2), 0);
        mesh.renderOrder = order;
        mesh.visible = false;
        scene.add(mesh);
        return { geometry, material, mesh, texture, url: layer.url };
      });

      let frame = 0;
      let ready = false;
      let disposed = false;
      let refine = 0;
      const draw = (rect: MapRect): void => {
        if (!ready || disposed) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const metrics = terrainRenderMetrics(surface.clientWidth, surface.clientHeight, window.devicePixelRatio, gl.capabilities.getMaxAnisotropy());
          gl.setPixelRatio(metrics.pixelRatio);
          gl.setSize(metrics.width, metrics.height, false);
          for (const { texture } of meshes) {
            if (texture.anisotropy !== metrics.anisotropy) {
              texture.anisotropy = metrics.anisotropy;
              texture.needsUpdate = true;
            }
          }
          Object.assign(camera, terrainFrustum(rect));
          camera.updateProjectionMatrix();
          gl.render(scene, camera);
        });
      };
      const fadeIn = (layer: (typeof meshes)[number], then: () => void): void => {
        const from = performance.now();
        const step = (now: number): void => {
          if (disposed) return;
          layer.material.opacity = fadeOpacity(now - from);
          draw(visibleRef.current);
          if (layer.material.opacity < 1) requestAnimationFrame(step);
          else then();
        };
        layer.material.opacity = 0;
        requestAnimationFrame(step);
      };
      const requested = new Set<number>();
      const load = (index: number): void => {
        const layer = meshes[index];
        if (layer === undefined || requested.has(index)) return;
        requested.add(index);
        const detail = isDetail(meshes.length, index);
        loader.load(layer.url, (bitmap) => {
          if (disposed) {
            bitmap.close();
            return;
          }
          layer.texture.image = bitmap;
          layer.texture.needsUpdate = true;
          layer.mesh.visible = true;
          dispatch({ by: "webgl", kind: "arrived", layer: index });
          if (detail) fadeIn(layer, () => { dispatch({ by: "webgl", kind: "faded", layer: index }); });
          if (index === 0) {
            ready = true;
            refine = window.setTimeout(() => { dispatch({ kind: "settled" }); }, terrainRenderingConfig.refineDelayMs);
          }
          draw(visibleRef.current);
        }, undefined, () => {
          // Leaving the map aborts pending loads; that is not a failure worth reporting.
          if (disposed) return;
          if (detail) {
            dispatch({ by: "webgl", kind: "failed", layer: index });
            return;
          }
          dispatch({ kind: "images-only" });
          fallbackRef.current("Terrain textures could not be loaded.");
        });
      };
      load(0);
      const lost = (event: Event): void => {
        event.preventDefault();
        dispatch({ kind: "images-only" });
        fallbackRef.current("The 3D terrain was interrupted; showing the flat map.");
      };
      gl.domElement.addEventListener("webglcontextlost", lost);
      const observer = new ResizeObserver(() => { draw(visibleRef.current); });
      observer.observe(surface);

      sceneRef.current = {
        dispose: () => {
          disposed = true;
          window.clearTimeout(refine);
          loader.abort();
          cancelAnimationFrame(frame);
          observer.disconnect();
          gl.domElement.removeEventListener("webglcontextlost", lost);
          for (const { geometry, material, texture } of meshes) {
            geometry.dispose();
            material.dispose();
            texture.dispose();
            if (texture.image instanceof ImageBitmap) texture.image.close();
          }
          gl.dispose();
          // Frees the context now: browsers allow few, and disposing leaves it to garbage collection.
          gl.forceContextLoss();
          gl.domElement.remove();
        },
        load,
        render: draw
      };
    }); };
    const start = window.setTimeout(begin, terrainRenderingConfig.startDelayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(start);
      sceneRef.current?.dispose();
      sceneRef.current = undefined;
    };
  }, [layers]);

  useEffect(() => {
    visibleRef.current = visible;
    sceneRef.current?.render(visible);
  }, [visible]);

  useEffect(() => {
    if (relief.renderer === "webgl") for (const layer of picturesToLoad(relief, detailWanted)) sceneRef.current?.load(layer);
  }, [detailWanted, relief]);
  /* v8 ignore stop */

  return (
    <div className="terrain-layer" data-detail={detailProgress(relief, detailWanted)} data-refined={reliefRefined(relief, detailWanted)} data-renderer={renderer} ref={surfaceRef}>
      <div aria-hidden="true" className="terrain-fallback">
        {imageLayers.map((layer, index) => {
          const rect = place(layer.bounds);
          return (
            <img
              alt=""
              className="terrain-image"
              key={layer.url}
              onError={() => { dispatch({ by: "images", kind: "failed", layer: index }); }}
              onLoad={() => { dispatch({ by: "images", kind: "arrived", layer: index }); }}
              src={layer.url}
              style={{ height: rect.height, left: rect.x, opacity: isClear(relief, index) ? 0 : 1, top: rect.y, transition: detailFade, width: rect.width }}
            />
          );
        })}
      </div>
    </div>
  );
}
