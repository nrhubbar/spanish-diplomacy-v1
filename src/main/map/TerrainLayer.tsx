import { type JSX, useEffect, useRef, useState } from "react";
import type { MapRect } from "../scenarios/loader";
import type { TerrainLayerAsset } from "../scenarios/registry";
import { terrainFrustum, terrainRenderingConfig, terrainRenderMetrics } from "./terrainRendering";

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
  readonly render: (visible: MapRect) => void;
}

/**
 * Relief terrain. The relief is baked into the layer images (lighting, tint, and the coastline
 * mask all come from the map build), so WebGL only draws each layer as an unlit, mipmapped
 * quad through an orthographic camera that matches the map camera exactly. The same images,
 * placed with CSS, are the loading state and the fallback when WebGL is unavailable. WebGL is
 * live once the first (coarsest) layer is drawn; finer layers sharpen it as they arrive.
 */
export function TerrainLayer({ layers, onFallback, place, visible }: TerrainLayerProps): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TerrainScene | undefined>(undefined);
  const visibleRef = useRef(visible);
  const fallbackRef = useRef(onFallback);
  const [renderer, setRenderer] = useState<TerrainRenderer>("image-fallback");
  // While WebGL loads, only the small first layer is placed as an image; every layer is placed
  // once the images are the renderer (no WebGL, a lost context, or failed textures).
  const [imagesOnly, setImagesOnly] = useState(() => typeof window.WebGLRenderingContext === "undefined");
  // True once every relief layer is drawn (tests and captures wait for it).
  const [refined, setRefined] = useState(false);

  useEffect(() => {
    fallbackRef.current = onFallback;
  }, [onFallback]);

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
        setImagesOnly(true);
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
      const manager = new THREE.LoadingManager();
      // Decoded off the main thread, already flipped and unpremultiplied, so a frame only uploads
      // pixels instead of decoding a multi-megapixel image synchronously.
      const loader = new THREE.ImageBitmapLoader(manager).setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
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
      const show = (layer: (typeof meshes)[number], then?: () => void): void => {
        loader.load(layer.url, (bitmap) => {
          if (disposed) {
            bitmap.close();
            return;
          }
          layer.texture.image = bitmap;
          layer.texture.needsUpdate = true;
          layer.mesh.visible = true;
          then?.();
          draw(visibleRef.current);
        });
      };
      // Progressive: the small first layer makes the relief live; the large layers follow once the
      // map has settled, one per load, so their uploads never land on the first interactions.
      const [first, ...finer] = meshes;
      if (first !== undefined) {
        show(first, () => {
          ready = true;
          setRenderer("webgl");
          let pending = finer.length;
          if (pending === 0) setRefined(true);
          refine = window.setTimeout(() => {
            for (const layer of finer) {
              show(layer, () => {
                pending -= 1;
                if (pending === 0) setRefined(true);
              });
            }
          }, terrainRenderingConfig.refineDelayMs);
        });
      }
      manager.onError = () => {
        // Leaving the map aborts pending loads; that is not a failure worth reporting.
        if (disposed) return;
        setImagesOnly(true);
        fallbackRef.current("Terrain textures could not be loaded.");
      };
      const lost = (event: Event): void => {
        event.preventDefault();
        setRenderer("image-fallback");
        setImagesOnly(true);
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
          gl.domElement.remove();
        },
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
  /* v8 ignore stop */

  return (
    <div className="terrain-layer" data-refined={refined} data-renderer={renderer} ref={surfaceRef}>
      <div aria-hidden="true" className="terrain-fallback">
        {(imagesOnly ? layers : layers.slice(0, 1)).map((layer) => {
          const rect = place(layer.bounds);
          return (
            <img alt="" className="terrain-image" key={layer.url} src={layer.url} style={{ height: rect.height, left: rect.x, top: rect.y, width: rect.width }} />
          );
        })}
      </div>
    </div>
  );
}
