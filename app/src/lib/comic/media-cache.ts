import { mediaUrl } from "./db";
import type { MediaBag } from "./draw";
import type { VideoItem } from "./types";

const images: Record<string, HTMLImageElement | HTMLCanvasElement> = {};
const videos: Record<string, HTMLVideoElement> = {};
const loading = new Set<string>();
const waiters: Record<string, Array<() => void>> = {};
const MAX_EDGE = 2048;

export function getMediaBag(): MediaBag {
  return { images, videos };
}

function notify(id: string) {
  loading.delete(id);
  const list = waiters[id];
  delete waiters[id];
  list?.forEach((fn) => fn());
}

function want(id: string, onReady?: () => void) {
  if (onReady) (waiters[id] ||= []).push(onReady);
}

function downscale(img: HTMLImageElement): HTMLImageElement | HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h || (w <= MAX_EDGE && h <= MAX_EDGE)) return img;
  const s = MAX_EDGE / Math.max(w, h);
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w * s));
  c.height = Math.max(1, Math.round(h * s));
  const ctx = c.getContext("2d");
  if (!ctx) return img;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

function later(fn?: () => void) {
  if (fn) queueMicrotask(fn);
}

export function loadImageAsset(id: string, onReady?: () => void) {
  if (!id) return;
  if (images[id]) {
    later(onReady);
    return;
  }
  want(id, onReady);
  if (loading.has(id)) return;
  const src = mediaUrl(id);
  if (!src) return;
  loading.add(id);
  const img = new Image();
  img.onload = () => {
    images[id] = downscale(img);
    notify(id);
  };
  img.onerror = () => notify(id);
  img.src = src;
}

export function loadVideoAsset(id: string, onReady?: () => void) {
  if (!id) return;
  if (videos[id]) {
    later(onReady);
    return;
  }
  const key = "v" + id;
  want(key, onReady);
  if (loading.has(key)) return;
  const src = mediaUrl(id);
  if (!src) return;
  loading.add(key);
  const video = document.createElement("video");
  video.preload = "auto";
  video.playsInline = true;
  video.muted = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  const done = () => {
    if (!videos[id] && video.videoWidth) videos[id] = video;
    else if (!videos[id]) videos[id] = video;
    notify(key);
  };
  video.onloadeddata = done;
  video.onloadedmetadata = () => {
    if (video.videoWidth && !videos[id]) videos[id] = video;
  };
  video.onerror = () => notify(key);
  video.src = src;
  try {
    video.load();
  } catch {
    /* ignore */
  }
}

export function seekVideo(id: string, t: number) {
  const v = videos[id];
  if (!v) return;
  try {
    if (Math.abs(v.currentTime - t) > 0.04) v.currentTime = t;
  } catch {
    /* ignore */
  }
}

export function playVideo(id: string, muted = false, speed = 1, volume = 1) {
  const v = videos[id];
  if (!v) return;
  v.muted = muted;
  v.playbackRate = speed || 1;
  v.volume = Math.max(0, Math.min(1, volume));
  void v.play().catch(() => undefined);
}

export function pauseVideo(id: string) {
  videos[id]?.pause();
}

export function pauseAllVideos() {
  Object.values(videos).forEach((v) => v.pause());
}

export function tickVideoClip(it: VideoItem) {
  const v = videos[it.assetId];
  if (!v || v.paused) return;
  v.playbackRate = it.speed || 1;
  v.volume = Math.max(0, Math.min(1, it.volume ?? 1));
  v.muted = it.muted;
  const end = it.trimEnd > 0 ? it.trimEnd : v.duration || 0;
  if (end && v.currentTime >= end - 0.04) {
    try {
      v.currentTime = it.trimStart || 0;
    } catch {
      /* ignore */
    }
  }
}
