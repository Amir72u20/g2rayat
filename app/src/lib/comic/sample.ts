import { uid } from "@/lib/utils";
import { listProjects, putAsset, saveProject, type AssetRecord } from "./db";
import { applyLayout, attachMediaToPanel, insertItem, newBubble, newImage, newPage, newText } from "./factory";
import type { ComicProject } from "./types";

function canvasToBlob(cv: HTMLCanvasElement, type = "image/jpeg", q = 0.9) {
  return new Promise<Blob>((resolve, reject) => {
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), type, q);
  });
}

function sceneSky(ctx: CanvasRenderingContext2D, w: number, h: number, dusk: boolean) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  if (dusk) {
    g.addColorStop(0, "#1d2433");
    g.addColorStop(0.45, "#3d3a4a");
    g.addColorStop(1, "#c9895c");
  } else {
    g.addColorStop(0, "#8fb4c9");
    g.addColorStop(0.55, "#d7c7a5");
    g.addColorStop(1, "#efe6d2");
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function sceneCity(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#141820";
  for (let i = 0; i < 9; i++) {
    const bw = 50 + (i % 3) * 28;
    const bh = 140 + ((i * 47) % 220);
    const x = 30 + i * 78;
    ctx.fillRect(x, h - bh - 80, bw, bh);
    ctx.fillStyle = i % 2 ? "#d9c07a" : "#7ea0b8";
    for (let y = h - bh - 60; y < h - 100; y += 22) {
      for (let x2 = x + 8; x2 < x + bw - 10; x2 += 16) {
        if ((x2 + y) % 3) ctx.fillRect(x2, y, 8, 10);
      }
    }
    ctx.fillStyle = "#141820";
  }
  ctx.fillStyle = "#0e1116";
  ctx.fillRect(0, h - 90, w, 90);
}

function figure(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, coat: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#1a1c20";
  ctx.beginPath();
  ctx.ellipse(0, 86, 38, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.moveTo(-28, 18);
  ctx.lineTo(-40, 90);
  ctx.lineTo(40, 90);
  ctx.lineTo(26, 18);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e2c2a2";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#1a1c20";
  ctx.fillRect(-20, -8, 40, 8);
  ctx.restore();
}

async function paint(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 832, h = 1216) {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("ctx");
  draw(ctx, w, h);
  const blob = await canvasToBlob(cv);
  const thumbCv = document.createElement("canvas");
  const s = 360 / Math.max(w, h);
  thumbCv.width = Math.round(w * s);
  thumbCv.height = Math.round(h * s);
  thumbCv.getContext("2d")!.drawImage(cv, 0, 0, thumbCv.width, thumbCv.height);
  const thumb = await canvasToBlob(thumbCv, "image/jpeg", 0.8);
  const rec: AssetRecord = {
    id: uid("a"),
    kind: "image",
    name: "sample.jpg",
    mime: "image/jpeg",
    size: blob.size,
    width: w,
    height: h,
    createdAt: Date.now(),
    blob,
    thumb,
  };
  await putAsset(rec);
  return rec.id;
}

export async function seedSampleIfNeeded() {
  const existing = await listProjects();
  if (existing.some((p) => p.sample) || existing.length) return;

  const [a, b, c, d] = await Promise.all([
    paint((ctx, w, h) => {
      sceneSky(ctx, w, h, false);
      sceneCity(ctx, w, h);
      figure(ctx, w * 0.34, h * 0.62, 2.1, "#2c3a4a");
      figure(ctx, w * 0.62, h * 0.66, 1.7, "#6a3a3a");
    }),
    paint((ctx, w, h) => {
      sceneSky(ctx, w, h, true);
      sceneCity(ctx, w, h);
      figure(ctx, w * 0.5, h * 0.58, 2.6, "#243044");
      ctx.fillStyle = "rgba(255,210,140,0.18)";
      ctx.beginPath();
      ctx.arc(w * 0.78, h * 0.16, 90, 0, Math.PI * 2);
      ctx.fill();
    }),
    paint((ctx, w, h) => {
      sceneSky(ctx, w, h, true);
      ctx.fillStyle = "#10141c";
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      figure(ctx, w * 0.5, h * 0.5, 3.2, "#3b2a24");
    }),
    paint((ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#0e1218");
      g.addColorStop(1, "#2a3344");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d9c48a";
      ctx.font = "700 64px Vazirmatn, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("کادر", w / 2, h * 0.46);
      ctx.font = "500 28px Vazirmatn, sans-serif";
      ctx.fillStyle = "#b7c0cc";
      ctx.fillText("استودیوی کمیک", w / 2, h * 0.54);
    }),
  ]);

  const now = Date.now();
  const p1 = newPage("ورود به شهر", 1024, 1536);
  applyLayout(p1, "1+2");
  const panels1 = p1.items.filter((i) => i.type === "panel");
  if (panels1[0]) {
    const img = newImage(p1, a);
    attachMediaToPanel(p1, img, panels1[0]);
    insertItem(p1, img);
  }
  if (panels1[1]) {
    const img = newImage(p1, b);
    attachMediaToPanel(p1, img, panels1[1]);
    insertItem(p1, img);
  }
  if (panels1[2]) {
    const img = newImage(p1, c);
    attachMediaToPanel(p1, img, panels1[2]);
    insertItem(p1, img);
  }
  const b1 = newBubble(p1, "round", {
    text: "شهر از همیشه ساکت‌تر بود.",
    x: 90,
    y: 70,
    w: 520,
    h: 150,
    tx: 220,
    ty: 280,
  });
  insertItem(p1, b1);
  const b2 = newBubble(p1, "think", {
    text: "اگر دیر برسیم، در بسته می‌شود.",
    x: 80,
    y: 860,
    w: 380,
    h: 150,
    tx: 200,
    ty: 1080,
    fill: "#eef3f8",
  });
  insertItem(p1, b2);

  const p2 = newPage("نگاه آخر", 1024, 1536);
  applyLayout(p2, "2v");
  const panels2 = p2.items.filter((i) => i.type === "panel");
  if (panels2[0]) {
    const img = newImage(p2, b);
    attachMediaToPanel(p2, img, panels2[0]);
    insertItem(p2, img);
  }
  if (panels2[1]) {
    const img = newImage(p2, d);
    attachMediaToPanel(p2, img, panels2[1]);
    insertItem(p2, img);
  }
  insertItem(
    p2,
    newBubble(p2, "shout", {
      text: "بایست!",
      x: 300,
      y: 80,
      w: 360,
      h: 140,
      tx: 420,
      ty: 280,
    }),
  );
  insertItem(
    p2,
    newText(p2, {
      text: "پایان قسمت اول",
      y: 1400,
      h: 80,
      font: 26,
      color: "#3a342c",
    }),
  );

  const project: ComicProject = {
    id: uid("comic"),
    title: "نمونه‌ی آماده — شهر نئون",
    description: "دو صفحه برای تمرین حباب، قاب و خواندن تعاملی. همه چیز روی همین دستگاه است.",
    coverAssetId: a,
    readingDirection: "rtl",
    sourceLanguage: "fa",
    translations: {},
    pages: [p1, p2],
    createdAt: now,
    updatedAt: now,
  };
  await saveProject(project, { sample: true });
}
