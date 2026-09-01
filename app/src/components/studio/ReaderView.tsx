import { useEffect, useRef, useState } from "react";
import { useAppNav } from "@/lib/comic/nav";
import { Maximize2, Pause, Play, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawPage } from "@/lib/comic/draw";
import { collectAssetIds, ensureAllUrls, getProject, mediaUrl } from "@/lib/comic/db";
import {
  getMediaBag,
  loadImageAsset,
  loadVideoAsset,
  playVideo,
  pauseAllVideos,
  pauseVideo,
  tickVideoClip,
} from "@/lib/comic/media-cache";
import {
  advanceReveal,
  ambientForPage,
  containFit,
  easeOutCubic,
  lerpCamera,
  pageBeats,
  revealedItemIds,
  revealCamera,
  retreatReveal,
  swipeDirection,
  type Beat,
  type CameraRect,
} from "@/lib/comic/reader";
import type { ComicProject } from "@/lib/comic/types";

const CAM_MS = 740;
const FADE_MS = 560;
const VEIL_MS = 280;
const CINEMA = "#07080c";

interface CamAnim {
  from: CameraRect;
  to: CameraRect;
  t0: number;
  dur: number;
}

export function ReaderView({ id }: { id: string }) {
  const go = useAppNav();
  const [project, setProject] = useState<ComicProject | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [revealed, setRevealed] = useState(1);
  const [ended, setEnded] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [hud, setHud] = useState(true);
  const [hint, setHint] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const ambient = useRef<HTMLAudioElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const camAnim = useRef<CamAnim | null>(null);
  const camNow = useRef<CameraRect | null>(null);
  const fade = useRef({ ids: [] as string[], t0: 0 });
  const veil = useRef({ t0: 0, dir: 0 as 0 | 1 | -1 });
  const anim = useRef(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    void (async () => {
      const p = await getProject(id);
      if (!p) return;
      await ensureAllUrls(collectAssetIds(p));
      collectAssetIds(p).forEach((aid) => {
        loadImageAsset(aid);
        loadVideoAsset(aid);
      });
      setProject(p);
    })();
    return () => {
      pauseAllVideos();
      ambient.current?.pause();
      cancelAnimationFrame(anim.current);
    };
  }, [id]);

  const page = project?.pages[pageIndex] ?? null;
  const beats: Beat[] = page ? pageBeats(page) : [];

  function bumpHud() {
    setHud(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setHud(false), 2200);
  }

  function snapCam(target: CameraRect) {
    camNow.current = { ...target };
    camAnim.current = null;
  }

  function moveCam(target: CameraRect) {
    const from = camNow.current ? { ...camNow.current } : { ...target };
    if (reduced.current) {
      snapCam(target);
      return;
    }
    camAnim.current = { from, to: { ...target }, t0: performance.now(), dur: CAM_MS };
  }

  function goPage(i: number, revealCount: number) {
    if (!project) return;
    const idx = Math.max(0, Math.min(project.pages.length - 1, i));
    setEnded(false);
    setPageIndex(idx);
    setRevealed(Math.max(1, revealCount));
    camNow.current = null;
    camAnim.current = null;
    fade.current = { ids: [], t0: 0 };
    veil.current = { t0: performance.now(), dir: 1 };
    bumpHud();
  }

  function forward() {
    if (!project || !page) return;
    setHint(false);
    if (ended) return;
    const next = advanceReveal(revealed, beats.length, pageIndex, project.pages.length);
    if (next.ended) {
      setEnded(true);
      bumpHud();
      return;
    }
    if (next.pageIndex !== pageIndex) {
      goPage(next.pageIndex, 1);
      const nb = pageBeats(project.pages[next.pageIndex]);
      fade.current = { ids: nb[0]?.itemIds ?? [], t0: performance.now() };
    } else {
      const fresh = beats[next.revealed - 1]?.itemIds ?? [];
      fade.current = { ids: fresh, t0: performance.now() };
      const target = revealCamera(beats, next.revealed, page);
      moveCam(target);
      setRevealed(next.revealed);
    }
  }

  function back() {
    if (!project) return;
    setEnded(false);
    setHint(false);
    if (pageIndex === 0 && revealed <= 1) return;
    const prevBeats = pageIndex > 0 ? pageBeats(project.pages[pageIndex - 1]).length : 1;
    const prev = retreatReveal(revealed, pageIndex, prevBeats);
    if (prev.pageIndex !== pageIndex) goPage(prev.pageIndex, prev.revealed);
    else {
      setRevealed(prev.revealed);
      if (page) moveCam(revealCamera(beats, prev.revealed, page));
    }
    bumpHud();
  }

  useEffect(() => {
    bumpHud();
  }, [pageIndex]);

  useEffect(() => {
    if (!page) return;
    pauseAllVideos();
    if (!playing) return;
    const ids = revealedItemIds(beats, revealed);
    page.items.forEach((it) => {
      if (it.type === "video" && ids.has(it.id)) playVideo(it.assetId, it.muted, it.speed, it.volume);
      else if (it.type === "video") pauseVideo(it.assetId);
    });
  }, [page, playing, revealed]);

  useEffect(() => {
    if (!project) return;
    const clip = ambientForPage(project, pageIndex);
    if (!clip) {
      ambient.current?.pause();
      return;
    }
    if (!ambient.current) ambient.current = new Audio();
    const a = ambient.current;
    const src = mediaUrl(clip.assetId);
    if (a.src !== src) a.src = src;
    a.loop = !clip.end || clip.throughPage === -1 || !!clip.continuePages;
    a.currentTime = Math.min(a.currentTime || clip.start, clip.start || 0) || clip.start;
    const fadeIn = Math.max(0, clip.fadeInMs || 0);
    const fadeOut = Math.max(0, clip.fadeOutMs || 0);
    a.volume = fadeIn > 0 ? 0 : clip.volume;
    let raf = 0;
    const t0 = performance.now();
    const tick = () => {
      const now = performance.now();
      let vol = clip.volume;
      if (fadeIn > 0) vol = Math.min(clip.volume, clip.volume * ((now - t0) / fadeIn));
      if (clip.end > 0 && fadeOut > 0) {
        const remain = (clip.end - a.currentTime) * 1000;
        if (remain < fadeOut) vol = Math.min(vol, clip.volume * Math.max(0, remain / fadeOut));
      }
      a.volume = Math.max(0, Math.min(1, vol));
      if (!a.paused) raf = requestAnimationFrame(tick);
    };
    if (playing) {
      void a.play().catch(() => undefined);
      raf = requestAnimationFrame(tick);
    } else a.pause();
    return () => cancelAnimationFrame(raf);
  }, [project, pageIndex, playing]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!project) return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " " || e.key === "Enter") {
        e.preventDefault();
        forward();
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key === "Backspace") {
        e.preventDefault();
        back();
      }
      if (e.key === "Escape") go("/studio/$id", { id });
      if (e.key === "f" || e.key === "F") void document.documentElement.requestFullscreen?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    const wrap = wrapRef.current;
    const cv = canvasRef.current;
    if (!wrap || !cv || !page) return;
    let live = true;

    const paint = () => {
      if (!live || !page) return;
      const r = wrap.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cssW = Math.max(1, r.width);
      const cssH = Math.max(1, r.height);
      const bw = Math.round(cssW * dpr);
      const bh = Math.round(cssH * dpr);
      if (cv.width !== bw) cv.width = bw;
      if (cv.height !== bh) cv.height = bh;
      const ctx = cv.getContext("2d");
      if (!ctx) return;

      const now = performance.now();
      const target = revealCamera(beats, revealed, page);
      if (!camNow.current) {
        camNow.current = { ...target };
        camAnim.current = null;
      }
      if (camAnim.current) {
        const t = easeOutCubic((now - camAnim.current.t0) / camAnim.current.dur);
        camNow.current = t >= 1 ? { ...camAnim.current.to } : lerpCamera(camAnim.current.from, camAnim.current.to, t);
        if (t >= 1) camAnim.current = null;
      }

      const age = now - fade.current.t0;
      const fadeT = fade.current.ids.length ? Math.min(1, age / FADE_MS) : 1;
      const ease = easeOutCubic(fadeT);
      const opacityMul: Record<string, number> = {};
      fade.current.ids.forEach((fid) => {
        opacityMul[fid] = ease;
      });

      const visible = revealedItemIds(beats, revealed);
      const hideIds = new Set(page.items.filter((it) => !visible.has(it.id)).map((it) => it.id));

      page.items.forEach((it) => {
        if (it.type === "image" && visible.has(it.id)) loadImageAsset(it.assetId, () => schedule());
        if (it.type === "video" && visible.has(it.id)) {
          loadVideoAsset(it.assetId, () => schedule());
          tickVideoClip(it);
        }
      });

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = CINEMA;
      ctx.fillRect(0, 0, bw, bh);

      const camR = camNow.current;
      const { scale, ox, oy } = containFit(camR, bw, bh);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, bw, bh);
      ctx.clip();
      ctx.setTransform(scale, 0, 0, scale, ox - camR.x * scale, oy - camR.y * scale);

      drawPage(ctx, page, getMediaBag(), {
        handles: false,
        hideIds,
        opacityMul,
        skipBackground: true,
      });

      ctx.restore();

      let veilA = 0;
      if (veil.current.dir) {
        const vt = Math.min(1, (now - veil.current.t0) / VEIL_MS);
        veilA = veil.current.dir === 1 ? 1 - easeOutCubic(vt) : easeOutCubic(vt);
        if (vt >= 1) veil.current.dir = 0;
      }
      if (veilA > 0.01) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = `rgba(7,8,12,${veilA})`;
        ctx.fillRect(0, 0, bw, bh);
      }

      const bag = getMediaBag();
      const playingVid = page.items.some(
        (i) => i.type === "video" && visible.has(i.id) && bag.videos[i.assetId] && !bag.videos[i.assetId].paused,
      );
      if (camAnim.current || fadeT < 1 || veil.current.dir || playingVid) schedule();
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        paint();
      });
    };
    anim.current = 0;
    paint();
    const ro = new ResizeObserver(() => schedule());
    ro.observe(wrap);
    return () => {
      live = false;
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [page, revealed, beats.length, pageIndex]);

  if (!project) {
    return <div className="grid min-h-dvh place-items-center bg-bg text-muted">در حال آماده‌سازی خواننده…</div>;
  }

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-10 flex items-start justify-between p-3 transition-opacity duration-200 ${hud ? "opacity-100" : "opacity-0"}`}
      >
        <div className="pointer-events-auto flex gap-2">
          <Button variant="secondary" size="icon" onClick={() => go("/studio/$id", { id })} aria-label="بستن">
            <X />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => setPlaying((v) => !v)} aria-label="پخش">
            {playing ? <Pause /> : <Play />}
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void document.documentElement.requestFullscreen?.()}
            aria-label="تمام‌صفحه"
          >
            <Maximize2 />
          </Button>
        </div>
        <div className="rounded-full bg-bg/70 px-3 py-1 text-xs backdrop-blur">{project.title}</div>
      </div>

      <div
        ref={wrapRef}
        className="absolute inset-0"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role='button']")) return;
          swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          if ((e.target as HTMLElement).closest("button, a, [role='button']")) return;
          if (ended) return;
          const start = swipe.current;
          swipe.current = null;
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          const dir = swipeDirection(dx, dy, 72);
          if (dir === "next") {
            forward();
            return;
          }
          if (dir === "prev") {
            back();
            return;
          }
          if (Math.abs(dx) < 16 && Math.abs(dy) < 16) forward();
        }}
      >
        <canvas ref={canvasRef} className="block size-full touch-none" />
        {hint && !ended && (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 text-center">
            <span className="rounded-full bg-bg/75 px-4 py-2 text-sm text-fg shadow-[var(--shadow-lift)] backdrop-blur">
              بزن تا قاب بعدی باز شود
            </span>
          </div>
        )}
      </div>

      {ended && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 p-6">
          <div className="w-full max-w-sm rounded-xl bg-surface p-6 text-center shadow-[var(--shadow-lift)]">
            <h2 className="text-lg font-semibold">تمام شد</h2>
            <p className="mt-1 text-sm text-muted">{project.title}</p>
            <div className="mt-5 flex flex-col gap-2">
              <Button
                onClick={() => {
                  goPage(0, 1);
                  setHint(true);
                }}
              >
                <RotateCcw /> دوباره بخوان
              </Button>
              <Button variant="outline" onClick={() => go("/studio/$id", { id })}>
                برگشت به ویرایشگر
              </Button>
              <Button variant="ghost" onClick={() => go("/")}>
                بستن
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
