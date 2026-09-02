import type { AssetKind, AssetMeta, ComicProject, ProjectMeta } from "./types";

const DB_NAME = "kader-studio";
const DB_VER = 1;

let dbp: Promise<IDBDatabase> | null = null;

function openDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) {
          db.createObjectStore("projects", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function req<T>(r: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export interface AssetRecord extends AssetMeta {
  blob: Blob;
  thumb?: Blob;
}

export interface ProjectRecord extends ProjectMeta {
  json: ComicProject;
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await openDb();
  const store = db.transaction("projects").objectStore("projects");
  const rows = (await req(store.getAll())) as ProjectRecord[];
  return rows.map(({ json: _j, ...meta }) => meta).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<ComicProject | null> {
  const db = await openDb();
  const row = (await req(db.transaction("projects").objectStore("projects").get(id))) as
    ProjectRecord | undefined;
  return row?.json ?? null;
}

export async function saveProject(project: ComicProject, extra: Partial<ProjectMeta> = {}) {
  const db = await openDb();
  const rec: ProjectRecord = {
    id: project.id,
    title: project.title,
    description: project.description,
    coverAssetId: project.coverAssetId,
    pageCount: project.pages.length,
    updatedAt: project.updatedAt,
    createdAt: project.createdAt,
    sample: extra.sample,
    json: project,
  };
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").put(rec);
  await txDone(tx);
}

export async function deleteProject(id: string) {
  const db = await openDb();
  const tx = db.transaction("projects", "readwrite");
  tx.objectStore("projects").delete(id);
  await txDone(tx);
}

export async function putAsset(record: AssetRecord) {
  const db = await openDb();
  const tx = db.transaction("assets", "readwrite");
  tx.objectStore("assets").put(record);
  await txDone(tx);
}

export async function getAsset(id: string): Promise<AssetRecord | null> {
  const db = await openDb();
  const row = (await req(db.transaction("assets").objectStore("assets").get(id))) as
    AssetRecord | undefined;
  return row ?? null;
}

export async function listAssets(kind?: AssetKind): Promise<AssetMeta[]> {
  const db = await openDb();
  const rows = (await req(
    db.transaction("assets").objectStore("assets").getAll(),
  )) as AssetRecord[];
  return rows
    .filter((r) => (kind ? r.kind === kind : true))
    .map(({ blob: _b, thumb: _t, ...meta }) => meta)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getAssetThumb(id: string): Promise<Blob | null> {
  const row = await getAsset(id);
  return row?.thumb ?? row?.blob ?? null;
}

export async function deleteAsset(id: string) {
  const db = await openDb();
  const tx = db.transaction("assets", "readwrite");
  tx.objectStore("assets").delete(id);
  await txDone(tx);
}

const urlCache = new Map<string, string>();
const thumbCache = new Map<string, string>();

export function mediaUrl(id: string) {
  return urlCache.get(id) || "";
}

export function thumbUrl(id: string) {
  return thumbCache.get(id) || urlCache.get(id) || "";
}

/** Instant blob URL so a video/image can sit on the page before IndexedDB finishes. */
export function adoptBlobUrl(id: string, blob: Blob, thumb?: Blob) {
  const prev = urlCache.get(id);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(blob);
  urlCache.set(id, url);
  if (thumb) {
    const prevT = thumbCache.get(id);
    if (prevT) URL.revokeObjectURL(prevT);
    thumbCache.set(id, URL.createObjectURL(thumb));
  }
  return url;
}

/** Add (or replace) just the poster for an asset, leaving its media URL alone. */
export function adoptThumbUrl(id: string, thumb: Blob) {
  const prev = thumbCache.get(id);
  if (prev) URL.revokeObjectURL(prev);
  const url = URL.createObjectURL(thumb);
  thumbCache.set(id, url);
  return url;
}

/** True only when a real poster exists — `thumbUrl` otherwise falls back to the
 *  media itself, and a clip's blob URL in an <img> renders as a blank box. */
export function hasThumb(id: string) {
  return thumbCache.has(id);
}

export async function ensureAssetUrl(id: string) {
  if (urlCache.has(id)) return urlCache.get(id)!;
  const rec = await getAsset(id);
  if (!rec) return "";
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  if (rec.thumb) thumbCache.set(id, URL.createObjectURL(rec.thumb));
  return url;
}

export async function ensureAllUrls(ids: string[]) {
  await Promise.all(ids.filter(Boolean).map((id) => ensureAssetUrl(id)));
}

export function revokeAllUrls() {
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  for (const u of thumbCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  thumbCache.clear();
}

export function collectAssetIds(project: ComicProject) {
  const ids = new Set<string>();
  if (project.coverAssetId) ids.add(project.coverAssetId);
  for (const page of project.pages) {
    if (page.background.assetId) ids.add(page.background.assetId);
    if (page.playback.ambientAudio?.assetId) ids.add(page.playback.ambientAudio.assetId);
    for (const it of page.items) {
      if (it.type === "image") ids.add(it.assetId);
      if (it.type === "video") {
        ids.add(it.assetId);
        if (it.posterAssetId) ids.add(it.posterAssetId);
      }
      if (
        (it.type === "panel" || it.type === "image" || it.type === "video") &&
        it.story?.audio?.assetId
      ) {
        ids.add(it.story.audio.assetId);
      }
    }
  }
  return [...ids];
}
