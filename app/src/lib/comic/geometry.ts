import { clamp } from "@/lib/utils";
import { pointInPanel } from "./panel-shape";
import type { ComicItem, ComicPage, PanelItem } from "./types";

export function itemCenter(it: ComicItem) {
  return { x: it.x + it.w / 2, y: it.y + it.h / 2 };
}

export function contains(it: ComicItem, x: number, y: number) {
  if (it.type === "panel") return pointInPanel(it, x, y);
  if (it.type === "shape" && (it.kind === "line" || it.kind === "arrow")) {
    return pointSegDist(x, y, it.x, it.y, it.x + it.w, it.y + it.h) < Math.max(14, (it.stroke ?? 6) + 10);
  }
  if (it.type === "drawing") {
    const pts = it.points;
    for (let i = 1; i < pts.length; i++) {
      if (pointSegDist(x, y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) < it.width + 10) return true;
    }
    return false;
  }
  return x >= it.x && x <= it.x + it.w && y >= it.y && y <= it.y + it.h;
}

export function pointSegDist(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function clampItem(it: ComicItem, page: ComicPage) {
  if (it.type === "drawing") {
    it.points = it.points.map((p) => ({
      x: clamp(p.x, 0, page.w),
      y: clamp(p.y, 0, page.h),
    }));
    refreshDrawingBounds(it);
    return;
  }
  it.w = clamp(it.w, 24, page.w);
  it.h = clamp(it.h, 24, page.h);
  it.x = clamp(it.x, -it.w * 0.4, page.w - it.w * 0.6);
  it.y = clamp(it.y, -it.h * 0.4, page.h - it.h * 0.6);
}

export function refreshDrawingBounds(it: ComicItem) {
  if (it.type !== "drawing" || !it.points.length) return;
  const xs = it.points.map((p) => p.x);
  const ys = it.points.map((p) => p.y);
  it.x = Math.min(...xs);
  it.y = Math.min(...ys);
  it.w = Math.max(8, Math.max(...xs) - it.x);
  it.h = Math.max(8, Math.max(...ys) - it.y);
}

export function panelAt(page: ComicPage, x: number, y: number): PanelItem | null {
  const panels = page.items.filter((i): i is PanelItem => i.type === "panel");
  for (let i = panels.length - 1; i >= 0; i--) {
    if (pointInPanel(panels[i], x, y)) return panels[i];
  }
  let best: PanelItem | null = null;
  let dist = Infinity;
  for (const p of panels) {
    const d = Math.hypot(x - (p.x + p.w / 2), y - (p.y + p.h / 2));
    if (d < dist) {
      best = p;
      dist = d;
    }
  }
  return best;
}

export function hitTest(page: ComicPage, x: number, y: number): ComicItem | null {
  for (let i = page.items.length - 1; i >= 0; i--) {
    const it = page.items[i];
    if (it.hidden) continue;
    if (it.type === "bubble") {
      const tx = it.tx ?? it.x + it.w / 2;
      const ty = it.ty ?? it.y + it.h + it.tail;
      if (Math.hypot(x - tx, y - ty) < 28) return it;
    }
    if (contains(it, x, y)) return it;
  }
  return null;
}

export type HandleCorner = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w" | "tail" | "rot";

export function handleSize(pageW: number, displayW: number) {
  return Math.max(40, 56 * (pageW / Math.max(1, displayW)));
}

export function rotateHandlePoint(it: ComicItem, hs: number) {
  return { x: it.x + it.w / 2, y: it.y - hs * 1.2 };
}

export function applyRotate(it: ComicItem, pt: { x: number; y: number }, snap15: boolean) {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  let deg = (Math.atan2(pt.y - cy, pt.x - cx) * 180) / Math.PI + 90;
  if (snap15) deg = Math.round(deg / 15) * 15;
  deg = ((deg % 360) + 360) % 360;
  if (deg > 180) deg -= 360;
  it.rot = Math.round(deg);
}

export function resizeCorner(pt: { x: number; y: number }, it: ComicItem, hs: number): HandleCorner | null {
  if (it.type !== "panel") {
    const rh = rotateHandlePoint(it, hs);
    if (Math.hypot(pt.x - rh.x, pt.y - rh.y) < hs * 0.7) return "rot";
  }
  if (it.type === "bubble") {
    const tx = it.tx ?? it.x + it.w / 2;
    const ty = it.ty ?? it.y + it.h + it.tail;
    if (Math.hypot(pt.x - tx, pt.y - ty) < hs * 0.7) return "tail";
  }
  const corners: [HandleCorner, number, number][] = [
    ["nw", it.x, it.y],
    ["ne", it.x + it.w, it.y],
    ["sw", it.x, it.y + it.h],
    ["se", it.x + it.w, it.y + it.h],
    ["n", it.x + it.w / 2, it.y],
    ["s", it.x + it.w / 2, it.y + it.h],
    ["w", it.x, it.y + it.h / 2],
    ["e", it.x + it.w, it.y + it.h / 2],
  ];
  for (const [k, cx, cy] of corners) {
    if (Math.abs(pt.x - cx) <= hs * 0.7 && Math.abs(pt.y - cy) <= hs * 0.7) return k;
  }
  return null;
}

export function applyResize(
  it: ComicItem,
  corner: HandleCorner,
  dx: number,
  dy: number,
  aspect: number | null,
) {
  let { x, y, w, h } = it;
  if (corner === "e" || corner === "ne" || corner === "se") w += dx;
  if (corner === "w" || corner === "nw" || corner === "sw") {
    x += dx;
    w -= dx;
  }
  if (corner === "s" || corner === "se" || corner === "sw") h += dy;
  if (corner === "n" || corner === "ne" || corner === "nw") {
    y += dy;
    h -= dy;
  }
  if (w < 32) {
    if (corner.includes("w")) x -= 32 - w;
    w = 32;
  }
  if (h < 32) {
    if (corner.includes("n")) y -= 32 - h;
    h = 32;
  }
  if (aspect && (corner === "nw" || corner === "ne" || corner === "sw" || corner === "se")) {
    if (Math.abs(dx) > Math.abs(dy)) h = w / aspect;
    else w = h * aspect;
  }
  it.x = x;
  it.y = y;
  it.w = w;
  it.h = h;
}

export function snapItem(it: ComicItem, page: ComicPage, enabled: boolean) {
  if (!enabled || it.locked) return { x: null as number | null, y: null as number | null };
  const threshold = Math.max(10, Math.min(26, page.w * 0.018));
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  let gx: number | null = null;
  let gy: number | null = null;
  const beforeX = it.x;
  const beforeY = it.y;
  if (Math.abs(cx - page.w / 2) <= threshold) {
    it.x = page.w / 2 - it.w / 2;
    gx = page.w / 2;
  } else if (Math.abs(it.x) <= threshold) {
    it.x = 0;
    gx = 0;
  } else if (Math.abs(it.x + it.w - page.w) <= threshold) {
    it.x = page.w - it.w;
    gx = page.w;
  }
  if (Math.abs(cy - page.h / 2) <= threshold) {
    it.y = page.h / 2 - it.h / 2;
    gy = page.h / 2;
  } else if (Math.abs(it.y) <= threshold) {
    it.y = 0;
    gy = 0;
  } else if (Math.abs(it.y + it.h - page.h) <= threshold) {
    it.y = page.h - it.h;
    gy = page.h;
  }
  const sdx = it.x - beforeX;
  const sdy = it.y - beforeY;
  if (it.type === "panel" && (sdx || sdy)) {
    page.items
      .filter((c) => c.panelId === it.id)
      .forEach((c) => {
        c.x += sdx;
        c.y += sdy;
        if (c.type === "bubble") {
          c.tx += sdx;
          c.ty += sdy;
        }
      });
  }
  return { x: gx, y: gy };
}

export function isFramedMedia(it: ComicItem | null | undefined): it is Extract<ComicItem, { type: "image" | "video" }> {
  return !!it && (it.type === "image" || it.type === "video") && !!it.panelId && !it.free;
}

export function panCrop(it: Extract<ComicItem, { type: "image" | "video" }>, dx: number, dy: number) {
  if ((it.zoom || 1) < 1.2 && (dx || dy)) it.zoom = Math.max(it.zoom || 1, 1.2);
  const spanX = Math.max(64, it.w * 0.55);
  const spanY = Math.max(64, it.h * 0.55);
  it.cropX = clamp(it.cropX + dx / spanX, -1, 1);
  it.cropY = clamp(it.cropY + dy / spanY, -1, 1);
}

export function moveItem(it: ComicItem, dx: number, dy: number, page: ComicPage) {
  if (it.locked) return;
  it.x += dx;
  it.y += dy;
  if (it.type === "bubble") {
    it.tx += dx;
    it.ty += dy;
  }
  if (it.type === "drawing") {
    it.points = it.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
  if (it.type === "panel") {
    page.items
      .filter((c) => c.panelId === it.id)
      .forEach((c) => {
        c.x += dx;
        c.y += dy;
        if (c.type === "bubble") {
          c.tx += dx;
          c.ty += dy;
        }
        if (c.type === "drawing") {
          c.points = c.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
      });
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  if (!r) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function scaleFromCenter(it: ComicItem, factor: number, page: ComicPage) {
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  const k = Number.isFinite(factor) && factor > 0 ? factor : 1;
  it.w = clamp(it.w * k, 48, page.w);
  it.h = clamp(it.h * k, 48, page.h);
  it.x = cx - it.w / 2;
  it.y = cy - it.h / 2;
  clampItem(it, page);
}

export function bumpMediaZoom(it: Extract<ComicItem, { type: "image" | "video" }>, factor: number) {
  const k = Number.isFinite(factor) && factor > 0 ? factor : 1;
  it.zoom = clamp((it.zoom || 1) * k, 0.5, 4);
}
