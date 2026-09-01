import { PACKAGE_FORMAT, type ComicProject, type AssetKind } from "./types.ts";

export interface StudioPackage {
  kind: typeof PACKAGE_FORMAT;
  formatVersion: number;
  document: ComicProject;
  assets: {
    id: string;
    kind: AssetKind;
    name: string;
    mime: string;
    size: number;
    width?: number;
    height?: number;
    duration?: number;
    createdAt: number;
    data: string;
    thumb?: string;
  }[];
}

export function validatePackage(raw: unknown): StudioPackage {
  if (!raw || typeof raw !== "object") throw new Error("فرمت پرونده پشتیبانی نمی‌شود");
  const pack = raw as Partial<StudioPackage>;
  if (pack.kind !== PACKAGE_FORMAT || !pack.document || !Array.isArray(pack.assets)) {
    throw new Error("فرمت پرونده پشتیبانی نمی‌شود");
  }
  if (typeof pack.formatVersion === "number" && pack.formatVersion > 1) {
    throw new Error("نسخه این پرونده جدیدتر از برنامه است");
  }
  if (!Array.isArray(pack.document.pages)) throw new Error("سند ناقص است");
  return pack as StudioPackage;
}
