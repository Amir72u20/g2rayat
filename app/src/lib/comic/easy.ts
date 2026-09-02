import { uid } from "@/lib/utils";
import {
  applyLayout,
  defaultStory,
  insertItem,
  newBubble,
  newImage,
  newPage,
  newPanel,
  newVideo,
} from "./factory";
import { layoutCellCount } from "./layouts";
import { DOCUMENT_VERSION, NEUTRAL_ADJUST } from "./types";
import type {
  AudioClip,
  BubbleItem,
  BubbleKind,
  ComicItem,
  ComicPage,
  ComicProject,
  ImageItem,
  PanelItem,
  VideoItem,
  PanelKind,
  ReadingDirection,
} from "./types";

/**
 * The easy builder edits every picture on its own, outside any panel — the one
 * thing that is genuinely hard on a phone once an image is clipped by a frame.
 *
 * Each shot is a real `ComicPage` of its own (a "frame"): one full-bleed image
 * plus whatever bubbles you put on it. That means the shot editor can reuse the
 * studio's renderer and geometry as-is, so what you arrange here is pixel-for-
 * pixel what lands in the comic. Building the comic maps each frame onto a
 * panel; nothing is flattened, so every piece stays editable afterwards.
 */

export const SHOT_W = 1000;

export const FRAME_RATIOS: { id: string; label: string; r: number }[] = [
  { id: "4:5", label: "۴:۵", r: 4 / 5 },
  { id: "1:1", label: "۱:۱", r: 1 },
  { id: "3:4", label: "۳:۴", r: 3 / 4 },
  { id: "3:2", label: "۳:۲", r: 3 / 2 },
  { id: "16:9", label: "۱۶:۹", r: 16 / 9 },
  { id: "9:16", label: "۹:۱۶", r: 9 / 16 },
];

export type ShotKind = "image" | "video";

export interface EasyShot {
  id: string;
  assetId: string;
  name: string;
  /** A picture or a clip — both are edited the same way, on their own frame. */
  kind: ShotKind;
  /** Aspect of the source file, used to offer a sensible starting frame. */
  sourceRatio: number;
  /** Frame ratio id from FRAME_RATIOS. */
  ratioId: string;
  /** The editable frame: media + bubbles, in its own coordinate space. */
  frame: ComicPage;
}

export const AUTO_LAYOUT = "auto";

export type GutterSize = "thin" | "normal" | "wide";

/** Gutter as a share of page width. A comic gutter is a line, not a margin —
 *  on an 800pt page these are roughly 6, 11 and 20 points. */
export const GUTTERS: Record<GutterSize, number> = {
  thin: 0.008,
  normal: 0.014,
  wide: 0.026,
};

export interface EasyPagePlan {
  /** A PANEL_LAYOUTS key, or AUTO_LAYOUT for the mosaic that fills the page. */
  layoutKey: string;
  panelKind: PanelKind;
  /** Pictures per page in auto mode (1–8). */
  autoCount?: number;
  gutter?: GutterSize;
}

export interface EasyMusic {
  assetId: string;
  name: string;
  volume: number;
  speed: number;
  bass: number;
  treble: number;
  fadeInMs: number;
  fadeOutMs: number;
  /** 1-based page to play through; -1 = whole comic. */
  throughPage: number;
}

export function ratioOf(id: string) {
  return FRAME_RATIOS.find((f) => f.id === id)?.r ?? 4 / 5;
}

/** The listed ratio closest to the source image, so the first crop loses least. */
export function closestRatioId(sourceRatio: number) {
  let best = FRAME_RATIOS[0];
  let dist = Infinity;
  for (const f of FRAME_RATIOS) {
    const d = Math.abs(Math.log(f.r / sourceRatio));
    if (d < dist) {
      dist = d;
      best = f;
    }
  }
  return best.id;
}

function frameSize(ratioId: string) {
  const r = ratioOf(ratioId);
  return { w: SHOT_W, h: Math.round(SHOT_W / r) };
}

export function newShot(
  assetId: string,
  name: string,
  sourceRatio: number,
  kind: ShotKind = "image",
  duration = 0,
): EasyShot {
  const ratioId = closestRatioId(sourceRatio || 1);
  const { w, h } = frameSize(ratioId);
  const frame = newPage("", w, h);
  frame.background.color = "#ffffff";
  const common = {
    x: 0,
    y: 0,
    w,
    h,
    fitMode: "fill" as const,
    sourceRatio: sourceRatio || 1,
    adjust: { ...NEUTRAL_ADJUST },
  };
  const media =
    kind === "video"
      ? newVideo(frame, assetId, {
          ...common,
          name,
          duration,
          trimStart: 0,
          trimEnd: duration,
          volume: 1,
          muted: false,
          speed: 1,
        })
      : newImage(frame, assetId, common);
  insertItem(frame, media);
  return { id: uid("shot"), assetId, name, kind, sourceRatio: sourceRatio || 1, ratioId, frame };
}

/** The one picture or clip on a frame. */
export function shotMedia(shot: EasyShot): ImageItem | VideoItem | null {
  return (
    (shot.frame.items.find((i) => i.type === "image" || i.type === "video") as
      ImageItem | VideoItem | undefined) ?? null
  );
}

export function shotImage(shot: EasyShot): ImageItem | VideoItem | null {
  return shotMedia(shot);
}

export function shotVideo(shot: EasyShot): VideoItem | null {
  const media = shotMedia(shot);
  return media && media.type === "video" ? media : null;
}

export function shotBubbles(shot: EasyShot): BubbleItem[] {
  return shot.frame.items.filter((i): i is BubbleItem => i.type === "bubble");
}

/** Re-frame a shot, keeping the image full-bleed and bubbles where they sit. */
export function setShotRatio(shot: EasyShot, ratioId: string) {
  const { w, h } = frameSize(ratioId);
  const sx = w / shot.frame.w;
  const sy = h / shot.frame.h;
  shot.ratioId = ratioId;
  shot.frame.items.forEach((it) => {
    if (it.type === "image" || it.type === "video") {
      it.x = 0;
      it.y = 0;
      it.w = w;
      it.h = h;
      return;
    }
    it.x *= sx;
    it.y *= sy;
    it.w *= sx;
    it.h *= sy;
    if (it.type === "bubble") {
      it.tx *= sx;
      it.ty *= sy;
      it.font = Math.max(10, it.font * sx);
    }
  });
  shot.frame.w = w;
  shot.frame.h = h;
}

/** A bubble that lands in view, sized for the frame rather than for a page. */
export function addShotBubble(shot: EasyShot, kind: BubbleKind): BubbleItem {
  const f = shot.frame;
  const w = f.w * 0.5;
  const h = f.h * (kind === "caption" ? 0.14 : 0.2);
  const count = shotBubbles(shot).length;
  const x = f.w * 0.25 + ((count * f.w) % (f.w * 0.2)) * 0.1;
  const y = kind === "caption" ? f.h * 0.78 : f.h * 0.07 + count * f.h * 0.04;
  const bubble = newBubble(f, kind, {
    x,
    y,
    w,
    h,
    tx: x + w / 2,
    ty: Math.min(f.h * 0.94, y + h + f.h * 0.12),
    font: Math.round(f.w * 0.045),
    tail: f.h * 0.12,
    text: "",
  });
  insertItem(f, bubble);
  return bubble;
}

export function cellsPerPage(plan: EasyPagePlan) {
  if (plan.layoutKey === AUTO_LAYOUT) return Math.min(8, Math.max(1, plan.autoCount ?? 4));
  return Math.max(1, layoutCellCount(plan.layoutKey));
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Automatic panels: a justified mosaic built from the pictures themselves.
 *
 * Pictures are kept in order and split into rows; every row fills the page
 * width exactly, and the rows are scaled together to fill the height, so the
 * page has no dead space — only the gutter between frames. The split is chosen
 * by trying every way to cut the sequence into consecutive rows (at most eight
 * pictures, so at most 128 options) and keeping the one whose natural height is
 * closest to the page, which is also the one that needs the least crop.
 */
export function mosaicRects(
  ratios: number[],
  pageW: number,
  pageH: number,
  gutter = GUTTERS.normal,
): Rect[] {
  const n = ratios.length;
  if (!n) return [];
  const gap = pageW * gutter;
  // Full bleed: the mosaic runs to the paper's edge, so the only white the
  // reader sees is the gutter between frames.
  const margin = 0;
  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2;

  const rowsHeight = (groups: number[][]) => {
    let total = 0;
    for (const g of groups) {
      const sum = g.reduce((acc, i) => acc + Math.max(0.2, ratios[i]), 0);
      total += (availW - gap * (g.length - 1)) / sum;
    }
    return total + gap * (groups.length - 1);
  };

  // Every composition of n into consecutive runs.
  let best: number[][] | null = null;
  let bestCost = Infinity;
  for (let mask = 0; mask < 1 << Math.max(0, n - 1); mask++) {
    const groups: number[][] = [];
    let current: number[] = [0];
    for (let i = 1; i < n; i++) {
      if (mask & (1 << (i - 1))) {
        groups.push(current);
        current = [i];
      } else current.push(i);
    }
    groups.push(current);
    if (groups.some((g) => g.length > 4)) continue;
    const height = rowsHeight(groups);
    // Distance from a full page, plus a nudge away from very lopsided rows.
    const spread =
      Math.max(...groups.map((g) => g.length)) - Math.min(...groups.map((g) => g.length));
    const cost = Math.abs(height - availH) / availH + spread * 0.04;
    if (cost < bestCost) {
      bestCost = cost;
      best = groups;
    }
  }
  const groups = best ?? [ratios.map((_, i) => i)];

  // Scale only the picture heights: the gutters between rows are fixed, so they
  // must come out of the height budget before the rows are stretched to fill it.
  const gapsY = gap * (groups.length - 1);
  const naturalRows = rowsHeight(groups) - gapsY;
  const scale = naturalRows > 0 ? (availH - gapsY) / naturalRows : 1;
  const rects: Rect[] = new Array(n);
  let y = margin;
  groups.forEach((g, gi) => {
    const sum = g.reduce((acc, i) => acc + Math.max(0.2, ratios[i]), 0);
    // The last row takes whatever pixels rounding left, so the page ends flush.
    const rowH =
      gi === groups.length - 1
        ? margin + availH - y
        : ((availW - gap * (g.length - 1)) / sum) * scale;
    let x = margin;
    g.forEach((i, k) => {
      const w =
        k === g.length - 1
          ? margin + availW - x
          : (availW - gap * (g.length - 1)) * (Math.max(0.2, ratios[i]) / sum);
      rects[i] = { x, y, w, h: rowH };
      x += w + gap;
    });
    y += rowH + gap;
  });
  return rects;
}

/** Layouts that hold exactly N pictures, for a last page that is under-filled. */
const COUNT_LAYOUTS: Record<number, string> = {
  1: "1",
  2: "2v",
  3: "3v",
  4: "4",
  5: "manga",
  6: "6",
};

/** Keep the chosen layout when it fits; otherwise take one sized to what's left,
 *  so the last page never ends on an empty frame. */
export function layoutForCount(preferred: string, count: number) {
  if (layoutCellCount(preferred) === count) return preferred;
  return COUNT_LAYOUTS[count] ?? preferred;
}

/** How many pages a set of shots needs under the given plans. */
export function planPages(shotCount: number, plans: EasyPagePlan[], fallback: EasyPagePlan) {
  const pages: EasyPagePlan[] = [];
  let left = Math.max(1, shotCount);
  let i = 0;
  while (left > 0 && pages.length < 60) {
    const plan = plans[i] ?? plans[plans.length - 1] ?? fallback;
    pages.push(plan);
    left -= cellsPerPage(plan);
    i++;
  }
  return pages;
}

/**
 * Shrink a panel inside its own cell until it matches the picture's frame, so
 * the whole picture is visible instead of being cropped to the grid.
 */
export function fitPanelToRatio(panel: PanelItem, ratio: number) {
  const cx = panel.x + panel.w / 2;
  const cy = panel.y + panel.h / 2;
  const cellRatio = panel.w / panel.h;
  let w = panel.w;
  let h = panel.h;
  if (cellRatio > ratio) w = panel.h * ratio;
  else h = panel.w / ratio;
  panel.x = cx - w / 2;
  panel.y = cy - h / 2;
  panel.w = w;
  panel.h = h;
}

/**
 * Grow the page's panels together until they fill the paper.
 *
 * Fitting each panel to its picture leaves slack; scaling the whole arrangement
 * about its centre closes that gap without changing the composition or letting
 * panels collide.
 */
export function growPanelsToPage(page: ComicPage, panels: PanelItem[], maxScale = 1.4) {
  if (!panels.length) return 1;
  const margin = page.w * 0.05;
  const left = Math.min(...panels.map((p) => p.x));
  const right = Math.max(...panels.map((p) => p.x + p.w));
  const top = Math.min(...panels.map((p) => p.y));
  const bottom = Math.max(...panels.map((p) => p.y + p.h));
  const bw = right - left;
  const bh = bottom - top;
  if (bw <= 0 || bh <= 0) return 1;
  const scale = Math.min(maxScale, (page.w - margin * 2) / bw, (page.h - margin * 2) / bh);
  if (scale <= 1.001) return 1;
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  panels.forEach((p) => {
    p.x = cx + (p.x - cx) * scale;
    p.y = cy + (p.y - cy) * scale;
    p.w *= scale;
    p.h *= scale;
  });
  // Re-centre on the paper after growing.
  const nl = Math.min(...panels.map((p) => p.x));
  const nr = Math.max(...panels.map((p) => p.x + p.w));
  const nt = Math.min(...panels.map((p) => p.y));
  const nb = Math.max(...panels.map((p) => p.y + p.h));
  const dx = (page.w - (nr - nl)) / 2 - nl;
  const dy = (page.h - (nb - nt)) / 2 - nt;
  panels.forEach((p) => {
    p.x += dx;
    p.y += dy;
  });
  return scale;
}

/** Panels in reading order: rows top to bottom, then along the reading axis. */
export function readingOrder(panels: PanelItem[], direction: ReadingDirection) {
  const rowGap = 24;
  return [...panels].sort((a, b) => {
    const sameRow = Math.abs(a.y - b.y) < Math.max(rowGap, Math.min(a.h, b.h) * 0.4);
    if (!sameRow) return a.y - b.y;
    return direction === "rtl" ? b.x - a.x : a.x - b.x;
  });
}

export function musicToClip(music: EasyMusic): AudioClip {
  return {
    assetId: music.assetId,
    start: 0,
    end: 0,
    volume: music.volume,
    fadeInMs: music.fadeInMs,
    fadeOutMs: music.fadeOutMs,
    speed: music.speed,
    bass: music.bass,
    treble: music.treble,
    throughPage: music.throughPage,
    continuePages: music.throughPage === -1,
  };
}

export interface BuildOptions {
  title: string;
  description?: string;
  direction: ReadingDirection;
  pageW: number;
  pageH: number;
  shots: EasyShot[];
  plans: EasyPagePlan[];
  fallbackPlan: EasyPagePlan;
  music?: EasyMusic | null;
  /** Reuse an id so rebuilding after a step-back replaces the same project. */
  projectId?: string;
  createdAt?: number;
}

/** Turn the wizard's state into a full, still-editable comic document. */
export function buildEasyProject(opts: BuildOptions): ComicProject {
  const now = Date.now();
  const pagePlans = planPages(opts.shots.length, opts.plans, opts.fallbackPlan);
  const pages: ComicPage[] = [];
  let cursor = 0;

  pagePlans.forEach((plan, pageIndex) => {
    const page = newPage(`صفحه ${pageIndex + 1}`, opts.pageW, opts.pageH);
    const left = opts.shots.length - cursor;

    if (plan.layoutKey === AUTO_LAYOUT) {
      const take = Math.max(0, Math.min(cellsPerPage(plan), left));
      const mine = opts.shots.slice(cursor, cursor + take);
      cursor += take;
      buildAutoPage(page, mine, plan, opts.direction);
      if (opts.music && pageIndex === 0) page.playback.ambientAudio = musicToClip(opts.music);
      pages.push(page);
      return;
    }

    const key =
      left > 0 && left < cellsPerPage(plan) ? layoutForCount(plan.layoutKey, left) : plan.layoutKey;
    applyLayout(page, key);
    const panels = readingOrder(
      page.items.filter((i): i is PanelItem => i.type === "panel"),
      opts.direction,
    );
    const filled: { panel: PanelItem; shot: EasyShot }[] = [];
    panels.forEach((panel, order) => {
      panel.kind = plan.panelKind;
      panel.radius = plan.panelKind === "round" || plan.panelKind === "circle" ? 28 : 4;
      panel.story = defaultStory(order + 1);
      const shot = opts.shots[cursor];
      if (!shot) return;
      cursor++;
      filled.push({ panel, shot });
    });
    // A frame with nothing in it reads as a mistake, so drop the leftovers, then
    // close the hole they left by growing the rest back over the page.
    page.items = page.items.filter(
      (i) => i.type !== "panel" || filled.some((f) => f.panel.id === i.id),
    );
    growPanelsToPage(
      page,
      filled.map((f) => f.panel),
    );
    // Panels keep their cells; the picture fills the frame it was given, so the
    // page never ends up with bands of empty paper between rows.
    filled.forEach(({ panel, shot }) => placeShotInPanel(page, panel, shot));
    if (opts.music && pageIndex === 0) page.playback.ambientAudio = musicToClip(opts.music);
    pages.push(page);
  });

  return {
    id: opts.projectId ?? uid("comic"),
    title: opts.title.trim() || "کمیک تازه",
    description: opts.description ?? "",
    readingDirection: opts.direction,
    sourceLanguage: "fa",
    translations: {},
    pages,
    createdAt: opts.createdAt ?? now,
    updatedAt: now,
    coverAssetId: opts.shots[0]?.assetId,
    documentVersion: DOCUMENT_VERSION,
  };
}

/**
 * Automatic page: panels come from the pictures, not from a template grid. The
 * mosaic already fills the paper, so there is nothing to fit or grow after it —
 * only the reading order to mirror when the comic runs right to left.
 */
function buildAutoPage(
  page: ComicPage,
  shots: EasyShot[],
  plan: EasyPagePlan,
  direction: ReadingDirection,
) {
  if (!shots.length) return;
  const rects = mosaicRects(
    shots.map((s) => s.frame.w / s.frame.h),
    page.w,
    page.h,
    GUTTERS[plan.gutter ?? "normal"],
  );
  shots.forEach((shot, i) => {
    const r = rects[i];
    if (!r) return;
    // Mirror across the page so the first picture sits where reading starts.
    const x = direction === "rtl" ? page.w - r.x - r.w : r.x;
    const panel = newPanel(page, {
      x,
      y: r.y,
      w: r.w,
      h: r.h,
      kind: plan.panelKind,
      // A thinner keyline: with frames this close, a heavy border reads as a gap.
      stroke: 3,
      radius: plan.panelKind === "round" || plan.panelKind === "circle" ? 20 : 2,
      story: defaultStory(i + 1),
    });
    insertItem(page, panel);
    placeShotInPanel(page, panel, shot);
  });
}

/** Copy one finished frame — picture and bubbles — into its panel. */
function placeShotInPanel(page: ComicPage, panel: PanelItem, shot: EasyShot) {
  const frame = shot.frame;
  // Bubbles were placed on a frame of one aspect and land in a panel of another;
  // scaling by the smaller axis keeps them inside the frame they were drawn in.
  const scale = Math.min(panel.w / frame.w, panel.h / frame.h);
  const src = shotMedia(shot);
  if (src) {
    const placed = {
      ...src,
      fitMode: "fill" as const,
      id: uid("i"),
      x: panel.x,
      y: panel.y,
      w: panel.w,
      h: panel.h,
      panelId: panel.id,
      free: false,
      radius: panel.radius || 0,
      story: defaultStory(panel.story.order),
    } as ImageItem | VideoItem;
    insertItem(page, placed);
  }
  const offX = panel.x + (panel.w - frame.w * scale) / 2;
  const offY = panel.y + (panel.h - frame.h * scale) / 2;
  shotBubbles(shot).forEach((b) => {
    const copy: BubbleItem = {
      ...b,
      id: uid("i"),
      x: offX + b.x * scale,
      y: offY + b.y * scale,
      w: b.w * scale,
      h: b.h * scale,
      tx: offX + b.tx * scale,
      ty: offY + b.ty * scale,
      font: Math.max(10, Math.round(b.font * scale)),
      stroke: Math.max(0, b.stroke * scale),
      radius: b.radius * scale,
      tail: b.tail * scale,
      panelId: panel.id,
    };
    insertItem(page, copy as ComicItem);
  });
}
