import { uid } from "@/lib/utils";
import type { ComicProject } from "./types";
import { DOCUMENT_VERSION, PACKAGE_FORMAT } from "./types";
import { collectAssetIds, getAsset, putAsset, type AssetRecord } from "./db";
import { type StudioPackage, validatePackage } from "./package-format";

function blobToB64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result || "");
      resolve(s.includes(",") ? s.slice(s.indexOf(",") + 1) : s);
    };
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function b64ToBlob(b64: string, mime: string) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || "application/octet-stream" });
}

export async function exportProjectPackage(project: ComicProject): Promise<Blob> {
  const ids = collectAssetIds(project);
  const assets: StudioPackage["assets"] = [];
  for (const id of ids) {
    const rec = await getAsset(id);
    if (!rec) continue;
    assets.push({
      id: rec.id,
      kind: rec.kind,
      name: rec.name,
      mime: rec.mime,
      size: rec.size,
      width: rec.width,
      height: rec.height,
      duration: rec.duration,
      createdAt: rec.createdAt,
      data: await blobToB64(rec.blob),
      thumb: rec.thumb ? await blobToB64(rec.thumb) : undefined,
    });
  }
  const pack: StudioPackage = {
    kind: PACKAGE_FORMAT,
    formatVersion: 1,
    document: { ...project, documentVersion: project.documentVersion ?? DOCUMENT_VERSION },
    assets,
  };
  return new Blob([JSON.stringify(pack)], { type: "application/json" });
}

export async function importProjectPackage(file: File): Promise<ComicProject> {
  const text = await file.text();
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("این فایل کمیک نیست");
  }
  const pack = validatePackage(raw);
  const idMap = new Map<string, string>();
  for (const a of pack.assets) {
    if (!a?.id || !a.data) continue;
    const nid = uid("a");
    idMap.set(a.id, nid);
    const rec: AssetRecord = {
      id: nid,
      kind: a.kind,
      name: a.name || "asset",
      mime: a.mime,
      size: a.size || 0,
      width: a.width,
      height: a.height,
      duration: a.duration,
      createdAt: Date.now(),
      blob: b64ToBlob(a.data, a.mime),
      thumb: a.thumb ? b64ToBlob(a.thumb, "image/jpeg") : undefined,
    };
    await putAsset(rec);
  }
  const remap = (id?: string) => (id ? idMap.get(id) || id : id);
  const doc = structuredClone(pack.document) as ComicProject;
  doc.id = uid("comic");
  doc.title = doc.title || "کمیک واردشده";
  doc.createdAt = Date.now();
  doc.updatedAt = Date.now();
  doc.coverAssetId = remap(doc.coverAssetId);
  doc.documentVersion = DOCUMENT_VERSION;
  for (const page of doc.pages) {
    page.id = uid("page");
    page.background.assetId = remap(page.background.assetId) || "";
    if (page.playback.ambientAudio) page.playback.ambientAudio.assetId = remap(page.playback.ambientAudio.assetId) || "";
    const panelMap = new Map<string, string>();
    for (const it of page.items) {
      const old = it.id;
      it.id = uid("it");
      if (it.type === "panel") panelMap.set(old, it.id);
    }
    for (const it of page.items) {
      if (it.panelId) it.panelId = panelMap.get(it.panelId) || it.panelId;
      if (it.type === "image" || it.type === "video") it.assetId = remap(it.assetId) || it.assetId;
      if (it.type === "video" && it.posterAssetId) it.posterAssetId = remap(it.posterAssetId);
      if ((it.type === "panel" || it.type === "image" || it.type === "video") && it.story?.audio) {
        it.story.audio.assetId = remap(it.story.audio.assetId) || it.story.audio.assetId;
      }
    }
  }
  return doc;
}
