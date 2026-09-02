import type { PanelKind } from "./types";

export interface LayoutCell {
  x: number;
  y: number;
  w: number;
  h: number;
  kind?: PanelKind;
}

export interface PanelLayout {
  k: string;
  n: string;
  cells: LayoutCell[];
}

export const PANEL_LAYOUTS: PanelLayout[] = [
  { k: "1", n: "تک‌قاب", cells: [{ x: 0, y: 0, w: 1, h: 1 }] },
  {
    k: "2v",
    n: "دو افقی",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    k: "2h",
    n: "دو عمودی",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    k: "3v",
    n: "سه افقی",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.333 },
      { x: 0, y: 0.333, w: 1, h: 0.334 },
      { x: 0, y: 0.667, w: 1, h: 0.333 },
    ],
  },
  {
    k: "3h",
    n: "سه عمودی",
    cells: [
      { x: 0, y: 0, w: 0.333, h: 1 },
      { x: 0.333, y: 0, w: 0.334, h: 1 },
      { x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    k: "4",
    n: "چهارتایی",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    k: "1+2",
    n: "یک و دو",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.52 },
      { x: 0, y: 0.52, w: 0.5, h: 0.48 },
      { x: 0.5, y: 0.52, w: 0.5, h: 0.48 },
    ],
  },
  {
    k: "2+1",
    n: "دو و یک",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.46 },
      { x: 0.5, y: 0, w: 0.5, h: 0.46 },
      { x: 0, y: 0.46, w: 1, h: 0.54 },
    ],
  },
  {
    k: "wide+stack",
    n: "عریض و پشته",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.36 },
      { x: 0, y: 0.36, w: 1, h: 0.32 },
      { x: 0, y: 0.68, w: 1, h: 0.32 },
    ],
  },
  {
    k: "inset",
    n: "قاب توکار",
    cells: [
      { x: 0, y: 0, w: 1, h: 1 },
      { x: 0.52, y: 0.08, w: 0.4, h: 0.3 },
    ],
  },
  {
    k: "6",
    n: "شش‌تایی",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.333 },
      { x: 0.5, y: 0, w: 0.5, h: 0.333 },
      { x: 0, y: 0.333, w: 0.5, h: 0.334 },
      { x: 0.5, y: 0.333, w: 0.5, h: 0.334 },
      { x: 0, y: 0.667, w: 0.5, h: 0.333 },
      { x: 0.5, y: 0.667, w: 0.5, h: 0.333 },
    ],
  },
  {
    k: "manga",
    n: "مانگا",
    cells: [
      { x: 0, y: 0, w: 0.62, h: 0.4 },
      { x: 0.62, y: 0, w: 0.38, h: 0.4 },
      { x: 0, y: 0.4, w: 1, h: 0.28 },
      { x: 0, y: 0.68, w: 0.38, h: 0.32 },
      { x: 0.38, y: 0.68, w: 0.62, h: 0.32 },
    ],
  },
  {
    k: "diag",
    n: "برش مورب",
    cells: [
      { x: 0, y: 0, w: 1, h: 1, kind: "slash-l" },
      { x: 0, y: 0, w: 1, h: 1, kind: "slash-r" },
    ],
  },
  {
    k: "diag2",
    n: "مورب وارونه",
    cells: [
      { x: 0, y: 0, w: 1, h: 1, kind: "slash-tl" },
      { x: 0, y: 0, w: 1, h: 1, kind: "slash-br" },
    ],
  },
  {
    k: "tri-pair",
    n: "دو مثلث",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5, kind: "tri" },
      { x: 0, y: 0.5, w: 1, h: 0.5, kind: "tri-down" },
    ],
  },
  {
    k: "cinematic",
    n: "سینمایی",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.28 },
      { x: 0, y: 0.28, w: 0.5, h: 0.36 },
      { x: 0.5, y: 0.28, w: 0.5, h: 0.36 },
      { x: 0, y: 0.64, w: 1, h: 0.36 },
    ],
  },
  {
    k: "offset",
    n: "پله‌ای",
    cells: [
      { x: 0, y: 0, w: 0.7, h: 0.34 },
      { x: 0.3, y: 0.34, w: 0.7, h: 0.32 },
      { x: 0, y: 0.66, w: 0.7, h: 0.34 },
    ],
  },
  {
    k: "L",
    n: "ال‌شکل",
    cells: [
      { x: 0, y: 0, w: 1, h: 1, kind: "notch" },
      { x: 0.52, y: 0.46, w: 0.48, h: 0.54 },
    ],
  },
  {
    k: "circle-hero",
    n: "دایره میانی",
    cells: [
      { x: 0.12, y: 0.18, w: 0.76, h: 0.64, kind: "circle" },
      { x: 0, y: 0, w: 0.48, h: 0.22 },
      { x: 0.52, y: 0.78, w: 0.48, h: 0.22 },
    ],
  },
  {
    k: "diamond-hero",
    n: "لوزی",
    cells: [
      { x: 0.08, y: 0.16, w: 0.84, h: 0.68, kind: "diamond" },
      { x: 0, y: 0, w: 0.46, h: 0.2 },
      { x: 0.54, y: 0.8, w: 0.46, h: 0.2 },
    ],
  },
  {
    k: "burst-hero",
    n: "انفجار بالا",
    cells: [
      { x: 0.08, y: 0, w: 0.84, h: 0.42, kind: "burst" },
      { x: 0, y: 0.46, w: 0.5, h: 0.54 },
      { x: 0.5, y: 0.46, w: 0.5, h: 0.54 },
    ],
  },
  { k: "0", n: "بدون قاب", cells: [] },
];

export function layoutCellCount(key: string) {
  return PANEL_LAYOUTS.find((L) => L.k === key)?.cells.length ?? 0;
}
