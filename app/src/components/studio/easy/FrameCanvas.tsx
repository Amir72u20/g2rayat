import { useCallback, useEffect, useRef, useState } from "react";
import { drawPage } from "@/lib/comic/draw";
import {
  getMediaBag,
  loadImageAsset,
  loadVideoAsset,
  tickVideoClip,
} from "@/lib/comic/media-cache";
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
 * One page rendered with the studio's own renderer, letterboxed inside whatever
 * box its parent gives it.
 *
 * Reusing `drawPage` means the frame you arrange here is exactly what the
 * finished panel shows. The size is measured and set in pixels rather than left
 * to CSS aspect rules, so the frame fits the height of its zone as well as the
 * width — that is what keeps the phone editor's tools on screen beside the
 * picture instead of pushed below the fold.
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
  const boxRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const raf = useRef(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Contain the page inside the box the parent gives us.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const r = box.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      const scale = Math.min(r.width / page.w, r.height / page.h);
      setSize({ w: Math.floor(page.w * scale), h: Math.floor(page.h * scale) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [page.w, page.h]);

  const paint = useCallback(() => {
    const cv = ref.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
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
      if (it.type === "video") loadVideoAsset(it.assetId, schedule);
    });
    schedule();

    // A playing clip needs a frame loop; a paused one costs nothing.
    let live = true;
    const pump = () => {
      if (!live) return;
      const bag = getMediaBag();
      let playing = false;
      page.items.forEach((it) => {
        if (it.type !== "video") return;
        const el = bag.videos[it.assetId];
        if (el && !el.paused) {
          tickVideoClip(it);
          playing = true;
        }
      });
      if (playing) schedule();
      timer = window.setTimeout(pump, 60);
    };
    let timer = window.setTimeout(pump, 60);

    return () => {
      live = false;
      window.clearTimeout(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
    };
  }, [page, schedule, tick, selectedId, size.w, size.h]);

  function toScene(e: React.PointerEvent<HTMLCanvasElement>): ScenePoint {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * page.w,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * page.h,
      hs: handleSize(page.w, rect.width),
    };
  }

  return (
    <div ref={boxRef} className={cn("grid size-full min-h-0 place-items-center", className)}>
      <canvas
        ref={ref}
        className="block touch-none select-none rounded-md"
        style={{ width: size.w || undefined, height: size.h || undefined }}
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
