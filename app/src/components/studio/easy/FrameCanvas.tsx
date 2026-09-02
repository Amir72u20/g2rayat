import { useCallback, useEffect, useRef } from "react";
import { drawPage } from "@/lib/comic/draw";
import { getMediaBag, loadImageAsset } from "@/lib/comic/media-cache";
import { handleSize } from "@/lib/comic/geometry";
import type { ComicPage } from "@/lib/comic/types";
import { cn } from "@/lib/utils";

export interface ScenePoint {
  x: number;
  y: number;
  /** Handle size in scene units at the current display scale. */
  hs: number;
}

/**
 * One page rendered with the studio's own renderer, sized to its container.
 *
 * The easy builder edits a picture on a page of its own, so reusing `drawPage`
 * here means the frame you arrange is exactly what the finished panel shows —
 * no second, drifting preview renderer.
 */
export function FrameCanvas({
  page,
  selectedId,
  tick,
  handles = true,
  className,
  onScenePointerDown,
  onScenePointerMove,
  onScenePointerUp,
}: {
  page: ComicPage;
  selectedId?: string | null;
  tick?: number;
  handles?: boolean;
  className?: string;
  onScenePointerDown?: (pt: ScenePoint, e: React.PointerEvent<HTMLCanvasElement>) => void;
  onScenePointerMove?: (pt: ScenePoint, e: React.PointerEvent<HTMLCanvasElement>) => void;
  onScenePointerUp?: (pt: ScenePoint, e: React.PointerEvent<HTMLCanvasElement>) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);

  const paint = useCallback(() => {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (cv.width !== w) cv.width = w;
    if (cv.height !== h) cv.height = h;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.setTransform(w / page.w, 0, 0, h / page.h, 0, 0);
    drawPage(ctx, page, getMediaBag(), {
      handles,
      selectedId: selectedId ?? undefined,
      displayW: rect.width,
    });
  }, [page, selectedId, handles]);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      paint();
    });
  }, [paint]);

  useEffect(() => {
    page.items.forEach((it) => {
      if (it.type === "image") loadImageAsset(it.assetId, schedule);
    });
    schedule();
    const cv = ref.current;
    if (!cv) return;
    const ro = new ResizeObserver(schedule);
    ro.observe(cv);
    return () => {
      ro.disconnect();
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [page, schedule, tick, selectedId]);

  function toScene(e: React.PointerEvent<HTMLCanvasElement>): ScenePoint {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * page.w,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * page.h,
      hs: handleSize(page.w, rect.width),
    };
  }

  // The frame keeps its aspect but never grows past --frame-max (set by the
  // step), so the tools and the film strip stay on screen — the whole point of
  // editing a picture outside its panel.
  return (
    <div
      className={cn("mx-auto w-full", className)}
      style={{ maxWidth: `calc(var(--frame-max, 58dvh) * ${page.w / page.h})` }}
    >
      <canvas
        ref={ref}
        className="block size-full touch-none select-none"
        style={{ aspectRatio: `${page.w} / ${page.h}` }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          onScenePointerDown?.(toScene(e), e);
        }}
        onPointerMove={(e) => onScenePointerMove?.(toScene(e), e)}
        onPointerUp={(e) => onScenePointerUp?.(toScene(e), e)}
        onPointerCancel={(e) => onScenePointerUp?.(toScene(e), e)}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}
