import type { PanelItem, PanelKind } from "./types";

export const PANEL_KINDS: { k: PanelKind; n: string }[] = [
  { k: "rect", n: "چهارگوش" },
  { k: "round", n: "گردگوشه" },
  { k: "circle", n: "دایره" },
  { k: "tri", n: "مثلث" },
  { k: "tri-down", n: "وارونه" },
  { k: "diamond", n: "لوزی" },
  { k: "hex", n: "شش‌ضلعی" },
  { k: "slash-l", n: "برش /" },
  { k: "slash-r", n: "برش /" },
  { k: "slash-tl", n: "برش \\" },
  { k: "slash-br", n: "برش \\" },
  { k: "arch", n: "طاق" },
  { k: "trap", n: "ذوزنقه" },
  { k: "burst", n: "انفجار" },
  { k: "notch", n: "ال‌شکل" },
];

export function panelKindOf(it: { kind?: PanelKind } | null | undefined): PanelKind {
  return it?.kind || "rect";
}

type Pt = [number, number];

function pathRoundRect(
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

export function panelPoints(
  kind: PanelKind,
  x: number,
  y: number,
  w: number,
  h: number,
): Pt[] | "ellipse" | "rect" {
  switch (kind) {
    case "circle":
      return "ellipse";
    case "rect":
    case "round":
      return "rect";
    case "tri":
      return [
        [x + w / 2, y],
        [x + w, y + h],
        [x, y + h],
      ];
    case "tri-down":
      return [
        [x, y],
        [x + w, y],
        [x + w / 2, y + h],
      ];
    case "diamond":
      return [
        [x + w / 2, y],
        [x + w, y + h / 2],
        [x + w / 2, y + h],
        [x, y + h / 2],
      ];
    case "hex": {
      const rx = w / 2;
      const ry = h / 2;
      const cx = x + rx;
      const cy = y + ry;
      const pts: Pt[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
      }
      return pts;
    }
    case "slash-l":
      return [
        [x, y],
        [x + w, y],
        [x, y + h],
      ];
    case "slash-r":
      return [
        [x + w, y],
        [x + w, y + h],
        [x, y + h],
      ];
    case "slash-tl":
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h],
      ];
    case "slash-br":
      return [
        [x, y],
        [x + w, y + h],
        [x, y + h],
      ];
    case "arch": {
      const pts: Pt[] = [[x, y + h]];
      const x0 = x;
      const y0 = y + h * 0.46;
      const cx = x + w / 2;
      const cy = y - h * 0.04;
      const x1 = x + w;
      const y1 = y + h * 0.46;
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const u = 1 - t;
        pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]);
      }
      pts.push([x + w, y + h]);
      return pts;
    }
    case "trap":
      return [
        [x + w * 0.16, y],
        [x + w * 0.84, y],
        [x + w, y + h],
        [x, y + h],
      ];
    case "burst": {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const n = 16;
      const pts: Pt[] = [];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n - Math.PI / 2;
        const spike = i % 2 === 0 ? 1 : 0.7;
        pts.push([cx + (w / 2) * spike * Math.cos(a), cy + (h / 2) * spike * Math.sin(a)]);
      }
      return pts;
    }
    case "notch":
      return [
        [x, y],
        [x + w, y],
        [x + w, y + h * 0.42],
        [x + w * 0.48, y + h * 0.42],
        [x + w * 0.48, y + h],
        [x, y + h],
      ];
    default:
      return "rect";
  }
}

export function pointInPolygon(px: number, py: number, pts: Pt[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    const hit = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi || 1e-9) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function pointInPanel(it: PanelItem, px: number, py: number) {
  const pad = Math.max(6, it.stroke || 0);
  if (px < it.x - pad || py < it.y - pad || px > it.x + it.w + pad || py > it.y + it.h + pad) return false;
  const kind = panelKindOf(it);
  if (kind === "rect" || kind === "round") {
    return px >= it.x && px <= it.x + it.w && py >= it.y && py <= it.y + it.h;
  }
  if (kind === "circle") {
    const nx = (px - (it.x + it.w / 2)) / (it.w / 2 || 1);
    const ny = (py - (it.y + it.h / 2)) / (it.h / 2 || 1);
    return nx * nx + ny * ny <= 1.04;
  }
  const pts = panelPoints(kind, it.x, it.y, it.w, it.h);
  if (pts === "rect" || pts === "ellipse") return true;
  return pointInPolygon(px, py, pts);
}

export function panelCentroid(it: { x: number; y: number; w: number; h: number; kind?: PanelKind }) {
  const kind = panelKindOf(it);
  if (kind === "rect" || kind === "round" || kind === "circle") {
    return { x: it.x + it.w / 2, y: it.y + it.h / 2 };
  }
  const pts = panelPoints(kind, it.x, it.y, it.w, it.h);
  if (pts === "rect" || pts === "ellipse") return { x: it.x + it.w / 2, y: it.y + it.h / 2 };
  let sx = 0;
  let sy = 0;
  for (const [x, y] of pts) {
    sx += x;
    sy += y;
  }
  return { x: sx / pts.length, y: sy / pts.length };
}

export function tracePanelPath(
  ctx: CanvasRenderingContext2D,
  it: { x: number; y: number; w: number; h: number; radius?: number; kind?: PanelKind },
) {
  const kind = panelKindOf(it);
  const { x, y, w, h } = it;
  if (kind === "circle") {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    return;
  }
  if (kind === "rect" || kind === "round") {
    const r = kind === "round" ? Math.max(it.radius || 0, Math.min(w, h) * 0.12) : it.radius || 0;
    pathRoundRect(ctx, x, y, w, h, r);
    return;
  }
  const pts = panelPoints(kind, x, y, w, h);
  ctx.beginPath();
  if (pts === "rect" || pts === "ellipse" || !pts.length) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

export function panelSvgD(kind: PanelKind, x: number, y: number, w: number, h: number) {
  if (kind === "circle") {
    const rx = w / 2;
    const ry = h / 2;
    const cx = x + rx;
    return `M ${cx} ${y} A ${rx} ${ry} 0 1 1 ${cx - 0.01} ${y} Z`;
  }
  if (kind === "rect" || kind === "round") {
    const r = kind === "round" ? Math.min(w, h) * 0.16 : 0;
    if (!r) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
    return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
  }
  const pts = panelPoints(kind, x, y, w, h);
  if (pts === "rect" || pts === "ellipse" || !pts.length) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return `M ${pts[0][0]} ${pts[0][1]} ${pts
    .slice(1)
    .map(([px, py]) => `L ${px} ${py}`)
    .join(" ")} Z`;
}

export function cssClipForPanel(it: { kind?: PanelKind }) {
  const kind = panelKindOf(it);
  if (kind === "rect" || kind === "round") return "none";
  if (kind === "circle") return "ellipse(50% 50% at 50% 50%)";
  const pts = panelPoints(kind, 0, 0, 1, 1);
  if (pts === "rect" || pts === "ellipse") return "none";
  return `polygon(${pts.map(([x, y]) => `${+(x * 100).toFixed(2)}% ${+(y * 100).toFixed(2)}%`).join(", ")})`;
}
