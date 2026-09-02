import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Crop,
  Film,
  FlipHorizontal,
  FlipVertical,
  MessageCircle,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  applyResize,
  applyRotate,
  clampItem,
  hitTest,
  moveItem,
  panCrop,
  resizeCorner,
  type HandleCorner,
} from "@/lib/comic/geometry";
import { FRAME_RATIOS, shotMedia, shotVideo, type EasyShot } from "@/lib/comic/easy";
import { useEasy } from "@/lib/comic/easy-store";
import { hasThumb, thumbUrl } from "@/lib/comic/db";
import {
  getMediaBag,
  loadVideoAsset,
  pauseVideo,
  playVideo,
  seekVideo,
} from "@/lib/comic/media-cache";
import type { BubbleItem, BubbleKind, ComicItem, VideoItem } from "@/lib/comic/types";
import { cn } from "@/lib/utils";
import { FrameCanvas, type ScenePoint } from "./FrameCanvas";

type Tool = "crop" | "color" | "bubble" | "clip";

const BUBBLE_KINDS: { k: BubbleKind; n: string }[] = [
  { k: "round", n: "گفتگو" },
  { k: "think", n: "فکر" },
  { k: "shout", n: "فریاد" },
  { k: "whisper", n: "نجوا" },
  { k: "caption", n: "روایت" },
  { k: "rect", n: "کادر" },
  { k: "none", n: "فقط متن" },
];

/** Bubble skins: solid comic whites, inks, and see-through glass. */
const BUBBLE_SKINS: { n: string; fill: string; color: string; alpha: number; stroke: number }[] = [
  { n: "کلاسیک", fill: "#ffffff", color: "#16171a", alpha: 1, stroke: 5 },
  { n: "کاغذ", fill: "#f6f1e6", color: "#16171a", alpha: 1, stroke: 5 },
  { n: "شب", fill: "#15171c", color: "#f4efe3", alpha: 1, stroke: 4 },
  { n: "شنگرف", fill: "#ef6446", color: "#1b0803", alpha: 1, stroke: 4 },
  { n: "آبی", fill: "#2f6df6", color: "#ffffff", alpha: 1, stroke: 4 },
  { n: "زرد", fill: "#f4b942", color: "#1b1403", alpha: 1, stroke: 4 },
  { n: "شیشه‌ای", fill: "#ffffff", color: "#16171a", alpha: 0.45, stroke: 3 },
  { n: "دود", fill: "#15171c", color: "#ffffff", alpha: 0.45, stroke: 0 },
  { n: "بی‌قاب", fill: "#ffffff", color: "#ffffff", alpha: 0, stroke: 0 },
];

const TOOL_LABELS: Record<Tool, string> = {
  crop: "قاب تصویر",
  clip: "ویدئو",
  color: "رنگ و نور",
  bubble: "حباب گفتگو",
};

const COLOR_PRESETS: {
  n: string;
  a: { brightness: number; contrast: number; saturate: number; warmth: number };
}[] = [
  { n: "خام", a: { brightness: 1, contrast: 1, saturate: 1, warmth: 0 } },
  { n: "گرم", a: { brightness: 1.04, contrast: 1.05, saturate: 1.1, warmth: 0.45 } },
  { n: "سرد", a: { brightness: 1, contrast: 1.08, saturate: 1.05, warmth: -0.5 } },
  { n: "سیاه‌سفید", a: { brightness: 1.05, contrast: 1.18, saturate: 0, warmth: 0 } },
  { n: "کنتراست", a: { brightness: 0.98, contrast: 1.35, saturate: 1.15, warmth: 0 } },
  { n: "کهنه", a: { brightness: 1.02, contrast: 0.92, saturate: 0.75, warmth: 0.7 } },
];

/** Soft magnets while dragging a bubble: the frame's centre lines and its safe
 *  margins pull gently, so a bubble lands square without feeling locked. */
function magnetBubble(it: BubbleItem, frame: { w: number; h: number }) {
  const snap = frame.w * 0.02;
  const margin = frame.w * 0.04;
  const pull = (value: number, target: number) =>
    Math.abs(value - target) <= snap ? target : value;
  const before = { x: it.x, y: it.y };
  const cx = it.x + it.w / 2;
  const cy = it.y + it.h / 2;
  if (Math.abs(cx - frame.w / 2) <= snap) it.x = frame.w / 2 - it.w / 2;
  else {
    it.x = pull(it.x, margin);
    it.x = pull(it.x + it.w, frame.w - margin) - it.w;
  }
  if (Math.abs(cy - frame.h / 2) <= snap) it.y = frame.h / 2 - it.h / 2;
  else {
    it.y = pull(it.y, margin);
    it.y = pull(it.y + it.h, frame.h - margin) - it.h;
  }
  // The tail rides along with whatever the magnet moved.
  it.tx += it.x - before.x;
  it.ty += it.y - before.y;
}

interface Drag {
  mode: "move" | "resize" | "tail" | "rotate" | "crop";
  id: string | null;
  corner: HandleCorner | null;
  last: { x: number; y: number };
}

/**
 * The picture editor.
 *
 * On a phone this is a fixed three-zone editor — picture, film strip, tools —
 * rather than a long scrolling form: the frame stays in view while you work,
 * and every control sits inside one thumb-height panel at the bottom.
 */
export function StepEdit() {
  const shots = useEasy((s) => s.shots);
  const tick = useEasy((s) => s.tick);
  const activeShotId = useEasy((s) => s.activeShotId);
  const setActiveShot = useEasy((s) => s.setActiveShot);
  const selectedBubbleId = useEasy((s) => s.selectedBubbleId);
  const selectBubble = useEasy((s) => s.selectBubble);
  const endLiveEdit = useEasy((s) => s.endLiveEdit);
  const [tool, setTool] = useState<Tool | null>(null);
  const drag = useRef<Drag | null>(null);
  // Dragging draws straight to the canvas; the store only hears about it once
  // the finger lifts, which is what makes a bubble feel like it sticks to it.
  const repaint = useRef<(() => void) | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const points = useRef(new Map<number, { x: number; y: number }>());

  const shot = shots.find((s) => s.id === activeShotId) ?? shots[0] ?? null;
  const video = shot ? shotVideo(shot) : null;

  // A clip's tab only exists while a clip is selected.
  useEffect(() => {
    if (!video && tool === "clip") setTool(null);
  }, [video, tool]);

  // Clips often arrive before the browser knows their length or shape: start
  // decoding them all, then fill the numbers in as they land.
  const syncClipMeta = useEasy((s) => s.syncClipMeta);
  const clipKey = shots
    .filter((s) => s.kind === "video")
    .map((s) => s.assetId)
    .join(",");
  useEffect(() => {
    if (!clipKey) return;
    clipKey.split(",").forEach((assetId) => loadVideoAsset(assetId));
    if (!syncClipMeta()) return;
    const timer = window.setInterval(() => {
      if (!syncClipMeta()) window.clearInterval(timer);
    }, 400);
    return () => window.clearInterval(timer);
  }, [clipKey, syncClipMeta]);

  if (!shot) {
    return (
      <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
        اول در مرحلهٔ قبل چند عکس یا ویدئو انتخاب کن.
      </p>
    );
  }

  const frame = shot.frame;
  const selected =
    (frame.items.find((i) => i.id === selectedBubbleId) as BubbleItem | undefined) ?? null;

  function onDown(pt: ScenePoint, e: React.PointerEvent) {
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (points.current.size === 2) {
      // Second finger: pinch the picture (or the selected bubble) instead.
      const [a, b] = [...points.current.values()];
      const media = shotMedia(shot!);
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: media?.zoom ?? 1 };
      drag.current = null;
      return;
    }
    const sel = selected;
    if (sel) {
      // A generous grab radius: fingers are not mouse pointers.
      const corner = resizeCorner(pt, sel, pt.hs * 1.25);
      if (corner === "tail") {
        drag.current = { mode: "tail", id: sel.id, corner: null, last: pt };
        return;
      }
      if (corner === "rot") {
        drag.current = { mode: "rotate", id: sel.id, corner: null, last: pt };
        return;
      }
      if (corner) {
        drag.current = { mode: "resize", id: sel.id, corner, last: pt };
        return;
      }
    }
    const hit = hitTest(frame, pt.x, pt.y);
    if (hit && hit.type === "bubble") {
      if (hit.id !== selectedBubbleId) selectBubble(hit.id);
      drag.current = { mode: "move", id: hit.id, corner: null, last: pt };
      return;
    }
    // Nothing under the finger: pan the picture inside its frame.
    if (selectedBubbleId) selectBubble(null);
    drag.current = { mode: "crop", id: null, corner: null, last: pt };
  }

  function onMove(pt: ScenePoint, e: React.PointerEvent) {
    if (points.current.has(e.pointerId)) {
      points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const media = shot ? shotMedia(shot) : null;
    if (pinch.current && points.current.size >= 2 && media) {
      const [a, b] = [...points.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const ratio = dist / Math.max(1, pinch.current.dist);
      media.zoom = Math.min(4, Math.max(0.5, pinch.current.zoom * ratio));
      repaint.current?.();
      return;
    }
    const d = drag.current;
    if (!d || !shot) return;
    const dx = pt.x - d.last.x;
    const dy = pt.y - d.last.y;
    d.last = pt;
    if (d.mode === "crop") {
      if (media) panCrop(media, dx, dy);
      repaint.current?.();
      return;
    }
    const it = frame.items.find((i) => i.id === d.id);
    if (!it) return;
    if (d.mode === "move") {
      moveItem(it, dx, dy, frame);
      if (it.type === "bubble") magnetBubble(it, frame);
    } else if (d.mode === "tail" && it.type === "bubble") {
      it.tx += dx;
      it.ty += dy;
    } else if (d.mode === "rotate") applyRotate(it, pt, e.shiftKey);
    else if (d.mode === "resize" && d.corner) applyResize(it, d.corner, dx, dy, null);
    clampItem(it, frame);
    repaint.current?.();
  }

  function onUp(_pt: ScenePoint, e: React.PointerEvent) {
    points.current.delete(e.pointerId);
    if (points.current.size < 2) pinch.current = null;
    if (!drag.current && !pinch.current && points.current.size === 0) {
      endLiveEdit();
      return;
    }
    drag.current = null;
    if (points.current.size === 0) endLiveEdit();
  }

  const media = shotMedia(shot);
  const adjust = media?.adjust ?? { brightness: 1, contrast: 1, saturate: 1, warmth: 0 };

  const tools: { value: Tool; label: string; icon: React.ReactNode }[] = [
    { value: "crop", label: "قاب", icon: <Crop /> },
    ...(video ? [{ value: "clip" as Tool, label: "ویدئو", icon: <Film /> }] : []),
    { value: "color", label: "رنگ", icon: <Palette /> },
    { value: "bubble", label: "حباب", icon: <MessageCircle /> },
  ];

  const panelFor = (t: Tool | null) => (
    <>
      {t === "crop" && <CropPanel shot={shot!} />}
      {t === "clip" && video && <ClipPanel item={video} />}
      {t === "color" && <ColorPanel adjust={adjust} />}
      {t === "bubble" && <BubblePanel selected={selected} />}
    </>
  );
  const panel = panelFor(tool);
  const deskPanel = panelFor(tool ?? "crop");

  const openTool = (t: Tool) => setTool((cur) => (cur === t ? null : t));

  return (
    <div className="flex h-full min-h-0 flex-col lg:grid lg:h-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
      {/* The picture owns the screen: roughly four fifths of it on a phone. */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-none">
        <div className="checker min-h-0 flex-1 overflow-hidden rounded-2xl lg:h-[62dvh] lg:flex-none">
          <FrameCanvas
            page={frame}
            tick={tick}
            selectedId={selectedBubbleId}
            repaintRef={repaint}
            onScenePointerDown={onDown}
            onScenePointerMove={onMove}
            onScenePointerUp={onUp}
          />
        </div>

        {/* Film strip — one tenth, right under the picture. */}
        <ShotStrip shots={shots} activeId={shot.id} onPick={setActiveShot} />

        {/* Tool bar — one tenth. Each button opens its own panel over the
            strip, so the picture above never moves or shrinks. */}
        <div className="relative shrink-0">
          {tool && (
            <div className="absolute inset-x-0 bottom-full z-20 mb-2 lg:hidden">
              <div className="material max-h-[46dvh] space-y-3 overflow-y-auto overscroll-contain rounded-2xl bg-surface/97 p-3 shadow-[var(--shadow-lift)] backdrop-blur-md animate-rise">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">{TOOL_LABELS[tool]}</span>
                  <button
                    type="button"
                    onClick={() => setTool(null)}
                    className="tap ms-auto grid size-8 place-items-center rounded-full bg-elevated text-muted"
                    aria-label="بستن ابزار"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                </div>
                {panel}
              </div>
            </div>
          )}
          <div className="flex gap-1.5 py-1.5 lg:hidden">
            {tools.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => openTool(t.value)}
                aria-pressed={tool === t.value}
                className={cn(
                  "tap flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium [&_svg]:size-5",
                  tool === t.value
                    ? "bg-brand text-brand-fg"
                    : "bg-elevated text-muted shadow-[var(--shadow-border)]",
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop keeps the side column: everything open, nothing to unfold. */}
      <div className="hidden flex-col gap-3 lg:flex">
        <Segmented
          ariaLabel="ابزار"
          value={tool ?? "crop"}
          onChange={(v) => setTool(v as Tool)}
          className="w-full"
          options={tools.map((t) => ({
            value: t.value,
            label: (
              <span className="flex items-center gap-1.5">
                {t.icon}
                {t.label}
              </span>
            ),
          }))}
        />
        <div className="space-y-3">{deskPanel}</div>
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="material rounded-xl bg-surface p-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      {hint ? <p className="mt-0.5 text-[11px] leading-relaxed text-muted">{hint}</p> : null}
      <div className="mt-2.5 space-y-3">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        {value ? (
          <span dir="ltr" className="num text-fg">
            {value}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function CropPanel({ shot }: { shot: EasyShot }) {
  const setRatio = useEasy((s) => s.setRatio);
  const patchImage = useEasy((s) => s.patchImage);
  const media = shotMedia(shot);
  const zoom = media?.zoom ?? 1;

  return (
    <>
      <Section
        title="قاب تصویر"
        hint="نسبت قاب را انتخاب کن؛ پنل کمیک بعداً با همین نسبت ساخته می‌شود."
      >
        <div className="grid grid-cols-3 gap-1.5">
          {FRAME_RATIOS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setRatio(f.id)}
              className={cn(
                "tap h-10 rounded-lg text-xs font-medium",
                shot.ratioId === f.id
                  ? "bg-brand/15 text-brand shadow-[0_0_0_1.5px_var(--color-brand)]"
                  : "bg-elevated text-muted shadow-[var(--shadow-border)] hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="اندازه و جهت">
        <Row label="بزرگ‌نمایی" value={`${Math.round(zoom * 100)}٪`}>
          <Slider
            min={50}
            max={400}
            value={[Math.round(zoom * 100)]}
            onValueChange={([v]) => patchImage({ zoom: v / 100 })}
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => patchImage({ flipX: !media?.flipX })}>
            <FlipHorizontal /> افقی
          </Button>
          <Button variant="outline" size="sm" onClick={() => patchImage({ flipY: !media?.flipY })}>
            <FlipVertical /> عمودی
          </Button>
          <Button variant="outline" size="sm" onClick={() => patchImage({ fitMode: "fill" })}>
            پرکردن قاب
          </Button>
          <Button variant="outline" size="sm" onClick={() => patchImage({ fitMode: "fit" })}>
            کامل دیده شود
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() =>
            patchImage({ zoom: 1, cropX: 0, cropY: 0, flipX: false, flipY: false, fitMode: "fill" })
          }
        >
          <RotateCcw /> برگرداندن به حالت اول
        </Button>
      </Section>
    </>
  );
}

/** Timing and sound for a clip — the parts a still picture has no use for. */
function ClipPanel({ item }: { item: VideoItem }) {
  const patchVideo = useEasy((s) => s.patchVideo);
  const [playing, setPlaying] = useState(false);
  const bag = getMediaBag();
  const el = bag.videos[item.assetId];
  const duration = item.duration || el?.duration || 0;
  const end = item.trimEnd > 0 ? item.trimEnd : duration || 1;

  useEffect(
    () => () => {
      pauseVideo(item.assetId);
    },
    [item.assetId],
  );

  function toggle() {
    if (playing) {
      pauseVideo(item.assetId);
      setPlaying(false);
      return;
    }
    seekVideo(item.assetId, item.trimStart);
    playVideo(item.assetId, item.muted, item.speed, item.volume);
    setPlaying(true);
  }

  return (
    <>
      <Section title="برش ویدئو" hint="فقط همین بازه در کمیک پخش می‌شود.">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" onClick={toggle} aria-label="پخش نمونه">
            {playing ? <Pause /> : <Play />}
          </Button>
          <div className="min-w-0 flex-1">
            <Slider
              min={0}
              max={Math.max(0.2, duration || 1)}
              step={0.05}
              value={[item.trimStart, end]}
              onValueChange={([a, b]) => {
                const start = Math.min(a, b);
                const stop = Math.max(a, b);
                patchVideo({ trimStart: start, trimEnd: stop });
                seekVideo(item.assetId, start);
              }}
            />
          </div>
        </div>
        <div dir="ltr" className="num flex justify-between text-[11px] text-muted">
          <span>{item.trimStart.toFixed(1)}s</span>
          <span>{end.toFixed(1)}s</span>
        </div>
      </Section>

      <Section title="صدا و سرعت">
        <Row label="سرعت پخش" value={`${item.speed.toFixed(2)}×`}>
          <Slider
            min={25}
            max={300}
            value={[Math.round(item.speed * 100)]}
            onValueChange={([v]) => patchVideo({ speed: v / 100 })}
          />
        </Row>
        <Row label="بلندی صدا" value={`${Math.round(item.volume * 100)}٪`}>
          <Slider
            min={0}
            max={100}
            value={[Math.round(item.volume * 100)]}
            onValueChange={([v]) => patchVideo({ volume: v / 100 })}
          />
        </Row>
        <Button
          variant={item.muted ? "default" : "outline"}
          size="sm"
          className="w-full"
          onClick={() => patchVideo({ muted: !item.muted })}
        >
          {item.muted ? <VolumeX /> : <Volume2 />}
          {item.muted ? "بی‌صدا است" : "بی‌صدا کن"}
        </Button>
      </Section>
    </>
  );
}

function ColorPanel({
  adjust,
}: {
  adjust: { brightness: number; contrast: number; saturate: number; warmth: number };
}) {
  const setAdjust = useEasy((s) => s.setAdjust);
  return (
    <>
      <Section title="حال‌وهوا" hint="یکی را بزن، بعد با لغزنده‌ها دقیقش کن.">
        <div className="grid grid-cols-3 gap-1.5">
          {COLOR_PRESETS.map((p) => {
            const active =
              Math.abs(p.a.brightness - adjust.brightness) < 0.01 &&
              Math.abs(p.a.contrast - adjust.contrast) < 0.01 &&
              Math.abs(p.a.saturate - adjust.saturate) < 0.01 &&
              Math.abs(p.a.warmth - adjust.warmth) < 0.01;
            return (
              <button
                key={p.n}
                type="button"
                onClick={() => setAdjust(p.a)}
                className={cn(
                  "tap h-10 rounded-lg text-xs font-medium",
                  active
                    ? "bg-brand/15 text-brand shadow-[0_0_0_1.5px_var(--color-brand)]"
                    : "bg-elevated text-muted shadow-[var(--shadow-border)] hover:text-fg",
                )}
              >
                {p.n}
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="تنظیم دستی">
        <Row label="روشنایی" value={`${Math.round(adjust.brightness * 100)}٪`}>
          <Slider
            min={40}
            max={180}
            value={[Math.round(adjust.brightness * 100)]}
            onValueChange={([v]) => setAdjust({ brightness: v / 100 })}
          />
        </Row>
        <Row label="کنتراست" value={`${Math.round(adjust.contrast * 100)}٪`}>
          <Slider
            min={40}
            max={220}
            value={[Math.round(adjust.contrast * 100)]}
            onValueChange={([v]) => setAdjust({ contrast: v / 100 })}
          />
        </Row>
        <Row label="اشباع رنگ" value={`${Math.round(adjust.saturate * 100)}٪`}>
          <Slider
            min={0}
            max={200}
            value={[Math.round(adjust.saturate * 100)]}
            onValueChange={([v]) => setAdjust({ saturate: v / 100 })}
          />
        </Row>
        <Row label="گرمی رنگ" value={`${Math.round(adjust.warmth * 100)}`}>
          <Slider
            min={-100}
            max={100}
            value={[Math.round(adjust.warmth * 100)]}
            onValueChange={([v]) => setAdjust({ warmth: v / 100 })}
          />
        </Row>
      </Section>
    </>
  );
}

function BubblePanel({ selected }: { selected: BubbleItem | null }) {
  const addBubble = useEasy((s) => s.addBubble);
  const patchBubble = useEasy((s) => s.patchBubble);
  const removeBubble = useEasy((s) => s.removeBubble);

  return (
    <>
      <Section title="حباب تازه" hint="یکی را بزن تا روی تصویر بیفتد، بعد جابه‌جا و بزرگش کن.">
        <div className="grid grid-cols-3 gap-1.5">
          {BUBBLE_KINDS.map((b) => (
            <button
              key={b.k}
              type="button"
              onClick={() => addBubble(b.k)}
              className="tap h-10 rounded-lg bg-elevated text-xs font-medium text-fg shadow-[var(--shadow-border)] hover:bg-overlay"
            >
              {b.n}
            </button>
          ))}
        </div>
      </Section>

      {!selected ? (
        <p className="rounded-xl bg-surface p-3 text-[11px] leading-relaxed text-muted shadow-[var(--shadow-border)]">
          یک حباب روی تصویر بزن تا تنظیماتش اینجا باز شود.
        </p>
      ) : (
        <>
          <Section title="متن حباب">
            <Textarea
              rows={3}
              value={selected.text}
              placeholder="اینجا بنویس…"
              onChange={(e) => patchBubble(selected.id, { text: e.target.value })}
            />
            <div className="flex gap-1">
              {(["right", "center", "left"] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => patchBubble(selected.id, { align: a })}
                  className={cn(
                    "tap h-9 flex-1 rounded-md text-xs font-medium",
                    selected.align === a
                      ? "bg-brand/15 text-brand shadow-[0_0_0_1px_var(--color-brand)]"
                      : "bg-elevated text-muted",
                  )}
                >
                  {a === "right" ? "راست" : a === "center" ? "وسط" : "چپ"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => patchBubble(selected.id, { bold: !selected.bold })}
                className={cn(
                  "tap h-9 w-11 rounded-md text-xs font-bold",
                  selected.bold
                    ? "bg-brand/15 text-brand shadow-[0_0_0_1px_var(--color-brand)]"
                    : "bg-elevated text-muted",
                )}
              >
                B
              </button>
            </div>
            <Row label="اندازهٔ متن" value={`${Math.round(selected.font)}`}>
              <Slider
                min={14}
                max={120}
                value={[Math.round(selected.font)]}
                onValueChange={([v]) => patchBubble(selected.id, { font: v })}
              />
            </Row>
          </Section>

          <Section title="ظاهر حباب" hint="از شیشه‌ای تا شب — رنگ متن هم با هم عوض می‌شود.">
            <div className="grid grid-cols-3 gap-1.5">
              {BUBBLE_SKINS.map((skin) => {
                const active =
                  selected.fill.toLowerCase() === skin.fill.toLowerCase() &&
                  Math.abs((selected.alpha ?? 1) - skin.alpha) < 0.02;
                return (
                  <button
                    key={skin.n}
                    type="button"
                    onClick={() =>
                      patchBubble(selected.id, {
                        fill: skin.fill,
                        color: skin.color,
                        alpha: skin.alpha,
                        stroke: skin.stroke,
                      })
                    }
                    className={cn(
                      "tap flex h-11 items-center justify-center rounded-lg text-[11px] font-medium",
                      active
                        ? "shadow-[0_0_0_1.5px_var(--color-brand)]"
                        : "shadow-[var(--shadow-border)]",
                    )}
                    style={{
                      background: skin.alpha === 0 ? "transparent" : skin.fill,
                      color: skin.alpha === 0 ? "var(--color-muted)" : skin.color,
                      opacity: skin.alpha === 0 ? 1 : Math.max(0.45, skin.alpha),
                    }}
                  >
                    {skin.n}
                  </button>
                );
              })}
            </div>
            <Row label="شفافیت حباب" value={`${Math.round((selected.alpha ?? 1) * 100)}٪`}>
              <Slider
                min={0}
                max={100}
                value={[Math.round((selected.alpha ?? 1) * 100)]}
                onValueChange={([v]) => patchBubble(selected.id, { alpha: v / 100 })}
              />
            </Row>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="mb-1 block text-[11px] text-muted">رنگ حباب</span>
                <input
                  type="color"
                  value={selected.fill}
                  onChange={(e) => patchBubble(selected.id, { fill: e.target.value })}
                  className="h-10 w-full"
                />
              </div>
              <div>
                <span className="mb-1 block text-[11px] text-muted">رنگ متن</span>
                <input
                  type="color"
                  value={selected.color}
                  onChange={(e) => patchBubble(selected.id, { color: e.target.value })}
                  className="h-10 w-full"
                />
              </div>
            </div>
            <Row label="ضخامت خط" value={`${Math.round(selected.stroke)}`}>
              <Slider
                min={0}
                max={16}
                value={[Math.round(selected.stroke)]}
                onValueChange={([v]) => patchBubble(selected.id, { stroke: v })}
              />
            </Row>
            {selected.kind !== "caption" && selected.kind !== "none" && (
              <Row label="طول دنباله" value={`${Math.round(selected.tail)}`}>
                <Slider
                  min={20}
                  max={320}
                  value={[Math.round(selected.tail)]}
                  onValueChange={([v]) => patchBubble(selected.id, { tail: v })}
                />
              </Row>
            )}
            <Button
              variant="destructive"
              size="sm"
              className="w-full"
              onClick={() => removeBubble(selected.id)}
            >
              <Trash2 /> حذف این حباب
            </Button>
          </Section>
        </>
      )}
    </>
  );
}

function ShotStrip({
  shots,
  activeId,
  onPick,
}: {
  shots: EasyShot[];
  activeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rail-x rail-fade no-scrollbar h-[74px] shrink-0 items-stretch py-1.5">
      {shots.map((s, i) => {
        const active = s.id === activeId;
        const bubbles = s.frame.items.filter((it: ComicItem) => it.type === "bubble").length;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={cn(
              "tap relative aspect-square h-full shrink-0 overflow-hidden rounded-lg bg-elevated",
              active ? "shadow-[0_0_0_1.5px_var(--color-brand)]" : "shadow-[var(--shadow-border)]",
            )}
          >
            {hasThumb(s.assetId) ? (
              <img src={thumbUrl(s.assetId)} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-muted">
                <Film className="size-4" />
              </span>
            )}
            <span className="num absolute top-1 start-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-semibold">
              {i + 1}
            </span>
            {s.kind === "video" && (
              <span className="absolute bottom-1 start-1 grid size-4 place-items-center rounded-full bg-bg/80 text-brand">
                <Film className="size-2.5" />
              </span>
            )}
            {bubbles > 0 && (
              <span className="absolute bottom-1 end-1 flex items-center gap-0.5 rounded-full bg-bg/80 px-1.5 text-[10px]">
                <MessageCircle className="size-2.5" />
                <span className="num">{bubbles}</span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
