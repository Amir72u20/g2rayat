import type { ReadingDirection } from "./types";
import { PAGE_SIZES } from "./types";

const KEY = "kader.prefs.v1";

export interface StudioPrefs {
  snap: boolean;
  defaultDirection: ReadingDirection;
  defaultSize: string;
}

export const DEFAULT_PREFS: StudioPrefs = {
  snap: true,
  defaultDirection: "rtl",
  defaultSize: "webtoon",
};

export function loadPrefs(): StudioPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PREFS };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<StudioPrefs>;
    return {
      snap: parsed.snap !== false,
      defaultDirection: parsed.defaultDirection === "ltr" ? "ltr" : "rtl",
      defaultSize: PAGE_SIZES.some((s) => s.id === parsed.defaultSize) ? parsed.defaultSize! : DEFAULT_PREFS.defaultSize,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(next: StudioPrefs) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}
