import { useEffect, useRef, type JSX } from "react";
import neutralSurroundingsUrl from "../../../assets/maps/iberia-neutral-surroundings.png";
import reliefTextureUrl from "../../../assets/maps/iberia-relief-registered.jpg";
import reliefHeightUrl from "../../../assets/maps/iberia-relief-registered-height.jpg";
import { terrainRenderingConfig, terrainRenderMetrics } from "./terrainRendering";

export function WebGLTerrain(): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement>(null);

  /* v8 ignore start -- the WebGL lifecycle and fallback are exercised by Playwright in Chromium */
  useEffect(() => {
    const surface = surfaceRef.current;
    if (surface === null || typeof window.WebGLRenderingContext === "undefined") return;

    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import("three").then((THREE) => {
      if (cancelled) return;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
      } catch {
        surface.dataset["renderer"] = "image-fallback";
        return;
      }

      renderer.domElement.className = "iberia-webgl-canvas";
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = terrainRenderingConfig.toneMappingExposure;
      renderer.setClearColor(0x7c898a, 1);
      surface.insertBefore(renderer.domElement, surface.querySelector(".iberia-neutral-surroundings"));

      const scene = new THREE.Scene();
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
      camera.position.set(0, 0, 2.5);

      const manager = new THREE.LoadingManager();
      const loader = new THREE.TextureLoader(manager);
      const colorTexture = loader.load(reliefTextureUrl);
      colorTexture.colorSpace = THREE.SRGBColorSpace;
      colorTexture.minFilter = THREE.LinearMipmapLinearFilter;
      colorTexture.magFilter = THREE.LinearFilter;

      const heightTexture = loader.load(reliefHeightUrl);
      heightTexture.colorSpace = THREE.NoColorSpace;
      heightTexture.minFilter = THREE.LinearMipmapLinearFilter;
      heightTexture.magFilter = THREE.LinearFilter;

      const geometry = new THREE.PlaneGeometry(2, 2, 160, 160);
      const material = new THREE.MeshStandardMaterial({
        bumpMap: heightTexture,
        bumpScale: terrainRenderingConfig.bumpScale,
        color: terrainRenderingConfig.meshColor,
        displacementBias: terrainRenderingConfig.displacementBias,
        displacementMap: heightTexture,
        displacementScale: terrainRenderingConfig.displacementScale,
        map: colorTexture,
        metalness: terrainRenderingConfig.metalness,
        roughness: terrainRenderingConfig.roughness
      });
      const terrain = new THREE.Mesh(geometry, material);
      scene.add(terrain);

      const ambient = new THREE.HemisphereLight(0xf2e4c8, 0x354454, 1.55);
      const commandLamp = new THREE.DirectionalLight(0xffdfa0, 2.4);
      commandLamp.position.set(-1.4, 1.8, 2.8);
      scene.add(ambient, commandLamp);

      const render = (): void => {
        const bounds = surface.getBoundingClientRect();
        const metrics = terrainRenderMetrics(
          bounds.width,
          bounds.height,
          window.devicePixelRatio,
          renderer.capabilities.getMaxAnisotropy()
        );
        renderer.setPixelRatio(metrics.pixelRatio);
        colorTexture.anisotropy = metrics.anisotropy;
        renderer.setSize(metrics.width, metrics.height, false);
        renderer.render(scene, camera);
      };

      manager.onLoad = () => {
        render();
        surface.dataset["renderer"] = "webgl";
      };

      const resizeObserver = new ResizeObserver(render);
      resizeObserver.observe(surface);

      dispose = () => {
        resizeObserver.disconnect();
        geometry.dispose();
        material.dispose();
        colorTexture.dispose();
        heightTexture.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      cancelled = true;
      dispose?.();
    };
  }, []);
  /* v8 ignore stop */

  return (
    <div className="iberia-map-terrain" data-renderer="image-fallback" ref={surfaceRef}>
      <img alt="" aria-hidden="true" className="iberia-terrain-fallback" src={reliefTextureUrl} />
      <img alt="" aria-hidden="true" className="iberia-neutral-surroundings" src={neutralSurroundingsUrl} />
    </div>
  );
}
