import { uid } from "@/lib/utils";
import type {
  AudioClip,
  BubbleItem,
  BubbleKind,
  ComicItem,
  ComicPage,
  ComicProject,
  DrawingItem,
  ImageItem,
  PanelItem,
  PanelKind,
  PanelStory,
  ReadingDirection,
  ShapeItem,
  ShapeKind,
  TextItem,
  VideoItem,
} from "./types";
import { DOCUMENT_VERSION } from "./types";
import { PANEL_LAYOUTS } from "./layouts";
import { clampItem, panelAt } from "./geometry";

export function defaultStory(order = 1): PanelStory {
  return { order, reveal: "click", delayMs: 1000, audio: null };
}

export function newAudio(assetId: string, volume = 1): AudioClip {
  return {
    assetId,
    start: 0,
    end: 0,
    volume,
    fadeInMs: 180,
    fadeOutMs: 220,
  };
}

export function newPage(name = "", w = 800, h = 1600): ComicPage {
  return {
    id: uid("p"),
    name,
    w,
    h,
    items: [],
    background: { color: "#f6f1e6", assetId: "", zoom: 1, x: 0, y: 0, locked: false },
    playback: {
      directorLock: false,
      defaultDelayMs: 1000,
      defaultReveal: "click",
      ambientAudio: null,
    },
  };
}

export function newProject(
  title: string,
  opts: { description?: string; direction?: ReadingDirection; w?: number; h?: number } = {},
): ComicProject {
  const now = Date.now();
  const page = newPage("صفحه ۱", opts.w ?? 800, opts.h ?? 1600);
  applyLayout(page, "2v");
  return {
    id: uid("comic"),
    title: title.trim() || "کمیک بی‌نام",
    description: opts.description ?? "",
    readingDirection: opts.direction ?? "rtl",
    sourceLanguage: "fa",
    translations: {},
    pages: [page],
    createdAt: now,
    updatedAt: now,
    documentVersion: DOCUMENT_VERSION,
  };
}

export function newPanel(page: ComicPage, extra: Partial<PanelItem> = {}): PanelItem {
  const kind: PanelKind = extra.kind ?? "rect";
  const w = extra.w ?? page.w * 0.84;
  const h = extra.h ?? Math.min(page.h * 0.34, page.w * 0.72);
  return {
    id: uid("i"),
    type: "panel",
    x: extra.x ?? page.w * 0.08,
    y: extra.y ?? page.h * 0.08,
    w,
    h,
    fill: "#ffffff",
    stroke: 7,
    strokeColor: "#16171A",
    radius: kind === "round" || kind === "circle" ? Math.min(w, h) * 0.18 : 4,
    story: defaultStory(1),
    ...extra,
    kind,
  };
}

export function newImage(page: ComicPage, assetId: string, extra: Partial<ImageItem> = {}): ImageItem {
  return {
    id: uid("i"),
    type: "image",
    assetId,
    x: page.w * 0.12,
    y: page.h * 0.12,
    w: page.w * 0.5,
    h: page.h * 0.32,
    zoom: 1,
    cropX: 0,
    cropY: 0,
    fitMode: "fill",
    radius: 0,
    stroke: 0,
    strokeColor: "#16171A",
    aspectLock: true,
    sourceRatio: 1,
    ...extra,
  };
}

export function newVideo(page: ComicPage, assetId: string, extra: Partial<VideoItem> = {}): VideoItem {
  return {
    id: uid("i"),
    type: "video",
    assetId,
    x: page.w * 0.12,
    y: page.h * 0.12,
    w: page.w * 0.5,
    h: page.h * 0.32,
    zoom: 1,
    cropX: 0,
    cropY: 0,
    fitMode: "fill",
    radius: 0,
    stroke: 0,
    strokeColor: "#16171A",
    aspectLock: false,
    sourceRatio: 16 / 9,
    trimStart: 0,
    trimEnd: extra.duration ?? 0,
    duration: extra.duration ?? 0,
    speed: 1,
    volume: 1,
    muted: false,
    ...extra,
  };
}

export function newBubble(page: ComicPage, kind: BubbleKind = "round", extra: Partial<BubbleItem> = {}): BubbleItem {
  const w = page.w * 0.42;
  const h = page.h * 0.16;
  const x = page.w * 0.29;
  const y = page.h * 0.08;
  return {
    id: uid("i"),
    type: "bubble",
    kind,
    text: "",
    font: 28,
    fontFamily: "Vazirmatn, Tahoma, sans-serif",
    align: "center",
    color: "#16171A",
    fill: "#ffffff",
    stroke: 5,
    strokeColor: "#16171A",
    radius: kind === "rect" ? 18 : 34,
    tail: 90,
    x,
    y,
    w,
    h,
    tx: x + w / 2,
    ty: y + h + 90,
    alpha: 1,
    lead: 1.45,
    direction: "rtl",
    timing: { enabled: false, startMs: 0, endMs: 2000 },
    ...extra,
  };
}

export function newText(page: ComicPage, extra: Partial<TextItem> = {}): TextItem {
  return {
    id: uid("i"),
    type: "text",
    text: "متن",
    font: 32,
    fontFamily: "Vazirmatn, Tahoma, sans-serif",
    align: "center",
    color: "#16171A",
    x: page.w * 0.2,
    y: page.h * 0.82,
    w: page.w * 0.6,
    h: page.h * 0.1,
    lead: 1.45,
    direction: "rtl",
    ...extra,
  };
}

export function newShape(page: ComicPage, kind: ShapeKind, extra: Partial<ShapeItem> = {}): ShapeItem {
  return {
    id: uid("i"),
    type: "shape",
    kind,
    fill: kind === "line" || kind === "arrow" ? "transparent" : "#ffffff",
    stroke: 6,
    strokeColor: "#16171A",
    radius: 18,
    x: page.w * 0.25,
    y: page.h * 0.3,
    w: page.w * 0.4,
    h: page.h * 0.18,
    ...extra,
  };
}

export function newDrawing(extra: Partial<DrawingItem> = {}): DrawingItem {
  return {
    id: uid("i"),
    type: "drawing",
    points: [],
    color: "#16171A",
    width: 8,
    x: 0,
    y: 0,
    w: 8,
    h: 8,
    ...extra,
  };
}

const RANK: Record<string, number> = {
  panel: 0,
  image: 1,
  video: 1,
  shape: 2,
  bubble: 3,
  text: 3,
  drawing: 3,
};

export function insertItem(page: ComicPage, item: ComicItem) {
  clampItem(item, page);
  const r = RANK[item.type] ?? 2;
  let at = page.items.length;
  for (let i = 0; i < page.items.length; i++) {
    if ((RANK[page.items[i].type] ?? 2) > r) {
      at = i;
      break;
    }
  }
  page.items.splice(at, 0, item);
  return item;
}

export function applyLayout(page: ComicPage, key: string) {
  const L = PANEL_LAYOUTS.find((x) => x.k === key);
  if (!L) return false;
  const oldPanelIds = new Set(page.items.filter((i) => i.type === "panel").map((i) => i.id));
  const framed = page.items.filter(
    (i) => (i.type === "image" || i.type === "video") && !i.free && i.panelId && oldPanelIds.has(i.panelId),
  );
  if (page.items.some((i) => (i.type === "panel" || framed.includes(i)) && i.locked)) return false;
  if (L.cells.length && framed.length > L.cells.length) return false;
  page.items = page.items.filter((i) => i.type !== "panel");
  const m = page.w * 0.05;
  const gap = page.w * 0.026;
  const W = page.w - m * 2;
  const H = page.h - m * 2;
  const newPanels: PanelItem[] = [];
  L.cells.forEach((cell, index) => {
    const fx = cell.x;
    const fy = cell.y;
    const fw = cell.w;
    const fh = cell.h;
    const overlap = L.cells.filter((c) => c !== cell && boxesOverlap(cell, c)).length > 0;
    const gx = overlap ? 0 : gap;
    const panel = newPanel(page, {
      x: m + fx * W + (fx > 0 ? gx / 2 : 0),
      y: m + fy * H + (fy > 0 ? gx / 2 : 0),
      w: fw * W - (fx > 0 ? gx / 2 : 0) - (fx + fw < 0.999 ? gx / 2 : 0),
      h: fh * H - (fy > 0 ? gx / 2 : 0) - (fy + fh < 0.999 ? gx / 2 : 0),
      kind: cell.kind || "rect",
      radius: cell.kind === "round" ? 28 : 4,
      story: defaultStory(index + 1),
    });
    insertItem(page, panel);
    newPanels.push(panel);
  });
  framed.forEach((it, index) => {
    const owner = newPanels[index];
    if (!owner) {
      delete it.panelId;
      it.free = true;
      return;
    }
    it.free = false;
    it.panelId = owner.id;
    it.x = owner.x;
    it.y = owner.y;
    it.w = owner.w;
    it.h = owner.h;
    if (it.type === "image" || it.type === "video") it.radius = owner.radius || 0;
  });
  page.items
    .filter((it) => it.type !== "panel" && !((it.type === "image" || it.type === "video") && it.free))
    .forEach((it) => {
      const owner = panelAt(page, it.x + it.w / 2, it.y + it.h / 2);
      if (owner) it.panelId = owner.id;
      else delete it.panelId;
    });
  return true;
}

function boxesOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w - 0.02 && a.x + a.w > b.x + 0.02 && a.y < b.y + b.h - 0.02 && a.y + a.h > b.y + 0.02;
}

export function attachMediaToPanel(page: ComicPage, item: ImageItem | VideoItem, panel: PanelItem) {
  item.free = false;
  item.panelId = panel.id;
  item.x = panel.x;
  item.y = panel.y;
  item.w = panel.w;
  item.h = panel.h;
  item.radius = panel.radius || 0;
}

export function addPanelToPage(page: ComicPage, extra: Partial<PanelItem> = {}): PanelItem {
  const panels = page.items.filter((i): i is PanelItem => i.type === "panel");
  const m = page.w * 0.05;
  const gap = page.w * 0.026;
  let x = extra.x;
  let y = extra.y;
  let w = extra.w;
  let h = extra.h;
  if (x == null || y == null || w == null || h == null) {
    w = w ?? Math.min(page.w - m * 2, page.w * 0.84);
    h = h ?? Math.min(page.h * 0.32, page.w * 0.7);
    if (!panels.length) {
      x = m;
      y = m;
    } else {
      const last = panels.reduce((a, b) => (a.y + a.h >= b.y + b.h ? a : b));
      const below = last.y + last.h + gap;
      if (below + h <= page.h - m) {
        x = last.x;
        y = below;
        w = last.w;
      } else {
        const side = last.x + last.w + gap;
        if (side + page.w * 0.36 <= page.w - m) {
          x = side;
          y = last.y;
          w = page.w - m - side;
          h = last.h;
        } else {
          x = Math.min(page.w - w - m, Math.max(m, last.x + 28));
          y = Math.min(page.h - h - m, Math.max(m, last.y + 36));
        }
      }
    }
  }
  const panel = newPanel(page, {
    ...extra,
    x,
    y,
    w,
    h,
    story: extra.story ?? defaultStory(panels.length + 1),
  });
  insertItem(page, panel);
  return panel;
}

export function duplicateItem(it: ComicItem): ComicItem {
  const copy = structuredClone(it);
  copy.id = uid("i");
  copy.x += 24;
  copy.y += 24;
  if (copy.type === "bubble") {
    copy.tx += 24;
    copy.ty += 24;
  }
  if (copy.type === "drawing") {
    copy.points = copy.points.map((p) => ({ x: p.x + 24, y: p.y + 24 }));
  }
  return copy;
}

export function clonePage(page: ComicPage): ComicPage {
  const copy = structuredClone(page);
  copy.id = uid("p");
  copy.name = page.name ? `${page.name} (کپی)` : "کپی صفحه";
  const idMap = new Map<string, string>();
  copy.items.forEach((it) => {
    const nid = uid("i");
    idMap.set(it.id, nid);
    it.id = nid;
  });
  copy.items.forEach((it) => {
    if (it.panelId && idMap.has(it.panelId)) it.panelId = idMap.get(it.panelId);
  });
  return copy;
}

export function itemLabel(it: ComicItem) {
  if (it.name) return it.name;
  switch (it.type) {
    case "panel":
      return `قاب ${it.story.order}`;
    case "image":
      return it.free ? "تصویر آزاد" : "تصویر قاب";
    case "video":
      return it.free ? "ویدئوی آزاد" : "ویدئوی قاب";
    case "bubble":
      return it.text?.slice(0, 18) || "حباب";
    case "text":
      return it.text?.slice(0, 18) || "متن";
    case "shape":
      return "شکل";
    case "drawing":
      return "قلم";
  }
}
