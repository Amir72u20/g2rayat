export type ItemType = "panel" | "image" | "video" | "bubble" | "text" | "shape" | "drawing";

export type BubbleKind = "round" | "rect" | "think" | "shout" | "caption" | "whisper" | "none";

export type ShapeKind = "rect" | "round" | "circle" | "line" | "arrow";

export type PanelKind =
  | "rect"
  | "round"
  | "circle"
  | "tri"
  | "tri-down"
  | "diamond"
  | "hex"
  | "slash-l"
  | "slash-r"
  | "slash-tl"
  | "slash-br"
  | "arch"
  | "trap"
  | "burst"
  | "notch";

export type RevealMode = "click" | "auto";

export type ReadingDirection = "rtl" | "ltr";

export type FitMode = "fill" | "fit";

export type InspectorTab = "props" | "pages" | "layers" | "export";

export type StudioSheet =
  "add" | "pages" | "layers" | "style" | "draw" | "bubble" | "media" | "audio";

export type EditorTool = "select" | "draw" | "pan" | "panel";

export interface AudioClip {
  assetId: string;
  start: number;
  end: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  /** Playback rate, 1 = original. */
  speed?: number;
  /** Low-shelf gain in dB, -12…+12. */
  bass?: number;
  /** High-shelf gain in dB, -12…+12. */
  treble?: number;
  continuePages?: boolean;
  /** 1-based page number to keep playing through; -1 = rest of comic; 0/omit = this page only */
  throughPage?: number;
}

export interface PanelStory {
  order: number;
  reveal: RevealMode;
  delayMs: number;
  audio: AudioClip | null;
}

export interface BubbleTiming {
  enabled: boolean;
  startMs: number;
  endMs: number;
}

export interface BaseItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden?: boolean;
  locked?: boolean;
  name?: string;
  panelId?: string;
  free?: boolean;
  rot?: number;
  opacity?: number;
}

export interface PanelItem extends BaseItem {
  type: "panel";
  kind?: PanelKind;
  fill: string;
  stroke: number;
  strokeColor: string;
  radius: number;
  story: PanelStory;
}

/** Per-image colour grade, applied by the renderer as a canvas filter. */
export interface ImageAdjust {
  /** 1 = untouched for the first three. */
  brightness: number;
  contrast: number;
  saturate: number;
  /** -1 (cool) … 1 (warm). */
  warmth: number;
}

export const NEUTRAL_ADJUST: ImageAdjust = {
  brightness: 1,
  contrast: 1,
  saturate: 1,
  warmth: 0,
};

export interface ImageItem extends BaseItem {
  type: "image";
  adjust?: ImageAdjust;
  assetId: string;
  zoom: number;
  cropX: number;
  cropY: number;
  fitMode: FitMode;
  flipX?: boolean;
  flipY?: boolean;
  radius: number;
  stroke: number;
  strokeColor: string;
  aspectLock: boolean;
  sourceRatio: number;
  story?: PanelStory;
}

export interface VideoItem extends BaseItem {
  type: "video";
  adjust?: ImageAdjust;
  assetId: string;
  posterAssetId?: string;
  zoom: number;
  cropX: number;
  cropY: number;
  fitMode: FitMode;
  flipX?: boolean;
  flipY?: boolean;
  radius: number;
  stroke: number;
  strokeColor: string;
  aspectLock: boolean;
  sourceRatio: number;
  trimStart: number;
  trimEnd: number;
  duration: number;
  speed: number;
  volume: number;
  muted: boolean;
  story?: PanelStory;
}

export interface BubbleItem extends BaseItem {
  type: "bubble";
  kind: BubbleKind;
  text: string;
  font: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  align: "right" | "center" | "left";
  color: string;
  fill: string;
  stroke: number;
  strokeColor: string;
  radius: number;
  tail: number;
  tx: number;
  ty: number;
  alpha: number;
  track?: number;
  lead?: number;
  outline?: boolean;
  outlineColor?: string;
  outlineW?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowW?: number;
  direction?: "rtl" | "ltr";
  timing: BubbleTiming;
}

export interface TextItem extends BaseItem {
  type: "text";
  text: string;
  font: number;
  fontFamily: string;
  bold?: boolean;
  italic?: boolean;
  align: "right" | "center" | "left";
  color: string;
  track?: number;
  lead?: number;
  outline?: boolean;
  outlineColor?: string;
  outlineW?: number;
  shadow?: boolean;
  shadowColor?: string;
  shadowW?: number;
  textBg?: boolean;
  textBgColor?: string;
  direction?: "rtl" | "ltr";
}

export interface ShapeItem extends BaseItem {
  type: "shape";
  kind: ShapeKind;
  fill: string;
  stroke: number;
  strokeColor: string;
  radius: number;
}

export interface DrawingItem extends BaseItem {
  type: "drawing";
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export type ComicItem =
  PanelItem | ImageItem | VideoItem | BubbleItem | TextItem | ShapeItem | DrawingItem;

export interface PageBackground {
  color: string;
  assetId: string;
  zoom: number;
  x: number;
  y: number;
  locked: boolean;
}

export interface PagePlayback {
  directorLock: boolean;
  defaultDelayMs: number;
  defaultReveal: RevealMode;
  ambientAudio: AudioClip | null;
}

export interface ComicPage {
  id: string;
  name: string;
  w: number;
  h: number;
  items: ComicItem[];
  background: PageBackground;
  playback: PagePlayback;
}

export interface ComicProject {
  id: string;
  title: string;
  description: string;
  coverAssetId?: string;
  readingDirection: ReadingDirection;
  sourceLanguage: string;
  translations: Record<string, Record<string, string>>;
  pages: ComicPage[];
  createdAt: number;
  updatedAt: number;
  documentVersion?: number;
}

export interface ProjectMeta {
  id: string;
  title: string;
  description: string;
  coverAssetId?: string;
  pageCount: number;
  updatedAt: number;
  createdAt: number;
  sample?: boolean;
}

export type AssetKind = "image" | "video" | "audio";

export interface AssetMeta {
  id: string;
  kind: AssetKind;
  name: string;
  mime: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: number;
}

export const PAGE_SIZES = [
  { id: "webtoon", label: "موبایل", w: 800, h: 1600 },
  { id: "portrait", label: "عمودی", w: 1024, h: 1536 },
  { id: "landscape", label: "افقی", w: 1536, h: 1024 },
  { id: "square", label: "مربع", w: 1024, h: 1024 },
  { id: "a4", label: "A4", w: 1240, h: 1754 },
] as const;

export const LANGUAGES = [
  ["fa", "فارسی"],
  ["en", "English"],
  ["ar", "العربية"],
  ["tr", "Türkçe"],
  ["fr", "Français"],
  ["de", "Deutsch"],
  ["es", "Español"],
  ["ja", "日本語"],
  ["ko", "한국어"],
  ["zh", "中文"],
] as const;

export const DOCUMENT_VERSION = 1;
export const PACKAGE_FORMAT = "kader.comicstudio";
