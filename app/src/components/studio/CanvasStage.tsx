import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy, Film, ImagePlus, Lock, Music, Plus, Trash2, Type, Unlock, X } from "lucide-react";
import { drawPage, preparePageCanvas } from "@/lib/comic/draw";
import {
  applyResize,
  applyRotate,
  clampItem,
  handleSize,
  hitTest,
  isFramedMedia,
  moveItem,
  panCrop,
  panelAt,
  resizeCorner,
  snapItem,
  type HandleCorner,
  scaleFromCenter,
} from "@/lib/comic/geometry";
import { addPanelToPage } from "@/lib/comic/factory";
import { cssClipForPanel, panelCentroid } from "@/lib/comic/panel-shape";
import { getMediaBag, loadImageAsset, loadVideoAsset, seekVideo, tickVideoClip } from "@/lib/comic/media-cache";
import { useStudio } from "@/lib/comic/store";
import { collectAssetIds } from "@/lib/comic/db";
import { musicSpan } from "@/lib/comic/reader";
import type { ComicItem, ComicPage, DrawingItem } from "@/lib/comic/types";

const TAP_PX = 12;
let interacting = false;

export function CanvasStage({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pageEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const project = useStudio((s) => s.project);
  const pageIndex = useStudio((s) => s.pageIndex);
  const viewZoom = useStudio((s) => s.viewZoom);
  const addPage = useStudio((s) => s.addPage);
  const focusPage = useStudio((s) => s.focusPage);
  const pageKey = useStudio((s) => s.project?.pages.map((p) => p.id).join(",") ?? "");
  const pageIds = pageKey.split(",").filter(Boolean);

  useEffect(() => {
    const page = project?.pages[pageIndex];
    const el = page ? pageEls.current.get(page.id) : null;
    const root = stageRef.current;
    if (!el || !root || interacting) return;
    const rr = root.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    const visible = er.top < rr.bottom - 48 && er.bottom > rr.top + 48;
    if (visible) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [pageIndex, project]);

  useEffect(() => {
    const root = stageRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (interacting) return;
        let bestId = "";
        let best = 0;
        for (const e of entries) {
          if (e.intersectionRatio > best) {
            best = e.intersectionRatio;
            bestId = (e.target as HTMLElement).dataset.pageId || "";
          }
        }
        if (!bestId || best < 0.4) return;
        const pages = useStudio.getState().project?.pages ?? [];
        const i = pages.findIndex((p) => p.id === bestId);
        if (i >= 0) focusPage(i);
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    );
    pageEls.current.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [pageKey, focusPage]);

  if (!project || !pageIds.length) {
    return (
      <div className="grid h-full min-h-0 place-items-center p-6 text-center">
        <div>
          <h3 className="text-lg font-semibold">این کمیک صفحه‌ای ندارد</h3>
          <p className="mt-1 text-sm text-muted">یک صفحه تازه بساز.</p>
          <button type="button" className="mt-4 h-11 rounded-md bg-elevated px-4 text-sm" onClick={addPage}>
            صفحه تازه
          </button>
        </div>
      </div>
    );
  }

  const widthPct = viewZoom > 1.02 ? Math.min(240, viewZoom * 100) : 100;

  return (
    <div
      ref={stageRef}
      className="checker relative h-full min-h-0 flex-1 overflow-auto overscroll-contain"
      onPointerDown={(e) => {
        const t = e.target as HTMLElement;
        if (t.tagName === "CANVAS" || t.closest("textarea") || t.closest("button")) return;
        useStudio.getState().select(null);
      }}
    >
      <div
        className="relative mx-auto flex min-w-0 w-full flex-col pr-16"
        style={{
          width: `${widthPct}%`,
          maxWidth: viewZoom > 1.02 ? "none" : "100%",
        }}
      >
        {pageIds.map((id, i) => (
          <div
            key={id}
            data-page-id={id}
            ref={(el) => {
              if (el) pageEls.current.set(id, el);
              else pageEls.current.delete(id);
            }}
          >
            <PageCanvas index={i} onPickFiles={onPickFiles} stageRef={stageRef} />
          </div>
        ))}
        <button
          type="button"
          onClick={addPage}
          className="mt-2 flex h-14 items-center justify-center gap-2 rounded-lg border border-dashed border-line text-sm text-muted hover:text-fg"
        >
          <Plus className="size-4" />
          صفحه تازه — به نوار اضافه می‌شود
        </button>
        <MusicRail pageEls={pageEls} pageKey={pageKey} onAddMusic={() => onPickFiles("audio")} />
      </div>
    </div>
  );
}

function PageCanvas({
  index,
  onPickFiles,
  stageRef,
}: {
  index: number;
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string) => void;
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<{ dist: number; zoom: number; itemId?: string; itemZoom?: number } | null>(null);
  const drag = useRef<{
    mode: "pending" | "move" | "resize" | "tail" | "draw" | "pan" | "rotate" | "crop";
    id: string;
    hitId: string | null;
    corner?: HandleCorner;
    lastX: number;
    lastY: number;
    startX: number;
    startY: number;
    spawned?: boolean;
    clientX: number;
    clientY: number;
    moved: boolean;
  } | null>(null);
  const raf = useRef(0);
  const [onScreen, setOnScreen] = useState(true);
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const guidesRef = useRef(guides);
  guidesRef.current = guides;
  const [editing, setEditing] = useState<string | null>(null);
  const [floatPos, setFloatPos] = useState<{ x: number; y: number } | null>(null);
  const [grab, setGrab] = useState(false);

  const selectedId = useStudio((s) => s.selectedId);
  const liveGen = useStudio((s) => s.liveGen);
  const mediaTick = useStudio((s) => s.mediaTick);
  const snap = useStudio((s) => s.snap);
  const select = useStudio((s) => s.select);
  const snapHistory = useStudio((s) => s.snapHistory);
  const mutateLive = useStudio((s) => s.mutateLive);
  const flushLive = useStudio((s) => s.flushLive);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const toggleLock = useStudio((s) => s.toggleLock);
  const importFiles = useStudio((s) => s.importFiles);
  const startDrawing = useStudio((s) => s.startDrawing);
  const drawColor = useStudio((s) => s.drawColor);
  const drawWidth = useStudio((s) => s.drawWidth);
  const wantEdit = useStudio((s) => s.wantEdit);
  const setZoom = useStudio((s) => s.setZoom);
  const focusPage = useStudio((s) => s.focusPage);
  const active = useStudio((s) => s.pageIndex === index);
  const tool = useStudio((s) => s.tool);

  function page(): ComicPage | null {
    return useStudio.getState().project?.pages[index] ?? null;
  }

  const paint = useCallback(() => {
    const cv = canvasRef.current;
    const pg = useStudio.getState().project?.pages[index];
    if (!cv || !pg) return;
    const ctx = preparePageCanvas(cv, pg.w, pg.h);
    if (!ctx) return;
    pg.items.forEach((it) => {
      if (it.type === "image") loadImageAsset(it.assetId, schedule);
      if (it.type === "video") {
        loadVideoAsset(it.assetId, schedule);
        tickVideoClip(it);
      }
    });
    if (pg.background.assetId) loadImageAsset(pg.background.assetId, schedule);
    drawPage(ctx, pg, getMediaBag(), {
      selectedId: useStudio.getState().pageIndex === index ? useStudio.getState().selectedId : null,
      language: useStudio.getState().previewLanguage,
      translations: useStudio.getState().project?.translations[useStudio.getState().previewLanguage],
      sourceLanguage: useStudio.getState().project?.sourceLanguage,
      guides: useStudio.getState().pageIndex === index ? guidesRef.current : undefined,
      displayW: cv.getBoundingClientRect().width,
      handles: !editing,
    });
  }, [editing, index]);

  const schedule = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      paint();
    });
  }, [paint]);

  useLayoutEffect(() => {
    if (onScreen) paint();
  }, [paint, liveGen, selectedId, mediaTick, active, onScreen]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const root = stageRef.current;
    if (!wrap || !root) return;
    const obs = new IntersectionObserver(
      ([e]) => setOnScreen(e.isIntersecting),
      { root, rootMargin: "180px", threshold: 0.01 },
    );
    obs.observe(wrap);
    return () => obs.disconnect();
  }, [stageRef]);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ro = new ResizeObserver(() => {
      if (onScreen) schedule();
    });
    ro.observe(cv);
    return () => ro.disconnect();
  }, [schedule, onScreen]);

  useEffect(() => {
    let id = 0;
    let live = true;
    const loop = () => {
      if (!live) return;
      const pg = useStudio.getState().project?.pages[index];
      const bag = getMediaBag();
      const playing = pg?.items.some((i) => i.type === "video" && bag.videos[i.assetId] && !bag.videos[i.assetId].paused);
      if (playing && onScreen) paint();
      if (playing) id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [index, paint, mediaTick, onScreen]);

  useEffect(() => {
    const pg = page();
    const sel = pg?.items.find((i) => i.id === selectedId);
    if (!sel || !wrapRef.current || !canvasRef.current || !pg || !active) {
      setFloatPos(null);
      return;
    }
    const r = canvasRef.current.getBoundingClientRect();
    const w = wrapRef.current.getBoundingClientRect();
    setFloatPos({
      x: ((sel.x + sel.w / 2) / pg.w) * r.width + (r.left - w.left),
      y: (sel.y / pg.h) * r.height + (r.top - w.top) - 8,
    });
  }, [selectedId, liveGen, active, index]);

  useEffect(() => {
    const p = useStudio.getState().project;
    if (!p) return;
    collectAssetIds({ ...p, pages: [p.pages[index]].filter(Boolean) } as typeof p).forEach((id) => {
      loadImageAsset(id, schedule);
      loadVideoAsset(id, schedule);
    });
    page()
      ?.items.filter((i) => i.type === "video")
      .forEach((i) => {
        if (i.type === "video") seekVideo(i.assetId, i.trimStart || 0);
      });
  }, [index, liveGen, schedule]);

  useEffect(() => {
    if (wantEdit && active) {
      setEditing(wantEdit);
    }
  }, [wantEdit, active]);

  function toScene(ev: { clientX: number; clientY: number }) {
    const cv = canvasRef.current;
    const pg = page();
    if (!cv || !pg) return { x: 0, y: 0 };
    const r = cv.getBoundingClientRect();
    return {
      x: ((ev.clientX - r.left) / r.width) * pg.w,
      y: ((ev.clientY - r.top) / r.height) * pg.h,
    };
  }

  function grabOn(el: HTMLCanvasElement, pointerId: number) {
    interacting = true;
    setGrab(true);
    try {
      el.setPointerCapture(pointerId);
    } catch {
      /* ignore */
    }
  }

  function grabOff() {
    interacting = false;
    setGrab(false);
  }

  function onPointerDown(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (ev.button !== 0) return;
    focusPage(index);
    const pg = page();
    if (!pg) return;
    const pt = toScene(ev);
    const el = ev.currentTarget;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });

    if (pointers.current.size === 2) {
      ev.preventDefault();
      grabOn(el, ev.pointerId);
      const pts = [...pointers.current.values()];
      const sel = useStudio.getState().selected();
      const media = sel && (sel.type === "image" || sel.type === "video") ? sel : null;
      pinch.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        zoom: useStudio.getState().viewZoom,
        itemId: media ? media.id : undefined,
        itemZoom: media ? (isFramedMedia(media) ? media.zoom || 1 : 1) : undefined,
      };
      drag.current = null;
      return;
    }

    if (useStudio.getState().tool === "panel") {
      ev.preventDefault();
      grabOn(el, ev.pointerId);
      snapHistory();
      let nid = "";
      mutateLive((pgLive) => {
        const created = addPanelToPage(pgLive, { x: pt.x, y: pt.y, w: 32, h: 32 });
        nid = created.id;
      });
      if (nid) select(nid);
      drag.current = {
        mode: "resize",
        id: nid,
        hitId: nid,
        corner: "se",
        lastX: pt.x,
        lastY: pt.y,
        startX: pt.x,
        startY: pt.y,
        clientX: ev.clientX,
        clientY: ev.clientY,
        moved: false,
        spawned: true,
      };
      return;
    }

    if (useStudio.getState().tool === "draw") {
      ev.preventDefault();
      grabOn(el, ev.pointerId);
      snapHistory();
      let drawing = useStudio.getState().selected() as DrawingItem | null;
      if (!drawing || drawing.type !== "drawing") drawing = startDrawing();
      if (drawing) {
        mutateLive((pgLive) => {
          const it = pgLive.items.find((x) => x.id === drawing!.id) as DrawingItem | undefined;
          if (!it) return;
          it.color = drawColor;
          it.width = drawWidth;
          it.points.push({ x: pt.x, y: pt.y });
        });
        schedule();
        drag.current = {
          mode: "draw",
          id: drawing.id,
          hitId: drawing.id,
          lastX: pt.x,
          lastY: pt.y,
          startX: pt.x,
          startY: pt.y,
          clientX: ev.clientX,
          clientY: ev.clientY,
          moved: false,
        };
      }
      return;
    }

    if (useStudio.getState().tool === "pan") {
      ev.preventDefault();
      grabOn(el, ev.pointerId);
      drag.current = {
        mode: "pan",
        id: "",
        hitId: null,
        lastX: ev.clientX,
        lastY: ev.clientY,
        startX: ev.clientX,
        startY: ev.clientY,
        clientX: ev.clientX,
        clientY: ev.clientY,
        moved: false,
      };
      return;
    }

    const sel = pg.items.find((i) => i.id === selectedId);
    const hs = handleSize(pg.w, canvasRef.current!.getBoundingClientRect().width);
    if (sel && !sel.locked) {
      const corner = resizeCorner(pt, sel, hs);
      if (corner === "rot" || corner === "tail" || corner) {
        ev.preventDefault();
        grabOn(el, ev.pointerId);
        snapHistory();
        drag.current = {
          mode: corner === "rot" ? "rotate" : corner === "tail" ? "tail" : "resize",
          id: sel.id,
          hitId: sel.id,
          corner: corner === "rot" || corner === "tail" ? undefined : corner,
          lastX: pt.x,
          lastY: pt.y,
          startX: pt.x,
          startY: pt.y,
          clientX: ev.clientX,
          clientY: ev.clientY,
          moved: false,
        };
        return;
      }
    }

    const hit = hitTest(pg, pt.x, pt.y);
    drag.current = {
      mode: "pending",
      id: hit && !hit.locked ? hit.id : "",
      hitId: hit?.id ?? null,
      lastX: pt.x,
      lastY: pt.y,
      startX: pt.x,
      startY: pt.y,
      clientX: ev.clientX,
      clientY: ev.clientY,
      moved: false,
    };
  }

  function onPointerMove(ev: React.PointerEvent<HTMLCanvasElement>) {
    if (pointers.current.has(ev.pointerId)) {
      pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    }
    if (pinch.current && pointers.current.size >= 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinch.current.dist > 8) {
        if (pinch.current.itemId && pinch.current.itemZoom != null) {
          mutateLive((pgLive) => {
            const it = pgLive.items.find((x) => x.id === pinch.current!.itemId);
            if (!it || (it.type !== "image" && it.type !== "video")) return;
            const k = dist / pinch.current!.dist;
            if (it.panelId && !it.free) {
              it.zoom = Math.max(0.5, Math.min(4, pinch.current!.itemZoom! * k));
            } else {
              scaleFromCenter(it, k, pgLive);
              pinch.current!.dist = dist;
            }
          });
          schedule();
        } else {
          setZoom(Math.max(1, pinch.current.zoom * (dist / pinch.current.dist)));
        }
      }
      return;
    }

    const d = drag.current;
    if (!d) return;
    const pg = page();
    if (!pg) return;

    const dist = Math.hypot(ev.clientX - d.clientX, ev.clientY - d.clientY);
    if (d.mode === "pending" && dist > TAP_PX) {
      d.moved = true;
      const hit = d.hitId ? pg.items.find((x) => x.id === d.hitId) : null;
      const selectedNow = useStudio.getState().selectedId;
      const canEdit = !!(hit && !hit.locked && hit.id === selectedNow);
      if (canEdit) {
        ev.preventDefault();
        grabOn(ev.currentTarget, ev.pointerId);
        snapHistory();
        d.mode = isFramedMedia(hit) ? "crop" : "move";
        d.id = hit.id;
      } else {
        drag.current = null;
        return;
      }
    }

    if (d.mode === "pending") return;

    if (d.mode === "pan") {
      const stage = stageRef.current;
      if (stage) {
        stage.scrollLeft -= ev.clientX - d.lastX;
        stage.scrollTop -= ev.clientY - d.lastY;
      }
      d.lastX = ev.clientX;
      d.lastY = ev.clientY;
      d.moved = true;
      return;
    }

    const pt = toScene(ev);
    const dx = pt.x - d.lastX;
    const dy = pt.y - d.lastY;
    d.lastX = pt.x;
    d.lastY = pt.y;
    d.moved = true;
    mutateLive((pgLive) => {
      const it = pgLive.items.find((x) => x.id === d.id);
      if (!it) return;
      if (d.mode === "draw" && it.type === "drawing") {
        it.points.push({ x: pt.x, y: pt.y });
        it.color = drawColor;
        it.width = drawWidth;
        return;
      }
      if (d.mode === "tail" && it.type === "bubble") {
        it.tx = pt.x;
        it.ty = pt.y;
        return;
      }
      if (d.mode === "rotate") {
        applyRotate(it, pt, ev.shiftKey);
        return;
      }
      if (d.mode === "crop" && (it.type === "image" || it.type === "video")) {
        panCrop(it, dx, dy);
        return;
      }
      if (d.mode === "resize" && d.corner) {
        const aspect =
          (it.type === "image" || it.type === "video") && it.aspectLock && !ev.shiftKey
            ? it.w / Math.max(1, it.h)
            : null;
        applyResize(it, d.corner, dx, dy, aspect);
        if ((it.type === "image" || it.type === "video") && it.panelId && !it.free) {
          const owner = pgLive.items.find((p) => p.type === "panel" && p.id === it.panelId);
          if (owner) {
            owner.x = it.x;
            owner.y = it.y;
            owner.w = it.w;
            owner.h = it.h;
          }
        }
        if (it.type === "panel") {
          pgLive.items
            .filter((c) => c.panelId === it.id && (c.type === "image" || c.type === "video") && !c.free)
            .forEach((c) => {
              c.x = it.x;
              c.y = it.y;
              c.w = it.w;
              c.h = it.h;
            });
        }
        clampItem(it, pgLive);
        return;
      }
      if (d.mode === "move") {
        moveItem(it, dx, dy, pgLive);
        const g = snapItem(it, pgLive, snap);
        setGuides(g);
        clampItem(it, pgLive);
      }
    });
    schedule();
  }

  function onPointerUp(ev: React.PointerEvent<HTMLCanvasElement>) {
    pointers.current.delete(ev.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const d = drag.current;
    drag.current = null;
    setGuides({ x: null, y: null });
    grabOff();
    if (!d) return;

    if (d.mode === "pending" && !d.moved) {
      if (d.hitId) {
        select(d.hitId);
        const hit = page()?.items.find((x) => x.id === d.hitId);
        if (ev.detail === 2 && hit && (hit.type === "bubble" || hit.type === "text")) {
          setEditing(hit.id);
        }
        if (ev.detail === 2 && hit && isFramedMedia(hit)) {
          mutateLive((pgLive) => {
            const it = pgLive.items.find((x) => x.id === hit.id);
            if (it && (it.type === "image" || it.type === "video")) {
              it.zoom = (it.zoom || 1) < 1.45 ? 1.85 : 1;
              if (it.zoom === 1) {
                it.cropX = 0;
                it.cropY = 0;
              }
            }
          });
          flushLive();
        }
      } else {
        select(null);
        setEditing(null);
      }
      return;
    }

    if (d.mode !== "pan") flushLive();
    if (d.mode === "draw") useStudio.getState().setTool("draw");
    if (d.spawned) {
      mutateLive((pgLive) => {
        const it = pgLive.items.find((x) => x.id === d.id);
        if (!it) return;
        if (it.w < 72 || it.h < 72) {
          it.w = Math.max(it.w, pgLive.w * 0.5);
          it.h = Math.max(it.h, pgLive.h * 0.22);
          clampItem(it, pgLive);
        }
      });
      flushLive();
      useStudio.getState().setTool("select");
    }
  }

  function onDrop(ev: React.DragEvent) {
    ev.preventDefault();
    const files = [...ev.dataTransfer.files];
    if (!files.length) return;
    focusPage(index);
    const pt = toScene(ev);
    const pg = page();
    const panel = pg ? panelAt(pg, pt.x, pt.y) : null;
    void importFiles(files, { target: panel ? "panel" : "page", panelId: panel?.id });
  }

  const pg = page();
  if (!pg) return null;
  const selected = active ? (pg.items.find((i) => i.id === selectedId) ?? null) : null;
  const framed = isFramedMedia(selected);
  const filled = new Set(
    pg.items.filter((i) => (i.type === "image" || i.type === "video") && i.panelId && !i.free).map((i) => i.panelId as string),
  );
  const emptyPanels = pg.items.filter((i): i is Extract<ComicItem, { type: "panel" }> => i.type === "panel" && !filled.has(i.id) && !i.hidden);

  return (
    <div
      ref={wrapRef}
      className="page-leaf relative mb-1 w-full"
      style={{ aspectRatio: `${pg.w} / ${pg.h}` }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 size-full select-none bg-paper ${grab ? "touch-none" : ""}`}
        style={{ touchAction: grab ? "none" : "pan-y" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-none absolute start-2 top-2 rounded-full bg-bg/70 px-2 py-0.5 text-[10px] text-fg">
        {index + 1}
      </div>
      {emptyPanels.map((panel) => {
        const c = panelCentroid(panel);
        return (
          <button
            key={panel.id}
            type="button"
            className="absolute z-[6] flex items-center justify-center"
            style={{
              left: `${(panel.x / pg.w) * 100}%`,
              top: `${(panel.y / pg.h) * 100}%`,
              width: `${(panel.w / pg.w) * 100}%`,
              height: `${(panel.h / pg.h) * 100}%`,
              pointerEvents: "none",
              clipPath: cssClipForPanel(panel),
            }}
          >
            <span
              className="pointer-events-auto absolute rounded-full bg-bg/80 px-3 py-2 text-xs text-fg shadow-[var(--shadow-lift)]"
              style={{
                left: `${((c.x - panel.x) / panel.w) * 100}%`,
                top: `${((c.y - panel.y) / panel.h) * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
              onClick={(e) => {
                e.stopPropagation();
                focusPage(index);
                select(panel.id);
                useStudio.getState().setSheet("media");
              }}
            >
              تصویر یا ویدئو
            </span>
          </button>
        );
      })}
      {active && tool === "panel" && (
        <div className="pointer-events-none absolute inset-x-2 top-8 rounded-md bg-bg/80 px-2 py-1.5 text-center text-[11px] text-fg">
          روی صفحه بکش تا قاب تازه ساخته شود
        </div>
      )}
      {active && framed && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-bg/70 px-2 py-1 text-center text-[10px] text-fg">
          بکش: جابه‌جایی داخل قاب · گوشه‌ها: اندازه · دو انگشت: بزرگ‌نمایی
        </div>
      )}
      {active && selected && (selected.type === "image" || selected.type === "video") && !framed && (
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-md bg-bg/70 px-2 py-1 text-center text-[10px] text-fg">
          گوشه‌های سبز را بکش یا دو انگشت بزن تا کوچک و بزرگ شود
        </div>
      )}
      {editing && selected && (selected.type === "bubble" || selected.type === "text") && (
        <InlineEdit item={selected} pageW={pg.w} pageH={pg.h} onDone={() => { setEditing(null); useStudio.getState().requestEdit(null); }} />
      )}
      {floatPos && selected && !editing && (
        <div
          className="absolute z-10 hidden -translate-x-1/2 -translate-y-full gap-1 rounded-lg bg-bg/95 p-1 shadow-[var(--shadow-lift)] lg:flex"
          style={{ left: floatPos.x, top: Math.max(8, floatPos.y) }}
        >
          <IconBtn
            label="تصویر"
            onClick={() => onPickFiles("image", selected.type === "panel" ? selected.id : selected.panelId)}
          >
            <ImagePlus className="size-4" />
          </IconBtn>
          <IconBtn
            label="ویدئو"
            onClick={() => onPickFiles("video", selected.type === "panel" ? selected.id : selected.panelId)}
          >
            <Film className="size-4" />
          </IconBtn>
          {(selected.type === "bubble" || selected.type === "text") && (
            <IconBtn label="نوشتن" onClick={() => setEditing(selected.id)}>
              <Type className="size-4" />
            </IconBtn>
          )}
          <IconBtn label="کپی" onClick={duplicateSelected}>
            <Copy className="size-4" />
          </IconBtn>
          <IconBtn label={selected.locked ? "بازکردن قفل" : "قفل"} onClick={toggleLock}>
            {selected.locked ? <Unlock className="size-4" /> : <Lock className="size-4" />}
          </IconBtn>
          <IconBtn label="حذف" onClick={deleteSelected}>
            <Trash2 className="size-4" />
          </IconBtn>
        </div>
      )}
    </div>
  );
}

function MusicRail({
  pageEls,
  pageKey,
  onAddMusic,
}: {
  pageEls: React.MutableRefObject<Map<string, HTMLDivElement>>;
  pageKey: string;
  onAddMusic: () => void;
}) {
  const project = useStudio((s) => s.project);
  const liveGen = useStudio((s) => s.liveGen);
  const setAmbientThrough = useStudio((s) => s.setAmbientThrough);
  const clearAmbient = useStudio((s) => s.clearAmbient);
  const railRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [geom, setGeom] = useState<{
    top: number;
    height: number;
    pages: { index: number; top: number; height: number }[];
  }>({ top: 0, height: 0, pages: [] });

  const measure = useCallback(() => {
    if (!project?.pages.length) return;
    const host = railRef.current?.parentElement;
    if (!host) return;
    const pages = project.pages.map((p, i) => {
      const el = pageEls.current.get(p.id);
      return {
        index: i,
        top: el ? el.offsetTop : 0,
        height: el ? el.offsetHeight : 0,
      };
    });
    const first = pages[0];
    const last = pages[pages.length - 1];
    const top = first?.top ?? 0;
    const height = last ? last.top + last.height - top : 0;
    setGeom({ top, height, pages });
  }, [project, pageEls]);

  useLayoutEffect(() => {
    measure();
    const id = requestAnimationFrame(measure);
    const host = railRef.current?.parentElement;
    if (!host) return () => cancelAnimationFrame(id);
    const ro = new ResizeObserver(() => measure());
    ro.observe(host);
    pageEls.current.forEach((el) => ro.observe(el));
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [measure, pageKey, liveGen]);

  if (!project?.pages.length) return null;
  const span = musicSpan(project);
  const pages = project.pages;
  const lineTop = geom.top + 56;
  const lineH = Math.max(48, geom.height - 68);
  const lineBot = lineTop + lineH;
  const yOf = (index: number, edge: "top" | "bottom") => {
    const row = geom.pages[index];
    if (!row) return edge === "top" ? lineTop : lineBot;
    return edge === "top" ? row.top : row.top + row.height;
  };
  const handleY = span ? Math.min(lineBot - 8, Math.max(lineTop + 36, yOf(span.end, "bottom") - 12)) : lineTop + 36;

  function pageAtClientY(clientY: number) {
    const root = railRef.current?.parentElement;
    if (!root) return 0;
    const y = clientY - root.getBoundingClientRect().top;
    for (let i = 0; i < pages.length; i++) {
      const row = geom.pages[i];
      if (!row) continue;
      if (y <= row.top + row.height) return i;
    }
    return Math.max(0, pages.length - 1);
  }

  function dragTo(clientY: number) {
    if (!span) return;
    setAmbientThrough(pageAtClientY(clientY));
  }

  const handleLabel = span
    ? span.end >= pages.length - 1
      ? "آخر"
      : `${span.end + 1}`
    : "";

  return (
    <div ref={railRef} className="pointer-events-none absolute top-0 right-0 z-20 h-full w-16">
      <button
        type="button"
        className="pointer-events-auto absolute right-1.5 z-10 grid size-11 place-items-center rounded-xl bg-elevated text-fg shadow-[var(--shadow-lift)]"
        style={{ top: Math.max(8, geom.top + 8) }}
        aria-label={span ? "عوض کردن موسیقی پس‌زمینه" : "افزودن موسیقی پس‌زمینه"}
        title={span ? "موسیقی پس‌زمینه" : "افزودن موسیقی پس‌زمینه"}
        onClick={(e) => {
          e.stopPropagation();
          onAddMusic();
        }}
      >
        <Music className="size-4" />
      </button>

      <div
        className="pointer-events-auto absolute right-0 w-16 cursor-ns-resize"
        style={{
          top: lineTop,
          height: lineH,
        }}
        role="slider"
        aria-label="تا این صفحه صدا پخش شود"
        aria-valuemin={1}
        aria-valuemax={pages.length}
        aria-valuenow={(span?.end ?? 0) + 1}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!span) {
            onAddMusic();
            return;
          }
          dragging.current = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          dragTo(e.clientY);
        }}
        onPointerMove={(e) => {
          if (!dragging.current) return;
          dragTo(e.clientY);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <div
          className="absolute right-[22px] top-0 h-full w-2 rounded-full"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in oklab, var(--color-steel) 28%, transparent), color-mix(in oklab, var(--color-steel) 55%, transparent), color-mix(in oklab, var(--color-steel) 28%, transparent))",
            boxShadow: "inset 1px 0 0 rgba(255,255,255,0.28), inset -1px 0 0 rgba(0,0,0,0.35), 0 0 10px color-mix(in oklab, var(--color-steel) 32%, transparent)",
          }}
        />
      </div>

      {span && (
        <div
          className="absolute right-[22px] w-2 overflow-hidden rounded-full"
          style={{
            top: lineTop,
            height: Math.max(16, handleY - lineTop),
            background: "linear-gradient(90deg, #6f849c 0%, #d7e4f2 46%, #8aa0b8 100%)",
            boxShadow: "0 0 14px color-mix(in oklab, var(--color-steel) 45%, transparent)",
          }}
        >
          <div className="absolute inset-y-0 start-0 w-1/3 bg-white/30" />
        </div>
      )}

      {geom.pages.map((row, i) => (
        <div
          key={pages[i]?.id ?? i}
          className="absolute right-[18px] h-0.5 w-4 rounded-full bg-steel/70"
          style={{ top: row.top + row.height }}
        />
      ))}

      {span && (
        <>
          <button
            type="button"
            className="pointer-events-auto absolute right-1 flex size-12 flex-col items-center justify-center rounded-full text-bg shadow-[var(--shadow-lift)]"
            style={{
              top: handleY - 24,
              background: "linear-gradient(160deg, #eef4fa 0%, #9eb0c8 48%, #6d8299 100%)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55), 0 8px 18px rgba(0,0,0,0.35)",
            }}
            aria-label="تا اینجا پخش شود"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              dragging.current = true;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* ignore */
              }
            }}
            onPointerMove={(e) => {
              if (!dragging.current) return;
              setAmbientThrough(pageAtClientY(e.clientY));
            }}
            onPointerUp={() => {
              dragging.current = false;
            }}
            onPointerCancel={() => {
              dragging.current = false;
            }}
          >
            <span className="text-[11px] font-semibold leading-none text-bg">{handleLabel}</span>
          </button>
          <button
            type="button"
            className="pointer-events-auto absolute right-2.5 grid size-8 place-items-center rounded-full bg-bg text-muted shadow-[var(--shadow-border)]"
            style={{ top: Math.max(8, geom.top + 52) }}
            aria-label="حذف موسیقی"
            onClick={(e) => {
              e.stopPropagation();
              clearAmbient();
            }}
          >
            <X className="size-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-11 place-items-center rounded-md text-fg hover:bg-elevated"
    >
      {children}
    </button>
  );
}

function InlineEdit({
  item,
  pageW,
  pageH,
  onDone,
}: {
  item: ComicItem;
  pageW: number;
  pageH: number;
  onDone: () => void;
}) {
  const patchItem = useStudio((s) => s.patchItem);
  const [val, setVal] = useState("text" in item ? item.text : "");

  function commit() {
    patchItem(item.id, { text: val } as Partial<ComicItem>, true);
    useStudio.getState().requestEdit(null);
    onDone();
  }

  return (
    <div
      className="absolute z-20 flex flex-col gap-1"
      style={{
        left: `${(item.x / pageW) * 100}%`,
        top: `${(item.y / pageH) * 100}%`,
        width: `${Math.max(36, (item.w / pageW) * 100)}%`,
      }}
    >
      <textarea
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="min-h-16 w-full resize-none rounded-md bg-white p-2 text-center text-ink shadow-[var(--shadow-lift)]"
        style={{ fontSize: `${Math.max(14, ("font" in item ? item.font : 24) * 0.42)}px` }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Escape") {
            useStudio.getState().requestEdit(null);
            onDone();
          }
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 flex gap-2 bg-bg/95 p-3 shadow-[var(--shadow-lift)] lg:static lg:bg-transparent lg:p-0 lg:shadow-none">
        <button type="button" className="h-12 flex-1 rounded-md bg-primary text-sm font-semibold text-primary-fg" onClick={commit}>
          ثبت
        </button>
        <button type="button" className="h-12 flex-1 rounded-md bg-elevated text-sm text-fg shadow-[var(--shadow-border)]" onClick={() => { useStudio.getState().requestEdit(null); onDone(); }}>
          انصراف
        </button>
      </div>
    </div>
  );
}
