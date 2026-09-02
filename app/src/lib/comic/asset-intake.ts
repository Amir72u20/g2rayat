import { adoptBlobUrl, putAsset, type AssetRecord } from "./db";
import type { AssetKind } from "./types";
import { uid } from "@/lib/utils";

/** What kind of asset a picked file is — by MIME first, extension as a fallback. */
export function kindOf(file: File): AssetKind | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  const n = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif)$/.test(n)) return "image";
  if (/\.(mp4|webm|mov)$/.test(n)) return "video";
  if (/\.(mp3|wav|ogg|m4a|flac)$/.test(n)) return "audio";
  return null;
}

export async function makeThumb(file: File, kind: AssetKind): Promise<Blob | undefined> {
  if (kind !== "image") return undefined;
  const bmp = await createImageBitmap(file);
  const cv = document.createElement("canvas");
  const scale = 360 / Math.max(bmp.width, bmp.height);
  cv.width = Math.max(1, Math.round(bmp.width * scale));
  cv.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = cv.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
  return await new Promise((res) => cv.toBlob((b) => res(b || undefined), "image/jpeg", 0.82));
}

export async function probeMedia(file: File, kind: AssetKind) {
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

/**
 * Take one picked file all the way into the device library: probe it, build a
 * thumbnail, store it, and hand back the record. Used by the easy builder,
 * which imports files before any project exists.
 */
export async function intakeFile(file: File): Promise<AssetRecord | null> {
  const kind = kindOf(file);
  if (!kind) return null;
  const rec: AssetRecord = {
    id: uid("a"),
    kind,
    name: file.name,
    mime: file.type || "application/octet-stream",
    size: file.size,
    createdAt: Date.now(),
    blob: file,
  };
  adoptBlobUrl(rec.id, file);
  const probe = await probeMedia(file, kind);
  rec.width = probe.width;
  rec.height = probe.height;
  rec.duration = probe.duration;
  rec.thumb = await makeThumb(file, kind).catch(() => undefined);
  if (rec.thumb) adoptBlobUrl(rec.id, file, rec.thumb);
  await putAsset(rec);
  return rec;
}
