import { create } from "zustand";
import { toast } from "sonner";
import { clamp, downloadBlob, uid } from "@/lib/utils";
import { layoutCellCount } from "./layouts";
import type {
  AssetKind,
  AssetMeta,
  BubbleKind,
  ComicItem,
  ComicPage,
  ComicProject,
  DrawingItem,
  EditorTool,
  ImageItem,
  InspectorTab,
  PanelItem,
  ProjectMeta,
  ShapeKind,
  StudioSheet,
  VideoItem,
} from "./types";
import {
  collectAssetIds,
  ensureAllUrls,
  adoptBlobUrl,
  listAssets,
  mediaUrl,
  putAsset,
  type AssetRecord,
} from "./db";
import {
  applyLayout,
  attachMediaToPanel,
  clonePage,
  duplicateItem,
  insertItem,
  newAudio,
  newBubble,
  newDrawing,
  newImage,
  newPage,
  newProject,
  newShape,
  newText,
  newVideo,
  addPanelToPage,
} from "./factory";
import { clampItem, moveItem, panelAt, isFramedMedia, scaleFromCenter, bumpMediaZoom } from "./geometry";
import { loadImageAsset, loadVideoAsset } from "./media-cache";
import { seedSampleIfNeeded } from "./sample";
import { exportProjectPackage, importProjectPackage } from "./package";
import { loadPrefs, savePrefs } from "./prefs";
import { musicSpan, throughPageValue } from "./reader";
import { indexedDbComics } from "./repository";

interface HistorySnap {
  pages: ComicPage[];
  pageIndex: number;
  translations: ComicProject["translations"];
  readingDirection: ComicProject["readingDirection"];
}

interface StudioState {
  ready: boolean;
  library: ProjectMeta[];
  assets: AssetMeta[];
  project: ComicProject | null;
  pageIndex: number;
  selectedId: string | null;
  tool: EditorTool;
  inspectorTab: InspectorTab;
  sheet: StudioSheet | null;
  viewZoom: number;
  snap: boolean;
  dirty: boolean;
  saveStatus: "saved" | "saving" | "unsaved";
  persistError: boolean;
  drawColor: string;
  drawWidth: number;
  previewLanguage: string;
  mediaTick: number;
  wantEdit: string | null;
  cropArmed: boolean;
  liveGen: number;
  importing: boolean;
  undo: HistorySnap[];
  redo: HistorySnap[];

  boot: () => Promise<void>;
  refreshLibrary: () => Promise<void>;
  openProject: (id: string) => Promise<void>;
  closeProject: () => void;
  createProject: (title: string, opts?: Parameters<typeof newProject>[1]) => Promise<ComicProject>;
  removeProject: (id: string) => Promise<void>;
  duplicateProject: (id: string) => Promise<ComicProject | null>;
  renameProject: (id: string, title: string) => Promise<void>;
  exportProjectFile: (id?: string) => Promise<void>;
  importProjectFile: (file: File) => Promise<ComicProject>;

  setTitle: (title: string) => void;
  setDescription: (d: string) => void;
  setDirection: (d: "rtl" | "ltr") => void;
  setTab: (t: InspectorTab) => void;
  setSheet: (s: StudioSheet | null) => void;
  setTool: (t: EditorTool) => void;
  setZoom: (z: number) => void;
  setSnap: (v: boolean) => void;
  setDrawColor: (c: string) => void;
  setDrawWidth: (w: number) => void;
  select: (id: string | null) => void;
  cyclePanels: (dir: 1 | -1) => void;
  requestEdit: (id: string | null) => void;
  armCrop: (v: boolean) => void;
  focusPage: (i: number) => void;
  mutateLive: (fn: (page: ComicPage) => void) => void;
  flushLive: () => void;

  page: () => ComicPage | null;
  selected: () => ComicItem | null;

  snapHistory: () => void;
  undoAction: () => void;
  redoAction: () => void;

  touchPage: (fn: (page: ComicPage) => void, history?: boolean) => void;
  patchItem: (id: string, patch: Partial<ComicItem>, history?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  nudgeSelected: (dx: number, dy: number) => void;
  setCoverFromPage: () => Promise<void>;
  toggleLock: () => void;
  toggleHidden: (id: string) => void;
  reorderLayer: (from: number, to: number) => void;

  addPage: () => void;
  duplicatePage: () => void;
  deletePage: () => void;
  goPage: (i: number) => void;
  movePage: (from: number, to: number) => void;
  renamePage: (name: string) => void;
  setPageSize: (w: number, h: number) => void;
  setBgColor: (color: string) => void;
  applyLayoutKey: (key: string) => void;
  addPanel: (extra?: Partial<PanelItem>) => void;
  setAmbientThrough: (endPageIndex: number) => void;
  clearAmbient: () => void;
  scaleSelectedMedia: (factor: number) => void;
  toggleMediaFree: () => void;

  importFiles: (
    files: File[],
    opts?: { target?: "page" | "panel" | "free" | "bg" | "audio" | "panel-audio"; panelId?: string; replaceId?: string },
  ) => Promise<void>;
  addBubble: (kind?: BubbleKind) => void;
  addText: () => void;
  addShape: (kind: ShapeKind) => void;
  startDrawing: () => DrawingItem | null;
  fillEmptyPanels: (assetIds: string[]) => void;
  placeAsset: (assetId: string) => void;

  saveNow: () => Promise<void>;
}

function snapshot(s: StudioState): HistorySnap {
  return {
    pages: structuredClone(s.project?.pages ?? []),
    pageIndex: s.pageIndex,
    translations: structuredClone(s.project?.translations ?? {}),
    readingDirection: s.project?.readingDirection ?? "rtl"
  };
}
function restore(s: StudioState, snap: HistorySnap) {
  if (!s.project) return;
  s.project.pages = structuredClone(snap.pages);
  s.pageIndex = snap.pages.length ? clamp(snap.pageIndex, 0, snap.pages.length - 1) : -1;
  s.project.translations = structuredClone(snap.translations);
  s.project.readingDirection = snap.readingDirection;
  s.selectedId = null;
  s.dirty = true;
  s.saveStatus = "unsaved";
}
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let clip: ComicItem | null = null;
let sessionTimer: ReturnType<typeof setTimeout> | null = null;
let booting: Promise<void> | null = null;
const SESSION_KEY = "kader:open-project";
function readSession(): ComicProject | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p?.id || !Array.isArray(p.pages)) return null;
    return p;
  } catch {
    return null;
  }
}
function persistSession(p: ComicProject | null, immediate = false) {
  if (typeof window === "undefined") return;
  const write = () => {
    try {
      if (!p) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify(p));
    } catch {
      /* quota */
    }
  };
  if (immediate) {
    if (sessionTimer) clearTimeout(sessionTimer);
    write();
    return;
  }
  if (sessionTimer) clearTimeout(sessionTimer);
  sessionTimer = setTimeout(write, 120);
}
function placeFreeMedia(pg: ComicPage, item: ImageItem | VideoItem) {
  item.free = true;
  delete item.panelId;
  const ratio = item.sourceRatio || (item.type === "video" ? 16 / 9 : 1);
  item.w = pg.w * 0.72;
  item.h = item.w / Math.max(0.3, ratio);
  if (item.h > pg.h * 0.42) {
    item.h = pg.h * 0.42;
    item.w = item.h * Math.max(0.3, ratio);
  }
  item.x = (pg.w - item.w) / 2;
  item.y = pg.h * 0.1;
}

function scheduleSave(get: () => StudioState) {
  persistSession(get().project);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    get().saveNow();
  }, 700);
}
async function makeThumb(file: File, kind: AssetKind): Promise<Blob | undefined> {
  if (kind === "audio") return undefined;
  if (kind === "image") {
    const bmp = await createImageBitmap(file);
    const cv = document.createElement("canvas");
    const scale = 360 / Math.max(bmp.width, bmp.height);
    cv.width = Math.max(1, Math.round(bmp.width * scale));
    cv.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = cv.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise((res) => cv.toBlob((b) => res(b || undefined), "image/jpeg", .82));
  }
  return undefined;
}
async function probeMedia(file: File, kind: AssetKind) {
  const url = URL.createObjectURL(file);
  try {
    if (kind === "image") {
      const img = new Image();
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = url;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 4000)),
      ]);
      return {
        width: img.naturalWidth || undefined,
        height: img.naturalHeight || undefined,
        duration: undefined as number | undefined,
      };
    }
    if (kind === "video" || kind === "audio") {
      const el = document.createElement(kind === "video" ? "video" : "audio");
      el.preload = "metadata";
      await Promise.race([
        new Promise<void>((resolve) => {
          el.onloadedmetadata = () => resolve();
          el.onerror = () => resolve();
          el.src = url;
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 3500)),
      ]);
      const vid = el as HTMLVideoElement;
      return {
        width: kind === "video" ? vid.videoWidth || undefined : undefined,
        height: kind === "video" ? vid.videoHeight || undefined : undefined,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
      };
    }
  } catch {
    /* ignore */
  } finally {
    URL.revokeObjectURL(url);
  }
  return {
    width: undefined as number | undefined,
    height: undefined as number | undefined,
    duration: undefined as number | undefined,
  };
}
function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const n = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "image";
  if (/\.(mp4|webm|mov)$/.test(n)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(n)) return "audio";
  return null;
}
function layoutCount(key: string) {
  return layoutCellCount(key);
}
export const useStudio = create<StudioState>((set, get) => ({
  ready: false,
  library: [],
  assets: [],
  project: readSession(),
  pageIndex: 0,
  selectedId: null,
  tool: "select",
  inspectorTab: "props",
  sheet: null,
  viewZoom: 1,
  snap: true,
  dirty: false,
  saveStatus: "saved",
  persistError: false,
  drawColor: "#16171A",
  drawWidth: 8,
  previewLanguage: "fa",
  mediaTick: 0,
  wantEdit: null,
  cropArmed: false,
  liveGen: 0,
  importing: false,
  undo: [],
  redo: [],
  boot: async () => {
    if (get().ready) return;
    if (booting) return booting;
    booting = (async () => {
      if (typeof indexedDB === "undefined") {
        set({ ready: true });
        return;
      }
      await seedSampleIfNeeded();
      const prefs = loadPrefs();
      const [library, assets] = await Promise.all([indexedDbComics.list(), listAssets()]);
      set({
        library,
        assets,
        ready: true,
        snap: prefs.snap
      });
    })();
    try {
      await booting;
    } finally {
      booting = null;
    }
  },
  refreshLibrary: async () => {
    const [library, assets] = await Promise.all([indexedDbComics.list(), listAssets()]);
    set({
      library,
      assets
    });
  },
  openProject: async (id) => {
    if (get().project?.id === id) {
      const p = get().project;
      if (p) {
        persistSession(p);
        void ensureAllUrls(collectAssetIds(p)).then(() => set({ mediaTick: Date.now() }));
      }
      return;
    }
    const project = await indexedDbComics.get(id);
    if (!project) {
      toast.error("کمیک پیدا نشد");
      return;
    }
    persistSession(project, true);
    set({
      project,
      pageIndex: project.pages.length ? 0 : -1,
      selectedId: null,
      undo: [],
      redo: [],
      dirty: false,
      saveStatus: "saved",
      previewLanguage: project.sourceLanguage || "fa",
      viewZoom: 1,
      inspectorTab: "props",
      sheet: null,
      mediaTick: Date.now(),
      tool: "select"
    });
    ensureAllUrls(collectAssetIds(project)).then(() => set({ mediaTick: Date.now() }));
  },
  closeProject: () => {
    const { dirty, project } = get();
    persistSession(project, true);
    if (dirty && project) void get().saveNow().catch(() => undefined);
  },
  createProject: async (title, opts) => {
    const project = newProject(title, opts);
    await indexedDbComics.save(project);
    await get().refreshLibrary();
    return project;
  },
  removeProject: async (id) => {
    await indexedDbComics.remove(id);
    if (get().project?.id === id) set({ project: null });
    await get().refreshLibrary();
  },
  duplicateProject: async (id) => {
    const src = await indexedDbComics.get(id);
    if (!src) return null;
    const copy = structuredClone(src);
    copy.id = uid("comic");
    copy.title = `${src.title} — کپی`;
    copy.createdAt = Date.now();
    copy.updatedAt = Date.now();
    await indexedDbComics.save(copy);
    await get().refreshLibrary();
    return copy;
  },
  renameProject: async (id, title) => {
    const src = await indexedDbComics.get(id);
    if (!src) return;
    src.title = title.slice(0, 120);
    src.updatedAt = Date.now();
    await indexedDbComics.save(src);
    if (get().project?.id === id) set({ project: { ...src } });
    await get().refreshLibrary();
  },
  exportProjectFile: async (id) => {
    const pid = id || get().project?.id;
    if (!pid) return;
    if (get().project?.id === pid) await get().saveNow();
    const project = await indexedDbComics.get(pid);
    if (!project) return;
    const blob = await exportProjectPackage(project);
    downloadBlob(blob, `${project.title || "comic"}.kader.json`);
    toast.success("پرونده ذخیره شد");
  },
  importProjectFile: async (file) => {
    const project = await importProjectPackage(file);
    await indexedDbComics.save(project);
    await ensureAllUrls(collectAssetIds(project));
    await get().refreshLibrary();
    toast.success("کمیک وارد شد");
    return project;
  },
  setTitle: (title) => {
    const p = get().project;
    if (!p) return;
    p.title = title;
    set({
      project: { ...p },
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  setDescription: (d) => {
    const p = get().project;
    if (!p) return;
    p.description = d;
    set({
      project: { ...p },
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  setDirection: (d) => {
    const p = get().project;
    if (!p) return;
    get().snapHistory();
    p.readingDirection = d;
    set({
      project: { ...p },
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  setTab: (t) => set({ inspectorTab: t }),
  setSheet: (s) => set({ sheet: s }),
  setTool: (t) => set({
    tool: t,
    sheet: t === "draw" ? "draw" : get().sheet === "draw" ? null : get().sheet
  }),
  setZoom: (z) => set({ viewZoom: clamp(z, .25, 4) }),
  setSnap: (v) => {
    set({ snap: v });
    savePrefs({
      ...loadPrefs(),
      snap: v
    });
  },
  setDrawColor: (c) => set({ drawColor: c }),
  setDrawWidth: (w) => set({ drawWidth: w }),
  select: (id) => {
    set({
      selectedId: id,
      inspectorTab: id ? "props" : get().inspectorTab,
      cropArmed: id ? get().cropArmed : false
    });
  },
  cyclePanels: (dir) => {
    const page = get().page();
    if (!page) return;
    const panels = page.items.filter((i) => i.type === "panel");
    if (!panels.length) return;
    const next = panels[(panels.findIndex((p) => p.id === get().selectedId) + dir + panels.length) % panels.length];
    get().select(next.id);
  },
  requestEdit: (id) => set({ wantEdit: id }),
  armCrop: (v) => set({
    cropArmed: v,
    tool: v ? "select" : get().tool,
    sheet: v ? null : get().sheet
  }),
  page: () => {
    const p = get().project;
    if (!p || !p.pages.length) return null;
    return p.pages[clamp(get().pageIndex, 0, p.pages.length - 1)] ?? null;
  },
  selected: () => {
    const page = get().page();
    const id = get().selectedId;
    if (!page || !id) return null;
    return page.items.find((i) => i.id === id) ?? null;
  },
  snapHistory: () => {
    const s = get();
    if (!s.project) return;
    set({
      undo: [...s.undo, snapshot(s)].slice(-50),
      redo: []
    });
  },
  undoAction: () => {
    const s = get();
    if (!s.undo.length || !s.project) return;
    const redo = [...s.redo, snapshot(s)];
    const snap = s.undo[s.undo.length - 1];
    restore(s, snap);
    set({
      project: { ...s.project },
      pageIndex: s.pageIndex,
      undo: s.undo.slice(0, -1),
      redo,
      selectedId: null,
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  redoAction: () => {
    const s = get();
    if (!s.redo.length || !s.project) return;
    const undo = [...s.undo, snapshot(s)];
    const snap = s.redo[s.redo.length - 1];
    restore(s, snap);
    set({
      project: { ...s.project },
      pageIndex: s.pageIndex,
      redo: s.redo.slice(0, -1),
      undo,
      selectedId: null,
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  touchPage: (fn, history = true) => {
    const s = get();
    const page = s.page();
    if (!page) return;
    if (history) s.snapHistory();
    fn(page);
    page.items.forEach((it) => clampItem(it, page));
    const p = s.project!;
    p.updatedAt = Date.now();
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      dirty: true,
      saveStatus: "unsaved",
      liveGen: get().liveGen + 1
    });
    scheduleSave(get);
  },
  mutateLive: (fn) => {
    const page = get().page();
    if (!page) return;
    fn(page);
  },
  flushLive: () => {
    const p = get().project;
    if (!p) return;
    p.updatedAt = Date.now();
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      dirty: true,
      saveStatus: "unsaved",
      liveGen: get().liveGen + 1
    });
    scheduleSave(get);
  },
  focusPage: (i) => {
    const p = get().project;
    if (!p?.pages.length) return;
    const idx = clamp(i, 0, p.pages.length - 1);
    if (idx === get().pageIndex) return;
    set({ pageIndex: idx });
  },
  patchItem: (id, patch, history = false) => {
    get().touchPage((page) => {
      const it = page.items.find((x) => x.id === id);
      if (!it) return;
      Object.assign(it, patch);
      if ((it.type === "image" || it.type === "video") && it.panelId && !it.free) {
        const owner = page.items.find((p) => p.type === "panel" && p.id === it.panelId);
        if (owner) {
          it.x = owner.x;
          it.y = owner.y;
          it.w = owner.w;
          it.h = owner.h;
        }
      }
    }, history);
  },
  deleteSelected: () => {
    const id = get().selectedId;
    if (!id) return;
    get().touchPage((page) => {
      if (page.items.find((x) => x.id === id)?.locked) {
        toast.message("اول قفل را باز کن");
        return;
      }
      page.items = page.items.filter((x) => x.id !== id && x.panelId !== id);
    });
    set({ selectedId: null });
  },
  duplicateSelected: () => {
    const it = get().selected();
    if (!it) return;
    let nid = "";
    get().touchPage((page) => {
      const copy = duplicateItem(it);
      copy.x += 28;
      copy.y += 28;
      nid = copy.id;
      insertItem(page, copy);
    });
    if (nid) set({ selectedId: nid });
  },
  copySelected: () => {
    const it = get().selected();
    if (!it) return;
    clip = structuredClone(it);
    toast.message("کپی شد");
  },
  pasteClipboard: () => {
    if (!clip) return;
    let nid = "";
    get().touchPage((page) => {
      const copy = duplicateItem(clip!);
      copy.x += 36;
      copy.y += 36;
      nid = copy.id;
      insertItem(page, copy);
    });
    if (nid) set({ selectedId: nid });
  },
  nudgeSelected: (dx, dy) => {
    const it = get().selected();
    if (!it || it.locked) return;
    get().touchPage((page) => {
      const cur = page.items.find((x) => x.id === it.id);
      if (!cur) return;
      moveItem(cur, dx, dy, page);
      clampItem(cur, page);
    }, true);
  },
  setCoverFromPage: async () => {
    const p = get().project;
    const page = get().page();
    if (!p || !page) return;
    const img = page.items.find((i) => i.type === "image");
    p.coverAssetId = img && img.type === "image" ? img.assetId : page.background.assetId || p.coverAssetId;
    set({
      project: { ...p },
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
    toast.success("جلد از این صفحه گرفته شد");
  },
  toggleLock: () => {
    const it = get().selected();
    if (!it) return;
    get().patchItem(it.id, { locked: !it.locked }, true);
  },
  toggleHidden: (id) => {
    const it = get().page()?.items.find((x) => x.id === id);
    if (!it) return;
    get().patchItem(id, { hidden: !it.hidden }, true);
  },
  reorderLayer: (from, to) => {
    get().touchPage((page) => {
      const [moved] = page.items.splice(from, 1);
      if (!moved) return;
      page.items.splice(to, 0, moved);
    });
  },
  addPage: () => {
    const p = get().project;
    if (!p) return;
    get().snapHistory();
    const last = p.pages[p.pages.length - 1];
    const page = newPage(`صفحه ${p.pages.length + 1}`, last?.w ?? 1024, last?.h ?? 1536);
    applyLayout(page, "2v");
    p.pages.push(page);
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      pageIndex: p.pages.length - 1,
      selectedId: null,
      dirty: true,
      saveStatus: "unsaved",
      sheet: null
    });
    scheduleSave(get);
  },
  duplicatePage: () => {
    const p = get().project;
    const page = get().page();
    if (!p || !page) return;
    get().snapHistory();
    const copy = clonePage(page);
    p.pages.splice(get().pageIndex + 1, 0, copy);
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      pageIndex: get().pageIndex + 1,
      selectedId: null,
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  deletePage: () => {
    const p = get().project;
    if (!p || !p.pages.length) return;
    get().snapHistory();
    if (p.pages.length === 1) {
      const blank = newPage("صفحه ۱", p.pages[0].w, p.pages[0].h);
      applyLayout(blank, "2v");
      p.pages = [blank];
      set({
        project: {
          ...p,
          pages: [...p.pages]
        },
        pageIndex: 0,
        selectedId: null,
        dirty: true,
        saveStatus: "unsaved"
      });
      scheduleSave(get);
      return;
    }
    p.pages.splice(get().pageIndex, 1);
    const idx = p.pages.length ? clamp(get().pageIndex, 0, p.pages.length - 1) : -1;
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      pageIndex: idx,
      selectedId: null,
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  goPage: (i) => {
    const p = get().project;
    if (!p || !p.pages.length) return;
    set({
      pageIndex: clamp(i, 0, p.pages.length - 1),
      selectedId: null,
      liveGen: get().liveGen + 1
    });
  },
  movePage: (from, to) => {
    const p = get().project;
    if (!p) return;
    if (to < 0 || to >= p.pages.length) return;
    get().snapHistory();
    const [pg] = p.pages.splice(from, 1);
    p.pages.splice(to, 0, pg);
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      pageIndex: to,
      dirty: true,
      saveStatus: "unsaved"
    });
    scheduleSave(get);
  },
  renamePage: (name) => {
    get().touchPage((page) => {
      page.name = name.slice(0, 40);
    }, false);
  },
  setPageSize: (w, h) => {
    get().touchPage((page) => {
      const sx = w / page.w;
      const sy = h / page.h;
      page.w = w;
      page.h = h;
      page.items.forEach((it) => {
        it.x *= sx;
        it.y *= sy;
        it.w *= sx;
        it.h *= sy;
        if (it.type === "bubble") {
          it.tx *= sx;
          it.ty *= sy;
        }
        if (it.type === "drawing") it.points = it.points.map((pt) => ({
          x: pt.x * sx,
          y: pt.y * sy
        }));
      });
    });
  },
  setBgColor: (color) => {
    get().touchPage((page) => {
      page.background.color = color;
    }, false);
  },
  applyLayoutKey: (key) => {
    const page = get().page();
    if (!page) return;
    const framed = page.items.filter((i) => (i.type === "image" || i.type === "video") && !i.free);
    const cells = layoutCount(key);
    if (cells && framed.length > cells) {
      toast.error("این چیدمان قاب کمتری دارد؛ اول رسانه‌های اضافه را بردار.");
      return;
    }
    get().touchPage((pg) => {
      if (!applyLayout(pg, key)) toast.message("برای عوض کردن قالب، قفل قاب‌ها را باز کن");
    });
    set({
      selectedId: null,
      sheet: null
    });
  },
  addPanel: (extra) => {
    let nid = "";
    get().touchPage((pg) => {
      nid = addPanelToPage(pg, extra).id;
    });
    if (nid) set({
      selectedId: nid,
      inspectorTab: "props",
      sheet: extra?.x != null || extra?.kind ? get().sheet : null,
      tool: extra?.x != null ? get().tool : "select"
    });
    if (extra?.x == null) toast.success("قاب تازه روی همین صفحه");
  },
  setAmbientThrough: (endPageIndex) => {
    const p = get().project;
    if (!p) return;
    const span = musicSpan(p);
    if (!span) return;
    const clip = p.pages[span.start]?.playback.ambientAudio;
    if (!clip) return;
    const v = throughPageValue(span.start, endPageIndex, p.pages.length);
    clip.throughPage = v;
    clip.continuePages = v === -1;
    p.updatedAt = Date.now();
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      dirty: true,
      saveStatus: "unsaved",
      liveGen: get().liveGen + 1
    });
    scheduleSave(get);
  },
  clearAmbient: () => {
    const p = get().project;
    if (!p) return;
    const span = musicSpan(p);
    if (!span) return;
    const page = p.pages[span.start];
    if (page) page.playback.ambientAudio = null;
    p.updatedAt = Date.now();
    set({
      project: {
        ...p,
        pages: [...p.pages]
      },
      dirty: true,
      saveStatus: "unsaved",
      liveGen: get().liveGen + 1
    });
    scheduleSave(get);
  },

  scaleSelectedMedia: (factor) => {
    const it = get().selected();
    if (!it || (it.type !== "image" && it.type !== "video")) return;
    get().touchPage((pg) => {
      const item = pg.items.find((x) => x.id === it.id);
      if (!item || (item.type !== "image" && item.type !== "video")) return;
      if (isFramedMedia(item)) bumpMediaZoom(item, factor);
      else scaleFromCenter(item, factor, pg);
    }, false);
  },
  toggleMediaFree: () => {
    const it = get().selected();
    if (!it || (it.type !== "image" && it.type !== "video")) return;
    get().touchPage((pg) => {
      const item = pg.items.find((x) => x.id === it.id);
      if (!item || (item.type !== "image" && item.type !== "video")) return;
      if (item.free || !item.panelId) {
        const panel = panelAt(pg, item.x + item.w / 2, item.y + item.h / 2);
        if (panel) {
          attachMediaToPanel(pg, item, panel);
          toast.success("چسبید به قاب");
        } else toast.message("قابی نزدیک این رسانه نیست");
      } else {
        item.free = true;
        delete item.panelId;
        scaleFromCenter(item, 0.86, pg);
        toast.success("جدا شد — گوشه‌ها را بکش تا کوچک و بزرگ شود");
      }
    });
  },
  importFiles: async (files, opts = {}) => {
    if (!get().page() && opts.target !== "audio") {
      toast.error("اول یک صفحه بساز");
      return;
    }
    const imported: { meta: AssetRecord; kind: AssetKind }[] = [];
    for (const file of files) {
        const kind = kindOf(file);
        if (!kind) {
          toast.message(`این فایل پشتیبانی نمی‌شود: ${file.name}`);
          continue;
        }
        const rec: AssetRecord = {
          id: uid("a"),
          kind,
          name: file.name,
          mime: file.type || "application/octet-stream",
          size: file.size,
          createdAt: Date.now(),
          blob: file
        };
        adoptBlobUrl(rec.id, file);
        imported.push({
          meta: rec,
          kind
        });
        (async () => {
          try {
            const probe = await probeMedia(file, kind);
            rec.width = probe.width;
            rec.height = probe.height;
            rec.duration = probe.duration;
            rec.thumb = await makeThumb(file, kind).catch(() => undefined);
            await putAsset(rec);
            const p = get().project;
            if (p && rec.duration) {
              for (const pg of p.pages) for (const it of pg.items) if (it.type === "video" && it.assetId === rec.id) {
                it.duration = rec.duration || 0;
                if (!it.trimEnd) it.trimEnd = rec.duration || 0;
                it.sourceRatio = (rec.width || 16) / Math.max(1, rec.height || 9);
              }
              set({
                project: {
                  ...p,
                  pages: [...p.pages]
                },
                mediaTick: Date.now()
              });
            }
            get().refreshLibrary();
          } catch (e) {
            console.error(e);
          }
        })();
      }
      if (!imported.length) return;
      const target = opts.target || "page";
      if (target === "bg") {
        const img = imported.find((i) => i.kind === "image");
        if (img) {
          get().touchPage((pg) => {
            pg.background.assetId = img.meta.id;
            pg.background.zoom = 1;
            pg.background.x = 0;
            pg.background.y = 0;
          });
          loadImageAsset(img.meta.id, () => set({ mediaTick: Date.now() }));
        }
        return;
      }
      if (target === "audio") {
        const aud = imported.find((i) => i.kind === "audio");
        if (aud) get().touchPage((pg) => {
          pg.playback.ambientAudio = {
            ...newAudio(aud.meta.id, .35),
            continuePages: false,
            throughPage: 0
          };
        });
        toast.success("موسیقی گذاشته شد — خط راست را بکش تا بگی تا کجا پخش شود");
        return;
      }
      if (target === "panel-audio") {
        const aud = imported.find((i) => i.kind === "audio");
        const sel = get().selected();
        if (aud && sel && (sel.type === "panel" || sel.type === "image" || sel.type === "video")) get().touchPage((pg) => {
          const it = pg.items.find((x) => x.id === sel.id);
          if (it && (it.type === "panel" || it.type === "image" || it.type === "video")) {
            it.story = it.story || {
              order: 1,
              reveal: "click",
              delayMs: 1e3,
              audio: null
            };
            it.story.audio = newAudio(aud.meta.id, 1);
          }
        });
        return;
      }
      let lastId = "";
      get().touchPage((pg) => {
        for (const item of imported) {
          if (item.kind === "audio") {
            pg.playback.ambientAudio = newAudio(item.meta.id, .35);
            continue;
          }
          if (opts.replaceId) {
            const existing = pg.items.find((x) => x.id === opts.replaceId);
            if (existing && (existing.type === "image" || existing.type === "video")) {
              existing.assetId = item.meta.id;
              lastId = existing.id;
              continue;
            }
          }
          const selectedNow = get().selected();
          const panel = target === "free" ? null : (opts.panelId && pg.items.find((x) => x.id === opts.panelId && x.type === "panel")) || (selectedNow?.type === "panel" ? pg.items.find((x) => x.id === selectedNow.id && x.type === "panel") : null) || (selectedNow && (selectedNow.type === "image" || selectedNow.type === "video") && selectedNow.panelId && !selectedNow.free ? pg.items.find((x) => x.id === selectedNow.panelId && x.type === "panel") : null) || (target === "panel" ? panelAt(pg, pg.w / 2, pg.h / 2) : null);
          if (item.kind === "image") {
            const img = newImage(pg, item.meta.id, { sourceRatio: (item.meta.width || 1) / Math.max(1, item.meta.height || 1) });
            if (panel && panel.type === "panel") attachMediaToPanel(pg, img, panel);
            else placeFreeMedia(pg, img);
            insertItem(pg, img);
            lastId = img.id;
            loadImageAsset(item.meta.id, () => set({ mediaTick: Date.now() }));
          }
          if (item.kind === "video") {
            const vid = newVideo(pg, item.meta.id, {
              duration: item.meta.duration || 0,
              trimEnd: item.meta.duration || 0,
              sourceRatio: (item.meta.width || 16) / Math.max(1, item.meta.height || 9),
              aspectLock: false
            });
            if (panel && panel.type === "panel") attachMediaToPanel(pg, vid, panel);
            else placeFreeMedia(pg, vid);
            insertItem(pg, vid);
            lastId = vid.id;
            loadVideoAsset(item.meta.id, () => set({ mediaTick: Date.now() }));
          }
        }
      });
      if (lastId) set({
        selectedId: lastId,
        inspectorTab: "props",
        tool: "select"
      });
      toast.success("به صفحه اضافه شد");
  },
  addBubble: (kind = "round") => {
    let nid = "";
    get().touchPage((pg) => {
      const b = newBubble(pg, kind);
      const panel = get().selected()?.type === "panel" ? get().selected() : panelAt(pg, b.x + b.w / 2, b.y + b.h / 2);
      if (panel && panel.type === "panel") {
        b.panelId = panel.id;
        b.x = panel.x + panel.w * .12;
        b.y = panel.y + panel.h * .08;
        b.w = panel.w * .76;
        b.h = Math.min(panel.h * .38, pg.h * .18);
        b.tx = b.x + b.w * .25;
        b.ty = b.y + b.h + 70;
      }
      insertItem(pg, b);
      nid = b.id;
    });
    if (nid) set({
      selectedId: nid,
      inspectorTab: "props",
      wantEdit: nid,
      sheet: null,
      tool: "select"
    });
  },
  addText: () => {
    let nid = "";
    get().touchPage((pg) => {
      const t = newText(pg);
      insertItem(pg, t);
      nid = t.id;
    });
    if (nid) set({
      selectedId: nid,
      inspectorTab: "props",
      wantEdit: nid,
      sheet: null,
      tool: "select"
    });
  },
  addShape: (kind) => {
    let nid = "";
    get().touchPage((pg) => {
      const s = newShape(pg, kind);
      insertItem(pg, s);
      nid = s.id;
    });
    if (nid) set({
      selectedId: nid,
      inspectorTab: "props",
      sheet: null,
      tool: "select"
    });
  },
  startDrawing: () => {
    if (!get().page()) return null;
    const d = newDrawing({
      color: get().drawColor,
      width: get().drawWidth
    });
    get().touchPage((pg) => insertItem(pg, d));
    set({
      selectedId: d.id,
      tool: "draw"
    });
    return d;
  },
  fillEmptyPanels: (assetIds) => {
    get().touchPage((pg) => {
      const panels = pg.items.filter((i) => i.type === "panel");
      const used = new Set(pg.items.filter((i) => (i.type === "image" || i.type === "video") && i.panelId).map((i) => i.panelId));
      let ai = 0;
      for (const panel of panels) {
        if (used.has(panel.id) || ai >= assetIds.length) continue;
        const img = newImage(pg, assetIds[ai++]);
        attachMediaToPanel(pg, img, panel);
        insertItem(pg, img);
      }
    });
  },
  placeAsset: (assetId) => {
    const a = get().assets.find((x) => x.id === assetId);
    if (!a) {
      toast.error("این فایل در کتابخانه نیست");
      return;
    }
    if (a.kind === "audio") {
      const sel = get().selected();
      if (sel && (sel.type === "panel" || sel.type === "image" || sel.type === "video")) {
        get().touchPage((pg) => {
          const it = pg.items.find((x) => x.id === sel.id);
          if (it && (it.type === "panel" || it.type === "image" || it.type === "video")) {
            it.story = it.story || {
              order: 1,
              reveal: "click",
              delayMs: 1e3,
              audio: null
            };
            it.story.audio = newAudio(a.id, 1);
          }
        });
        toast.success("صدا به قاب اضافه شد");
        return;
      }
      get().touchPage((pg) => {
        pg.playback.ambientAudio = {
          ...newAudio(a.id, .35),
          continuePages: false
        };
      });
      toast.success("موسیقی صفحه گذاشته شد");
      return;
    }
    if (a.kind !== "image" && a.kind !== "video") return;
    let nid = "";
    get().touchPage((pg) => {
      const sel = get().selected();
      const ratio = (a.width || (a.kind === "video" ? 16 : 1)) / Math.max(1, a.height || (a.kind === "video" ? 9 : 1));
      if (sel && (sel.type === "image" || sel.type === "video") && sel.type === a.kind) {
        const existing = pg.items.find((x) => x.id === sel.id);
        if (existing && (existing.type === "image" || existing.type === "video")) {
          existing.assetId = a.id;
          existing.sourceRatio = ratio;
          if (existing.type === "video") {
            existing.duration = a.duration || 0;
            existing.trimStart = 0;
            existing.trimEnd = a.duration || 0;
          }
          nid = existing.id;
          return;
        }
      }
      const panel = (sel?.type === "panel" ? pg.items.find((x) => x.id === sel.id && x.type === "panel") : null) || (sel?.panelId ? pg.items.find((x) => x.id === sel.panelId && x.type === "panel") : null) || panelAt(pg, pg.w / 2, pg.h / 2);
      if (panel && panel.type === "panel") {
        const framed = pg.items.find((i) => i.panelId === panel.id && (i.type === "image" || i.type === "video") && !i.free);
        if (framed) pg.items = pg.items.filter((x) => x.id !== framed.id);
      }
      if (a.kind === "image") {
        const img = newImage(pg, a.id, { sourceRatio: ratio });
        if (panel && panel.type === "panel") attachMediaToPanel(pg, img, panel);
        else img.free = true;
        insertItem(pg, img);
        nid = img.id;
      } else {
        const vid = newVideo(pg, a.id, {
          duration: a.duration || 0,
          trimEnd: a.duration || 0,
          sourceRatio: ratio
        });
        if (panel && panel.type === "panel") attachMediaToPanel(pg, vid, panel);
        else vid.free = true;
        insertItem(pg, vid);
        nid = vid.id;
      }
    });
    if (nid) set({
      selectedId: nid,
      inspectorTab: "props",
      tool: "select"
    });
    toast.success("به صفحه اضافه شد");
  },
  saveNow: async () => {
    const p = get().project;
    if (!p) return;
    set({ saveStatus: "saving" });
    p.updatedAt = Date.now();
    p.coverAssetId = p.coverAssetId || p.pages[0]?.items.find((i) => i.type === "image")?.assetId || p.pages[0]?.background.assetId;
    try {
      await indexedDbComics.save(p);
      persistSession(p, true);
      set({
        dirty: false,
        saveStatus: "saved",
        persistError: false,
        project: { ...p }
      });
      await get().refreshLibrary();
    } catch (e) {
      set({
        saveStatus: "unsaved",
        persistError: true
      });
      toast.error("ذخیره نشد — می‌توانی پرونده را خروجی بگیری");
      console.error(e);
      throw e;
    }
  }
}));

export function currentMediaUrl(id?: string) {
  if (!id) return "";
  return mediaUrl(id);
}
