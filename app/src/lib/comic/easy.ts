import { uid } from "@/lib/utils";
import { applyLayout, defaultStory, insertItem, newBubble, newImage, newPage } from "./factory";
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

export interface EasyShot {
  id: string;
  assetId: string;
  name: string;
  /** Aspect of the source file, used to offer a sensible starting frame. */
  sourceRatio: number;
  /** Frame ratio id from FRAME_RATIOS. */
  ratioId: string;
  /** The editable frame: image + bubbles, in its own coordinate space. */
  frame: ComicPage;
}

export interface EasyPagePlan {
  layoutKey: string;
  panelKind: PanelKind;
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

export function newShot(assetId: string, name: string, sourceRatio: number): EasyShot {
  const ratioId = closestRatioId(sourceRatio || 1);
  const { w, h } = frameSize(ratioId);
  const frame = newPage("", w, h);
  frame.background.color = "#ffffff";
  const image = newImage(frame, assetId, {
    x: 0,
    y: 0,
    w,
    h,
    fitMode: "fill",
    sourceRatio: sourceRatio || 1,
    adjust: { ...NEUTRAL_ADJUST },
  });
  insertItem(frame, image);
  return { id: uid("shot"), assetId, name, sourceRatio: sourceRatio || 1, ratioId, frame };
}

export function shotImage(shot: EasyShot): ImageItem | null {
  return (shot.frame.items.find((i) => i.type === "image") as ImageItem | undefined) ?? null;
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
    if (it.type === "image") {
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
  return Math.max(1, layoutCellCount(plan.layoutKey));
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
    const key =
      left > 0 && left < cellsPerPage(plan) ? layoutForCount(plan.layoutKey, left) : plan.layoutKey;
    applyLayout(page, key);
    const panels = readingOrder(
      page.items.filter((i): i is PanelItem => i.type === "panel"),
      opts.direction,
    );
    // Pass one: shape every panel around the picture it will hold.
    const filled: { panel: PanelItem; shot: EasyShot }[] = [];
    panels.forEach((panel, order) => {
      panel.kind = plan.panelKind;
      panel.radius = plan.panelKind === "round" || plan.panelKind === "circle" ? 28 : 4;
      panel.story = defaultStory(order + 1);
      const shot = opts.shots[cursor];
      if (!shot) return;
      cursor++;
      fitPanelToRatio(panel, shot.frame.w / shot.frame.h);
      filled.push({ panel, shot });
    });
    // A frame with nothing in it reads as a mistake, so drop the leftovers.
    page.items = page.items.filter(
      (i) => i.type !== "panel" || filled.some((f) => f.panel.id === i.id),
    );
    growPanelsToPage(
      page,
      filled.map((f) => f.panel),
    );
    // Pass two: pour each picture (and its bubbles) into its finished panel.
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

/** Copy one finished frame — picture and bubbles — into its panel. */
function placeShotInPanel(page: ComicPage, panel: PanelItem, shot: EasyShot) {
  const frame = shot.frame;
  const scale = panel.w / frame.w;
  const src = shotImage(shot);
  if (src) {
    const image = newImage(page, shot.assetId, {
      ...src,
      id: uid("i"),
      x: panel.x,
      y: panel.y,
      w: panel.w,
      h: panel.h,
      panelId: panel.id,
      free: false,
      radius: panel.radius || 0,
      story: defaultStory(panel.story.order),
    });
    insertItem(page, image);
  }
  shotBubbles(shot).forEach((b) => {
    const copy: BubbleItem = {
      ...b,
      id: uid("i"),
      x: panel.x + b.x * scale,
      y: panel.y + b.y * scale,
      w: b.w * scale,
      h: b.h * scale,
      tx: panel.x + b.tx * scale,
      ty: panel.y + b.ty * scale,
      font: Math.max(10, Math.round(b.font * scale)),
      stroke: Math.max(0, b.stroke * scale),
      radius: b.radius * scale,
      tail: b.tail * scale,
      panelId: panel.id,
    };
    insertItem(page, copy as ComicItem);
  });
}
