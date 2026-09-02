import type { ComicItem, ComicPage, ComicProject, PanelItem } from "./types.ts";

export type ReaderZone = "prev" | "next" | "hud";

export interface Beat {
  id: string;
  itemIds: string[];
  bounds: { x: number; y: number; w: number; h: number };
}

export interface CameraRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function readerZone(x: number, width: number, mobile: boolean): ReaderZone {
  if (!width) return "hud";
  if (mobile) {
    const third = width * 0.33;
    if (x < third) return "prev";
    if (x > width - third) return "next";
    return "hud";
  }
  return "prev";
}

export function nextPageIndex(index: number, total: number): { index: number; ended: boolean } {
  if (total <= 0) return { index: 0, ended: false };
  if (index + 1 >= total) return { index, ended: true };
  return { index: index + 1, ended: false };
}

export function prevPageIndex(index: number): number {
  return Math.max(0, index - 1);
}

export function swipeDirection(dx: number, dy: number, threshold = 56): "next" | "prev" | null {
  if (Math.abs(dx) < threshold) return null;
  if (Math.abs(dx) < Math.abs(dy) * 1.25) return null;
  return dx < 0 ? "next" : "prev";
}

function itemBounds(it: ComicItem) {
  if (it.type === "bubble") {
    const tx = it.tx ?? it.x + it.w / 2;
    const ty = it.ty ?? it.y + it.h + (it.tail || 0);
    const x1 = Math.min(it.x, tx - 8);
    const y1 = Math.min(it.y, ty - 8);
    const x2 = Math.max(it.x + it.w, tx + 8);
    const y2 = Math.max(it.y + it.h, ty + 8);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  }
  return { x: it.x, y: it.y, w: it.w, h: it.h };
}

function unionBounds(rects: { x: number; y: number; w: number; h: number }[]) {
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;
  for (const r of rects) {
    x1 = Math.min(x1, r.x);
    y1 = Math.min(y1, r.y);
    x2 = Math.max(x2, r.x + r.w);
    y2 = Math.max(y2, r.y + r.h);
  }
  if (!Number.isFinite(x1)) return { x: 0, y: 0, w: 1, h: 1 };
  return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
}

export function pageBeats(page: ComicPage): Beat[] {
  const panels = page.items.filter((i): i is PanelItem => i.type === "panel" && !i.hidden);
  panels.sort((a, b) => {
    const oa = a.story?.order ?? 99;
    const ob = b.story?.order ?? 99;
    if (oa !== ob) return oa - ob;
    if (Math.abs(a.y - b.y) > 28) return a.y - b.y;
    return b.x - a.x;
  });

  const assigned = new Set<string>();
  const beats: Beat[] = [];

  for (const panel of panels) {
    const ids = [panel.id];
    assigned.add(panel.id);
    const rects = [itemBounds(panel)];
    for (const it of page.items) {
      if (it.hidden || it.id === panel.id) continue;
      if (it.panelId === panel.id) {
        ids.push(it.id);
        assigned.add(it.id);
        rects.push(itemBounds(it));
      }
    }
    beats.push({ id: panel.id, itemIds: ids, bounds: unionBounds(rects) });
  }

  const rest = page.items.filter((i) => !i.hidden && !assigned.has(i.id));
  rest.sort((a, b) => (Math.abs(a.y - b.y) > 28 ? a.y - b.y : b.x - a.x));
  for (const it of rest) {
    const cx = it.x + it.w / 2;
    const cy = it.y + it.h / 2;
    const owner = panels.find((p) => cx >= p.x && cx <= p.x + p.w && cy >= p.y && cy <= p.y + p.h);
    if (owner) {
      const beat = beats.find((b) => b.id === owner.id);
      if (beat) {
        beat.itemIds.push(it.id);
        beat.bounds = unionBounds([beat.bounds, itemBounds(it)]);
        assigned.add(it.id);
        continue;
      }
    }
    beats.push({ id: it.id, itemIds: [it.id], bounds: itemBounds(it) });
  }

  if (!beats.length) {
    beats.push({ id: page.id, itemIds: [], bounds: { x: 0, y: 0, w: page.w, h: page.h } });
  }
  return beats;
}

export function revealedItemIds(beats: Beat[], count: number): Set<string> {
  const ids = new Set<string>();
  const n = Math.max(0, Math.min(count, beats.length));
  for (let i = 0; i < n; i++) beats[i].itemIds.forEach((id) => ids.add(id));
  return ids;
}

export function cameraFor(beats: Beat[], count: number, page: ComicPage, pad = 0.07): CameraRect {
  const n = Math.max(1, Math.min(count, beats.length));
  const box = unionBounds(beats.slice(0, n).map((b) => b.bounds));
  const px = page.w * pad;
  const py = page.h * pad;
  const x = Math.max(0, box.x - px);
  const y = Math.max(0, box.y - py);
  const x2 = Math.min(page.w, box.x + box.w + px);
  const y2 = Math.min(page.h, box.y + box.h + py);
  return { x, y, w: Math.max(8, x2 - x), h: Math.max(8, y2 - y) };
}

/** First beat is the whole panel (small pad). Later beats pull back with a tight pad. */
/**
 * Where the reader looks.
 *
 * The first panel fills the view. The second joins it — two panels, both big.
 * From the third on, the newest pair keeps the stage and everything read so far
 * is pulled in around it, so the older panels shrink back rather than vanish.
 * That is the "two big, the ones behind them small" rhythm of a comic page.
 */
export function revealCamera(beats: Beat[], count: number, page: ComicPage): CameraRect {
  const n = Math.max(1, Math.min(count, beats.length));
  if (n <= 2) return cameraFor(beats, n, page, n === 1 ? 0.02 : 0.03);

  const focus = unionBounds(beats.slice(n - 2, n).map((b) => b.bounds));
  const read = unionBounds(beats.slice(0, n).map((b) => b.bounds));
  // Blend: mostly the newest pair, opened toward what has been read already.
  const t = 0.34;
  const box = {
    x: focus.x + (read.x - focus.x) * t,
    y: focus.y + (read.y - focus.y) * t,
    w: 0,
    h: 0,
  };
  const right = focus.x + focus.w + (read.x + read.w - (focus.x + focus.w)) * t;
  const bottom = focus.y + focus.h + (read.y + read.h - (focus.y + focus.h)) * t;
  box.w = Math.max(8, right - box.x);
  box.h = Math.max(8, bottom - box.y);

  const pad = 0.03;
  const px = page.w * pad;
  const py = page.h * pad;
  const x = Math.max(0, box.x - px);
  const y = Math.max(0, box.y - py);
  const x2 = Math.min(page.w, box.x + box.w + px);
  const y2 = Math.min(page.h, box.y + box.h + py);
  return { x, y, w: Math.max(8, x2 - x), h: Math.max(8, y2 - y) };
}

export function coverFit(cam: CameraRect, viewW: number, viewH: number) {
  const scale = Math.max(viewW / Math.max(1, cam.w), viewH / Math.max(1, cam.h));
  return {
    scale,
    ox: (viewW - cam.w * scale) / 2,
    oy: (viewH - cam.h * scale) / 2,
  };
}

/** Show the whole revealed union; cinema bars if needed. First panel is a complete photo. */
export function containFit(cam: CameraRect, viewW: number, viewH: number) {
  const scale = Math.min(viewW / Math.max(1, cam.w), viewH / Math.max(1, cam.h));
  return {
    scale,
    ox: (viewW - cam.w * scale) / 2,
    oy: (viewH - cam.h * scale) / 2,
  };
}

export function easeOutCubic(t: number) {
  const x = Math.max(0, Math.min(1, t));
  return 1 - (1 - x) ** 3;
}

export function advanceReveal(
  revealed: number,
  beats: number,
  pageIndex: number,
  pages: number,
): { revealed: number; pageIndex: number; ended: boolean } {
  if (revealed < beats) return { revealed: revealed + 1, pageIndex, ended: false };
  if (pageIndex + 1 < pages) return { revealed: 1, pageIndex: pageIndex + 1, ended: false };
  return { revealed, pageIndex, ended: true };
}

export function retreatReveal(
  revealed: number,
  pageIndex: number,
  prevPageBeats: number,
): { revealed: number; pageIndex: number } {
  if (revealed > 1) return { revealed: revealed - 1, pageIndex };
  if (pageIndex > 0) return { revealed: Math.max(1, prevPageBeats), pageIndex: pageIndex - 1 };
  return { revealed: 1, pageIndex: 0 };
}

export function lerpCamera(from: CameraRect, to: CameraRect, t: number): CameraRect {
  const k = Math.max(0, Math.min(1, t));
  return {
    x: from.x + (to.x - from.x) * k,
    y: from.y + (to.y - from.y) * k,
    w: from.w + (to.w - from.w) * k,
    h: from.h + (to.h - from.h) * k,
  };
}

export function ambientForPage(project: ComicProject, pageIndex: number) {
  const here = project.pages[pageIndex]?.playback.ambientAudio;
  if (here) return here;
  for (let i = pageIndex - 1; i >= 0; i--) {
    const clip = project.pages[i]?.playback.ambientAudio;
    if (!clip) continue;
    if (clip.throughPage === -1 || clip.continuePages) return clip;
    if (clip.throughPage && clip.throughPage >= pageIndex + 1) return clip;
    return null;
  }
  return null;
}

/** First background-music clip and the inclusive page range it covers. */
export function musicSpan(
  project: ComicProject,
): {
  start: number;
  end: number;
  clip: NonNullable<ComicProject["pages"][0]["playback"]["ambientAudio"]>;
} | null {
  for (let i = 0; i < project.pages.length; i++) {
    const clip = project.pages[i]?.playback.ambientAudio;
    if (!clip) continue;
    let end = i;
    if (clip.throughPage === -1 || clip.continuePages) end = project.pages.length - 1;
    else if (clip.throughPage && clip.throughPage > 0)
      end = Math.min(project.pages.length - 1, clip.throughPage - 1);
    return { start: i, end, clip };
  }
  return null;
}

export function throughPageValue(start: number, end: number, pageCount: number): number {
  if (end >= pageCount - 1) return -1;
  if (end <= start) return 0;
  return end + 1;
}
