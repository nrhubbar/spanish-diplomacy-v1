/** What draws the relief: WebGL, or the same pictures placed with CSS. */
export type ReliefRenderer = "images" | "webgl";

/** Where one picture is. `arrived` is loaded and still fading in; only the detailed one does that. */
export type PictureStage = "arrived" | "failed" | "pending" | "shown";

/** How far the relief has come. The pictures are in order: the overview first, the detailed one last. */
export interface Relief {
  /** The overview's image is loaded: it stands in until WebGL draws, and again if WebGL fails. */
  readonly placeholder: boolean;
  readonly renderer: ReliefRenderer;
  /** The overview has had a moment to itself, so the larger pictures may load. */
  readonly settled: boolean;
  readonly stages: readonly PictureStage[];
}

export type ReliefEvent =
  | { readonly by: ReliefRenderer; readonly kind: "arrived" | "faded" | "failed"; readonly layer: number }
  | { readonly kind: "images-only" }
  | { readonly kind: "settled" };

export type DetailProgress = "failed" | "loading" | "none" | "shown" | "waiting";

/** The detailed picture is the last of several; a lone picture is the overview. */
export function isDetail(pictures: number, layer: number): boolean {
  return layer > 0 && layer === pictures - 1;
}

export function startRelief(pictures: number, renderer: ReliefRenderer): Relief {
  return { placeholder: false, renderer, settled: renderer === "images", stages: Array.from({ length: pictures }, () => "pending") };
}

function withStage(relief: Relief, layer: number, stage: PictureStage): Relief {
  return { ...relief, stages: relief.stages.map((each, index) => (index === layer ? stage : each)) };
}

export function nextRelief(relief: Relief, event: ReliefEvent): Relief {
  switch (event.kind) {
    case "settled": return { ...relief, settled: true };
    case "images-only": {
      const images = { ...startRelief(relief.stages.length, "images"), placeholder: relief.placeholder };
      return relief.placeholder ? withStage(images, 0, "shown") : images;
    }
    case "arrived":
    case "faded":
    case "failed": {
      if (event.by !== relief.renderer) return event.by === "images" && event.kind === "arrived" ? { ...relief, placeholder: true } : relief;
      if (event.kind === "failed") return withStage(relief, event.layer, "failed");
      return withStage(relief, event.layer, event.kind === "arrived" && isDetail(relief.stages.length, event.layer) ? "arrived" : "shown");
    }
  }
}

/** The pictures whose turn it is: the overview, then the rest, and the detailed one once it is wanted. */
export function picturesToLoad(relief: Relief, detailWanted: boolean): readonly number[] {
  return [...relief.stages.keys()].filter((layer) =>
    relief.stages[layer] === "pending" && (layer === 0 || (relief.settled && (detailWanted || !isDetail(relief.stages.length, layer)))));
}

/** Every picture meant to be shown now is. Without its detailed picture the relief is whole, only coarser. */
export function reliefRefined(relief: Relief, detailWanted: boolean): boolean {
  return relief.stages.every((stage, layer) => stage === "shown" || (isDetail(relief.stages.length, layer) && (!detailWanted || stage === "failed")));
}

export function detailProgress(relief: Relief, detailWanted: boolean): DetailProgress {
  const stage = relief.stages[relief.stages.length - 1];
  if (stage === undefined || !isDetail(relief.stages.length, relief.stages.length - 1)) return "none";
  if (stage === "failed" || stage === "shown") return stage;
  return detailWanted ? "loading" : "waiting";
}

/** A picture that fades in is clear until it arrives. */
export function isClear(relief: Relief, layer: number): boolean {
  const stage = relief.stages[layer];
  return isDetail(relief.stages.length, layer) && (stage === "pending" || stage === "failed");
}

/** The detailed image is in place and on its way in, so something has to say when it is done. */
export function imageFading({ renderer, stages }: Relief): boolean {
  return renderer === "images" && stages[stages.length - 1] === "arrived";
}
