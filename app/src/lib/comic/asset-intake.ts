import { adoptBlobUrl, adoptThumbUrl, putAsset, type AssetRecord } from "./db";
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

/** Grab a frame from a clip so it has a poster like every other asset. */
async function videoThumb(file: File): Promise<Blob | undefined> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.setAttribute("playsinline", "");
    video.src = url;
    const ready = await new Promise<boolean>((resolve) => {
      let settled = false;
      const done = (ok: boolean) => {
        if (settled) return;
        settled = true;
        resolve(ok);
      };
      video.onloadeddata = () => done(true);
      video.onerror = () => done(false);
      // Some containers only decode after a seek; others never load in a
      // background tab. Either way the poster is optional, so give up quietly.
      setTimeout(() => done(video.readyState >= 2), 4000);
      try {
        video.load();
      } catch {
        done(false);
      }
    });
    if (!ready || !video.videoWidth) return undefined;
    const target = Math.min(0.2, (video.duration || 1) / 2);
    if (Number.isFinite(target) && target > 0) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        video.onseeked = done;
        setTimeout(done, 1200);
        try {
          video.currentTime = target;
        } catch {
          done();
        }
      });
    }
    const scale = 360 / Math.max(video.videoWidth, video.videoHeight);
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, Math.round(video.videoWidth * scale));
    cv.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = cv.getContext("2d");
    if (!ctx) return undefined;
    ctx.drawImage(video, 0, 0, cv.width, cv.height);
    return await new Promise((res) => cv.toBlob((b) => res(b || undefined), "image/jpeg", 0.8));
  } catch {
    return undefined;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function makeThumb(file: File, kind: AssetKind): Promise<Blob | undefined> {
  if (kind === "video") return videoThumb(file);
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
  if (rec.thumb) adoptThumbUrl(rec.id, rec.thumb);
  await putAsset(rec);
  return rec;
}
