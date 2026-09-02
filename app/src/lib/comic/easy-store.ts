import { create } from "zustand";
import { saveProject } from "./db";
import {
  addShotBubble,
  buildEasyProject,
  cellsPerPage,
  newShot,
  planPages,
  setShotRatio,
  shotImage,
  type EasyMusic,
  type EasyPagePlan,
  type EasyShot,
} from "./easy";
import { PAGE_SIZES } from "./types";
import type {
  BubbleItem,
  BubbleKind,
  ComicProject,
  ImageAdjust,
  PanelKind,
  ReadingDirection,
} from "./types";

function pageSizeById(id: string) {
  return PAGE_SIZES.find((s) => s.id === id) ?? PAGE_SIZES[0];
}

export type EasyStep = "pick" | "edit" | "layout" | "preview";

export const EASY_STEPS: { id: EasyStep; label: string }[] = [
  { id: "pick", label: "عکس‌ها" },
  { id: "edit", label: "ویرایش تکی" },
  { id: "layout", label: "پنل و موسیقی" },
  { id: "preview", label: "پیش‌نمایش" },
];

const SESSION_KEY = "kader.easy.v1";

const DEFAULT_PLAN: EasyPagePlan = { layoutKey: "4", panelKind: "rect" };

interface Persisted {
  title: string;
  sizeId: string;
  direction: ReadingDirection;
  shots: EasyShot[];
  perPage: boolean;
  globalPlan: EasyPagePlan;
  plans: EasyPagePlan[];
  music: EasyMusic | null;
  projectId: string | null;
  step: EasyStep;
}

export interface EasyState extends Persisted {
  activeShotId: string | null;
  selectedBubbleId: string | null;
  /** Bumped whenever a frame is mutated in place, to re-render canvases. */
  tick: number;
  built: ComicProject | null;

  reset: () => void;
  restore: () => void;
  setStep: (s: EasyStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  setTitle: (t: string) => void;
  setSize: (id: string) => void;
  setDirection: (d: ReadingDirection) => void;

  addShot: (assetId: string, name: string, sourceRatio: number) => void;
  removeShot: (id: string) => void;
  moveShot: (id: string, delta: number) => void;
  setActiveShot: (id: string) => void;
  activeShot: () => EasyShot | null;

  setRatio: (ratioId: string) => void;
  patchImage: (
    patch: Partial<{
      zoom: number;
      cropX: number;
      cropY: number;
      flipX: boolean;
      flipY: boolean;
      fitMode: "fit" | "fill";
      rot: number;
    }>,
  ) => void;
  setAdjust: (patch: Partial<ImageAdjust>) => void;
  touchFrame: () => void;

  addBubble: (kind: BubbleKind) => void;
  selectBubble: (id: string | null) => void;
  patchBubble: (id: string, patch: Partial<BubbleItem>) => void;
  removeBubble: (id: string) => void;

  setPerPage: (v: boolean) => void;
  setGlobalPlan: (patch: Partial<EasyPagePlan>) => void;
  setPagePlan: (index: number, patch: Partial<EasyPagePlan>) => void;
  pagePlans: () => EasyPagePlan[];
  shotsOfPage: (index: number) => EasyShot[];

  setMusic: (music: EasyMusic | null) => void;
  patchMusic: (patch: Partial<EasyMusic>) => void;

  build: () => ComicProject;
  save: () => Promise<ComicProject>;
}

function persist(state: EasyState) {
  if (typeof sessionStorage === "undefined") return;
  const data: Persisted = {
    title: state.title,
    sizeId: state.sizeId,
    direction: state.direction,
    shots: state.shots,
    perPage: state.perPage,
    globalPlan: state.globalPlan,
    plans: state.plans,
    music: state.music,
    projectId: state.projectId,
    step: state.step,
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  } catch {
    /* a full or blocked store just means this session is not resumable */
  }
}

export const useEasy = create<EasyState>((set, get) => {
  /** Every mutation goes through here: it re-renders, then saves the session. */
  const commit = (patch: Partial<EasyState> = {}) => {
    set({ ...patch, tick: Date.now() } as Partial<EasyState>);
    persist(get());
  };

  return {
    step: "pick",
    title: "",
    sizeId: "webtoon",
    direction: "rtl",
    shots: [],
    perPage: false,
    globalPlan: { ...DEFAULT_PLAN },
    plans: [],
    music: null,
    projectId: null,
    activeShotId: null,
    selectedBubbleId: null,
    tick: 0,
    built: null,

    reset: () => {
      set({
        step: "pick",
        title: "",
        sizeId: "webtoon",
        direction: "rtl",
        shots: [],
        perPage: false,
        globalPlan: { ...DEFAULT_PLAN },
        plans: [],
        music: null,
        projectId: null,
        activeShotId: null,
        selectedBubbleId: null,
        built: null,
        tick: Date.now(),
      });
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        /* nothing to clean up */
      }
    },

    restore: () => {
      if (typeof sessionStorage === "undefined") return;
      try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const data = JSON.parse(raw) as Persisted;
        if (!Array.isArray(data.shots)) return;
        set({
          ...data,
          activeShotId: data.shots[0]?.id ?? null,
          selectedBubbleId: null,
          tick: Date.now(),
        });
      } catch {
        /* corrupt session — start clean rather than half-restored */
      }
    },

    setStep: (s) => commit({ step: s }),
    nextStep: () => {
      const order = EASY_STEPS.map((s) => s.id);
      const i = order.indexOf(get().step);
      commit({ step: order[Math.min(order.length - 1, i + 1)] });
    },
    prevStep: () => {
      const order = EASY_STEPS.map((s) => s.id);
      const i = order.indexOf(get().step);
      commit({ step: order[Math.max(0, i - 1)] });
    },

    setTitle: (t) => commit({ title: t }),
    setSize: (id) => commit({ sizeId: id }),
    setDirection: (d) => commit({ direction: d }),

    addShot: (assetId, name, sourceRatio) => {
      const shot = newShot(assetId, name, sourceRatio);
      const shots = [...get().shots, shot];
      commit({ shots, activeShotId: get().activeShotId ?? shot.id });
    },
    removeShot: (id) => {
      const shots = get().shots.filter((s) => s.id !== id);
      commit({
        shots,
        activeShotId: get().activeShotId === id ? (shots[0]?.id ?? null) : get().activeShotId,
      });
    },
    moveShot: (id, delta) => {
      const shots = [...get().shots];
      const i = shots.findIndex((s) => s.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= shots.length) return;
      [shots[i], shots[j]] = [shots[j], shots[i]];
      commit({ shots });
    },
    setActiveShot: (id) => commit({ activeShotId: id, selectedBubbleId: null }),
    activeShot: () => {
      const { shots, activeShotId } = get();
      return shots.find((s) => s.id === activeShotId) ?? shots[0] ?? null;
    },

    setRatio: (ratioId) => {
      const shot = get().activeShot();
      if (!shot) return;
      setShotRatio(shot, ratioId);
      commit({ shots: [...get().shots] });
    },
    patchImage: (patch) => {
      const shot = get().activeShot();
      const img = shot ? shotImage(shot) : null;
      if (!img) return;
      Object.assign(img, patch);
      commit({ shots: [...get().shots] });
    },
    setAdjust: (patch) => {
      const shot = get().activeShot();
      const img = shot ? shotImage(shot) : null;
      if (!img) return;
      img.adjust = {
        brightness: 1,
        contrast: 1,
        saturate: 1,
        warmth: 0,
        ...img.adjust,
        ...patch,
      };
      commit({ shots: [...get().shots] });
    },
    touchFrame: () => commit({ shots: [...get().shots] }),

    addBubble: (kind) => {
      const shot = get().activeShot();
      if (!shot) return;
      const bubble = addShotBubble(shot, kind);
      commit({ shots: [...get().shots], selectedBubbleId: bubble.id });
    },
    selectBubble: (id) => set({ selectedBubbleId: id }),
    patchBubble: (id, patch) => {
      const shot = get().activeShot();
      if (!shot) return;
      const b = shot.frame.items.find((i) => i.id === id);
      if (!b || b.type !== "bubble") return;
      Object.assign(b, patch);
      commit({ shots: [...get().shots] });
    },
    removeBubble: (id) => {
      const shot = get().activeShot();
      if (!shot) return;
      shot.frame.items = shot.frame.items.filter((i) => i.id !== id);
      commit({ shots: [...get().shots], selectedBubbleId: null });
    },

    setPerPage: (v) => commit({ perPage: v }),
    setGlobalPlan: (patch) => {
      const globalPlan = { ...get().globalPlan, ...patch };
      commit({ globalPlan, plans: get().plans.map((p) => ({ ...p, ...patch })) });
    },
    setPagePlan: (index, patch) => {
      const plans = [...get().pagePlans()];
      plans[index] = { ...plans[index], ...patch };
      commit({ plans, perPage: true });
    },
    pagePlans: () => {
      const { shots, plans, globalPlan, perPage } = get();
      const base = perPage ? plans : [];
      const pages = planPages(shots.length, base, globalPlan);
      return pages.map((p) => ({ ...p }));
    },
    shotsOfPage: (index) => {
      const plans = get().pagePlans();
      let cursor = 0;
      for (let i = 0; i < plans.length; i++) {
        const count = cellsPerPage(plans[i]);
        if (i === index) return get().shots.slice(cursor, cursor + count);
        cursor += count;
      }
      return [];
    },

    setMusic: (music) => commit({ music }),
    patchMusic: (patch) => {
      const music = get().music;
      if (!music) return;
      commit({ music: { ...music, ...patch } });
    },

    build: () => {
      const s = get();
      const size = pageSizeById(s.sizeId);
      const project = buildEasyProject({
        title: s.title,
        direction: s.direction,
        pageW: size.w,
        pageH: size.h,
        shots: s.shots,
        plans: s.pagePlans(),
        fallbackPlan: s.globalPlan,
        music: s.music,
        projectId: s.projectId ?? undefined,
      });
      set({ built: project, projectId: project.id });
      persist(get());
      return project;
    },

    save: async () => {
      const project = get().build();
      await saveProject(project);
      persist(get());
      return project;
    },
  };
});

export type { EasyMusic, EasyPagePlan, EasyShot, PanelKind };
