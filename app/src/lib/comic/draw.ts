import { clamp } from "@/lib/utils";
import { fontString } from "./fonts";
import { handleSize, roundRect } from "./geometry";
import { tracePanelPath } from "./panel-shape";
import type {
  BubbleItem,
  ComicItem,
  ComicPage,
  DrawingItem,
  ImageItem,
  PanelItem,
  ShapeItem,
  TextItem,
  VideoItem,
} from "./types";

export interface MediaBag {
  images: Record<string, HTMLImageElement | HTMLCanvasElement>;
  videos: Record<string, HTMLVideoElement>;
}

export function sourceSize(src: CanvasImageSource | null | undefined) {
  if (!src) return { w: 0, h: 0 };
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  if (src instanceof HTMLImageElement)
    return { w: src.naturalWidth || src.width, h: src.naturalHeight || src.height };
  return { w: 0, h: 0 };
}

export function preparePageCanvas(cv: HTMLCanvasElement, pageW: number, pageH: number) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(r.width * dpr));
  const h = Math.max(1, Math.round(r.height * dpr));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(w / pageW, 0, 0, h / pageH, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = w * h > 1_400_000 ? "medium" : "high";
  return ctx;
}

export function drawPage(
  ctx: CanvasRenderingContext2D,
  page: ComicPage,
  media: MediaBag,
  opts: {
    selectedId?: string | null;
    language?: string;
    translations?: Record<string, string>;
    sourceLanguage?: string;
    skipBackground?: boolean;
    hideIds?: Set<string>;
    opacityMul?: Record<string, number>;
    timeMs?: number;
    videoTime?: Record<string, number>;
    guides?: { x: number | null; y: number | null };
    displayW?: number;
    handles?: boolean;
  } = {},
) {
  ctx.save();
  if (!opts.skipBackground) {
    ctx.clearRect(0, 0, page.w, page.h);
    drawBackground(ctx, page, media);
  }
  for (const it of page.items) {
    if (it.hidden) continue;
    if (opts.hideIds?.has(it.id)) continue;
    ctx.save();
    const mul = opts.opacityMul?.[it.id];
    if (mul != null) ctx.globalAlpha *= Math.max(0, Math.min(1, mul));
    drawItem(ctx, it, media, opts, page);
    ctx.restore();
  }
  if (opts.guides && (opts.guides.x != null || opts.guides.y != null)) {
    ctx.save();
    ctx.strokeStyle = "#6cc6db";
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 8]);
    ctx.globalAlpha = 0.72;
    if (opts.guides.x != null) {
      ctx.beginPath();
      ctx.moveTo(opts.guides.x, 0);
      ctx.lineTo(opts.guides.x, page.h);
      ctx.stroke();
    }
    if (opts.guides.y != null) {
      ctx.beginPath();
      ctx.moveTo(0, opts.guides.y);
      ctx.lineTo(page.w, opts.guides.y);
      ctx.stroke();
    }
    ctx.restore();
  }
  const sel = page.items.find((i) => i.id === opts.selectedId);
  if (opts.handles && sel && !sel.hidden) {
    drawHandles(ctx, sel, handleSize(page.w, opts.displayW ?? page.w));
  }
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, page: ComicPage, media: MediaBag) {
  ctx.fillStyle = page.background.color || "#ffffff";
  ctx.fillRect(0, 0, page.w, page.h);
  const img = page.background.assetId ? media.images[page.background.assetId] : null;
  if (!img) return;
  const { w: iw, h: ih } = sourceSize(img);
  if (!iw || !ih) return;
  const zoom = page.background.zoom || 1;
  const scale = Math.max(page.w / iw, page.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  const ox = page.background.x * ((dw - page.w) / 2);
  const oy = page.background.y * ((dh - page.h) / 2);
  ctx.drawImage(img, (page.w - dw) / 2 + ox, (page.h - dh) / 2 + oy, dw, dh);
}

function textFor(
  it: ComicItem,
  opts: { language?: string; translations?: Record<string, string>; sourceLanguage?: string },
) {
  if (it.type !== "bubble" && it.type !== "text") return "";
  if (!opts.language || opts.language === (opts.sourceLanguage || "fa")) return it.text;
  return opts.translations?.[it.id] || it.text;
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  it: ComicItem,
  media: MediaBag,
  opts: {
    language?: string;
    translations?: Record<string, string>;
    sourceLanguage?: string;
    timeMs?: number;
    videoTime?: Record<string, number>;
  },
  page: ComicPage,
) {
  if (it.type === "panel") {
    tracePanelPath(ctx, it);
    ctx.fillStyle = it.fill || "#ffffff";
    ctx.fill();
    if (it.stroke > 0) {
      ctx.strokeStyle = it.strokeColor || "#16171A";
      ctx.lineWidth = it.stroke;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.stroke();
    }
    return;
  }
  if (it.type === "image") return drawImage(ctx, it, media, page);
  if (it.type === "video") return drawVideo(ctx, it, media, page);
  if (it.type === "shape") return drawShape(ctx, it);
  if (it.type === "drawing") return drawStroke(ctx, it);
  if (it.type === "bubble") return drawBubble(ctx, it, opts);
  if (it.type === "text") return drawTextBox(ctx, it, opts);
}

function clipForMedia(ctx: CanvasRenderingContext2D, it: ImageItem | VideoItem, page: ComicPage) {
  const owner =
    it.panelId && !it.free
      ? (page.items.find((p) => p.type === "panel" && p.id === it.panelId) as PanelItem | undefined)
      : undefined;
  if (owner) tracePanelPath(ctx, owner);
  else roundRect(ctx, it.x, it.y, it.w, it.h, it.radius || 0);
}

function mediaFrame(
  ctx: CanvasRenderingContext2D,
  it: ImageItem | VideoItem,
  src: CanvasImageSource | null,
  sw: number,
  sh: number,
  page: ComicPage,
) {
  ctx.save();
  clipForMedia(ctx, it, page);
  ctx.clip();
  ctx.globalAlpha = clamp(it.opacity ?? 1, 0, 1);
  if (src && sw && sh) {
    const zoom = it.zoom || 1;
    const base =
      it.fitMode === "fit" ? Math.min(it.w / sw, it.h / sh) : Math.max(it.w / sw, it.h / sh);
    const scale = base * zoom;
    const dw = sw * scale;
    const dh = sh * scale;
    const roomX = Math.max(0, (dw - it.w) / 2);
    const roomY = Math.max(0, (dh - it.h) / 2);
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    ctx.translate(cx, cy);
    ctx.rotate(((it.rot || 0) * Math.PI) / 180);
    ctx.scale(it.flipX ? -1 : 1, it.flipY ? -1 : 1);
    ctx.translate(-cx, -cy);
    ctx.drawImage(
      src,
      it.x + (it.w - dw) / 2 + it.cropX * roomX,
      it.y + (it.h - dh) / 2 + it.cropY * roomY,
      dw,
      dh,
    );
  } else {
    ctx.fillStyle = "#1b1f28";
    ctx.fillRect(it.x, it.y, it.w, it.h);
    ctx.fillStyle = "#9aa3b2";
    ctx.font = `600 ${Math.max(16, Math.min(28, it.w * 0.06))}px Vazirmatn, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(it.type === "video" ? "ویدئو" : "تصویر", it.x + it.w / 2, it.y + it.h / 2);
  }
  ctx.restore();
  if (it.stroke > 0) {
    clipForMedia(ctx, it, page);
    ctx.strokeStyle = it.strokeColor || "#16171A";
    ctx.lineWidth = it.stroke;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
}

function drawImage(ctx: CanvasRenderingContext2D, it: ImageItem, media: MediaBag, page: ComicPage) {
  const img = media.images[it.assetId];
  const sz = sourceSize(img);
  mediaFrame(ctx, it, img || null, sz.w, sz.h, page);
}

function drawVideo(ctx: CanvasRenderingContext2D, it: VideoItem, media: MediaBag, page: ComicPage) {
  const video = media.videos[it.assetId];
  const poster = it.posterAssetId ? media.images[it.posterAssetId] : null;
  if (video && video.readyState >= 2 && video.videoWidth) {
    mediaFrame(ctx, it, video, video.videoWidth, video.videoHeight, page);
    return;
  }
  if (poster) {
    const sz = sourceSize(poster);
    mediaFrame(ctx, it, poster, sz.w, sz.h, page);
    return;
  }
  mediaFrame(ctx, it, null, 0, 0, page);
  ctx.save();
  ctx.fillStyle = "rgba(8,10,14,0.45)";
  const r = Math.min(it.w, it.h) * 0.12;
  ctx.beginPath();
  ctx.arc(it.x + it.w / 2, it.y + it.h / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f4f6f8";
  ctx.beginPath();
  ctx.moveTo(it.x + it.w / 2 - r * 0.28, it.y + it.h / 2 - r * 0.4);
  ctx.lineTo(it.x + it.w / 2 + r * 0.48, it.y + it.h / 2);
  ctx.lineTo(it.x + it.w / 2 - r * 0.28, it.y + it.h / 2 + r * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawShape(ctx: CanvasRenderingContext2D, it: ShapeItem) {
  ctx.save();
  ctx.globalAlpha = clamp(it.opacity ?? 1, 0, 1);
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(((it.rot || 0) * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  if (it.kind === "circle")
    ctx.ellipse(cx, cy, Math.abs(it.w / 2), Math.abs(it.h / 2), 0, 0, Math.PI * 2);
  else if (it.kind === "line" || it.kind === "arrow") {
    ctx.moveTo(it.x, it.y);
    ctx.lineTo(it.x + it.w, it.y + it.h);
  } else if (it.kind === "round") roundRect(ctx, it.x, it.y, it.w, it.h, it.radius || 24);
  else ctx.rect(it.x, it.y, it.w, it.h);
  ctx.strokeStyle = it.strokeColor || "#16171A";
  ctx.lineWidth = it.stroke ?? 6;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  if (it.kind !== "line" && it.kind !== "arrow") {
    ctx.fillStyle = it.fill || "transparent";
    ctx.fill();
  }
  if ((it.stroke ?? 6) > 0) ctx.stroke();
  if (it.kind === "arrow") {
    const a = Math.atan2(it.h, it.w);
    const len = Math.max(18, (it.stroke ?? 6) * 4);
    ctx.beginPath();
    ctx.moveTo(it.x + it.w, it.y + it.h);
    ctx.lineTo(it.x + it.w - Math.cos(a - 0.55) * len, it.y + it.h - Math.sin(a - 0.55) * len);
    ctx.moveTo(it.x + it.w, it.y + it.h);
    ctx.lineTo(it.x + it.w - Math.cos(a + 0.55) * len, it.y + it.h - Math.sin(a + 0.55) * len);
    ctx.stroke();
  }
  ctx.restore();
}

function drawStroke(ctx: CanvasRenderingContext2D, it: DrawingItem) {
  const pts = it.points;
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = clamp(it.opacity ?? 1, 0, 1);
  ctx.strokeStyle = it.color || "#16171A";
  ctx.lineWidth = it.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.stroke();
  ctx.restore();
}

function bubblePath(ctx: CanvasRenderingContext2D, it: BubbleItem) {
  const { x, y, w, h } = it;
  ctx.beginPath();
  if (it.kind === "rect") roundRect(ctx, x, y, w, h, clamp(it.radius, 0, Math.min(w, h) / 2) || 14);
  else if (it.kind === "caption") ctx.rect(x, y, w, h);
  else if (it.kind === "shout") {
    const cx = x + w / 2;
    const cy = y + h / 2;
    for (let i = 0; i < 28; i++) {
      const a = (Math.PI * 2 * i) / 28 - Math.PI / 2;
      const rad = i % 2 ? 0.7 : 1;
      const px = cx + Math.cos(a) * (w / 2) * rad;
      const py = cy + Math.sin(a) * (h / 2) * rad;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
}

function drawBubble(
  ctx: CanvasRenderingContext2D,
  raw: BubbleItem,
  opts: {
    language?: string;
    translations?: Record<string, string>;
    sourceLanguage?: string;
    timeMs?: number;
  },
) {
  const it = raw;
  let text = textFor(it, opts);
  if (it.timing?.enabled && Number.isFinite(opts.timeMs)) {
    const start = it.timing.startMs;
    const end = Math.max(start + 1, it.timing.endMs);
    if (opts.timeMs! < start) return;
    if (opts.timeMs! < end) {
      const words = String(text || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const shown = Math.max(1, Math.ceil((words.length * (opts.timeMs! - start)) / (end - start)));
      text = words.slice(0, shown).join(" ");
    }
  }
  const pad = Math.min(it.w, it.h) * 0.16;
  if (it.kind === "none") {
    drawText(ctx, { ...it, text }, it.x + pad, it.y + pad, it.w - pad * 2, it.h - pad * 2);
    return;
  }
  ctx.save();
  ctx.globalAlpha = it.alpha ?? 1;
  ctx.fillStyle = it.fill || "#ffffff";
  ctx.strokeStyle = it.strokeColor || "#16171A";
  ctx.lineWidth = it.stroke ?? 5;
  if (it.kind === "whisper") ctx.setLineDash([10, 7]);
  if (it.kind !== "caption") {
    const tx = it.tx ?? it.x + it.w / 2;
    const ty = it.ty ?? it.y + it.h + it.tail;
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    if (it.kind === "think")
      (
        [
          [0.45, 15],
          [0.72, 10],
          [0.95, 6],
        ] as const
      ).forEach(([t, rr]) => {
        ctx.beginPath();
        ctx.ellipse(cx + (tx - cx) * t, cy + (ty - cy) * t, rr, rr, 0, 0, Math.PI * 2);
        ctx.fill();
        if ((it.stroke ?? 5) > 0) ctx.stroke();
      });
    else {
      const a = Math.atan2(ty - cy, tx - cx);
      const sp = 0.3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - sp) * (it.w / 2), cy + Math.sin(a - sp) * (it.h / 2));
      ctx.lineTo(tx, ty);
      ctx.lineTo(cx + Math.cos(a + sp) * (it.w / 2), cy + Math.sin(a + sp) * (it.h / 2));
      ctx.closePath();
      ctx.fill();
      if ((it.stroke ?? 5) > 0) ctx.stroke();
    }
  }
  bubblePath(ctx, it);
  ctx.fill();
  if ((it.stroke ?? 5) > 0) ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  drawText(ctx, { ...it, text }, it.x + pad, it.y + pad, it.w - pad * 2, it.h - pad * 2);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const out: string[] = [];
  String(text || "")
    .split("\n")
    .forEach((para) => {
      let line = "";
      para.split(" ").forEach((word) => {
        const t = line ? `${line} ${word}` : word;
        if (ctx.measureText(t).width > maxW && line) {
          out.push(line);
          line = word;
        } else line = t;
      });
      out.push(line);
    });
  return out;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  it: TextItem | BubbleItem,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const text = "text" in it ? it.text : "";
  if (!String(text).trim()) return;
  ctx.save();
  const alpha = clamp(it.opacity ?? 1, 0, 1);
  ctx.globalAlpha = alpha;
  ctx.direction = (it.direction || "rtl") as CanvasDirection;
  ctx.font = fontString(it);
  if (ctx.letterSpacing !== undefined) ctx.letterSpacing = `${it.track || 0}px`;
  ctx.textBaseline = "middle";
  const align = it.align || "center";
  ctx.textAlign = align === "center" ? "center" : align === "left" ? "left" : "right";
  const lines = wrap(ctx, text, w);
  const lh = (it.font || 28) * (it.lead || 1.5);
  let cy = y + h / 2 - (lines.length * lh) / 2 + lh / 2;
  const cx = align === "center" ? x + w / 2 : align === "left" ? x : x + w;
  if ("textBg" in it && it.textBg) {
    ctx.fillStyle = it.textBgColor || "#ffffff";
    ctx.globalAlpha = Math.min(1, alpha * 0.9);
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = alpha;
  }
  if (it.rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate((it.rot * Math.PI) / 180);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }
  if (it.shadow) {
    ctx.shadowColor = it.shadowColor || "#000";
    ctx.shadowBlur = it.shadowW ?? 4;
    ctx.shadowOffsetY = 2;
  }
  lines.forEach((line) => {
    if (it.outline) {
      ctx.strokeStyle = it.outlineColor || "#000";
      ctx.lineWidth = (it.outlineW ?? 2) * 2;
      ctx.lineJoin = "round";
      ctx.strokeText(line, cx, cy);
    }
    ctx.fillStyle = it.color || "#16171A";
    ctx.fillText(line, cx, cy);
    cy += lh;
  });
  ctx.restore();
}

function drawTextBox(
  ctx: CanvasRenderingContext2D,
  it: TextItem,
  opts: { language?: string; translations?: Record<string, string>; sourceLanguage?: string },
) {
  drawText(ctx, { ...it, text: textFor(it, opts) }, it.x, it.y, it.w, it.h);
}

/* Selection chrome, in the studio's own accent: a vermilion marquee with white
   grips. A soft dark shadow keeps the grips readable over pale artwork. */
const SEL_LINE = "#ef6446";
const SEL_GRIP = "#ffffff";

function drawHandles(ctx: CanvasRenderingContext2D, it: ComicItem, hs: number) {
  ctx.save();
  ctx.strokeStyle = SEL_LINE;
  ctx.lineWidth = Math.max(2, hs * 0.08);
  ctx.setLineDash([10, 6]);
  ctx.strokeRect(it.x, it.y, it.w, it.h);
  ctx.setLineDash([]);
  const dots = [
    [it.x, it.y],
    [it.x + it.w, it.y],
    [it.x, it.y + it.h],
    [it.x + it.w, it.y + it.h],
    [it.x + it.w / 2, it.y],
    [it.x + it.w / 2, it.y + it.h],
    [it.x, it.y + it.h / 2],
    [it.x + it.w, it.y + it.h / 2],
  ];
  const s = Math.max(18, hs * 0.5);
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = Math.max(3, s * 0.22);
  ctx.shadowOffsetY = 1;
  ctx.fillStyle = SEL_GRIP;
  ctx.strokeStyle = SEL_LINE;
  ctx.lineWidth = 2;
  dots.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.roundRect(x - s / 2, y - s / 2, s, s, 5);
    ctx.fill();
    ctx.stroke();
  });
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  // Bubble tail grip — filled, so it reads as "drag me" next to the square grips.
  if (it.type === "bubble" && it.kind !== "caption" && it.kind !== "none") {
    const tx = it.tx;
    const ty = it.ty;
    ctx.beginPath();
    ctx.arc(tx, ty, s * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = SEL_LINE;
    ctx.fill();
    ctx.strokeStyle = SEL_GRIP;
    ctx.stroke();
  }
  // Rotation stem above the item.
  if (it.type !== "panel") {
    const hx = it.x + it.w / 2;
    const hy = it.y - hs * 1.2;
    ctx.beginPath();
    ctx.moveTo(it.x + it.w / 2, it.y);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = SEL_LINE;
    ctx.lineWidth = Math.max(2, hs * 0.06);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = SEL_GRIP;
    ctx.fill();
    ctx.strokeStyle = SEL_LINE;
    ctx.stroke();
  }
  ctx.restore();
}

export function renderPageToCanvas(page: ComicPage, media: MediaBag, scale = 1) {
  const cv = document.createElement("canvas");
  cv.width = Math.round(page.w * scale);
  cv.height = Math.round(page.h * scale);
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  ctx.scale(scale, scale);
  drawPage(ctx, page, media, { handles: false });
  return cv;
}
