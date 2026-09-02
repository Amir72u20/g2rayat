import { useEffect, useRef, useState } from "react";
import {
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
import { thumbUrl } from "@/lib/comic/db";
import { getMediaBag, pauseVideo, playVideo, seekVideo } from "@/lib/comic/media-cache";
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
  const touchFrame = useEasy((s) => s.touchFrame);
  const [tool, setTool] = useState<Tool>("crop");
  const drag = useRef<Drag | null>(null);

  const shot = shots.find((s) => s.id === activeShotId) ?? shots[0] ?? null;
  const video = shot ? shotVideo(shot) : null;

  // A clip's own tab replaces the crop tab's job for timing and sound.
  useEffect(() => {
    if (!video && tool === "clip") setTool("crop");
  }, [video, tool]);

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

  function onDown(pt: ScenePoint) {
    const sel = selected;
    if (sel) {
      const corner = resizeCorner(pt, sel, pt.hs);
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
      selectBubble(hit.id);
      drag.current = { mode: "move", id: hit.id, corner: null, last: pt };
      return;
    }
    // Nothing under the finger: pan the picture inside its frame.
    selectBubble(null);
    drag.current = { mode: "crop", id: null, corner: null, last: pt };
  }

  function onMove(pt: ScenePoint, e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !shot) return;
    const dx = pt.x - d.last.x;
    const dy = pt.y - d.last.y;
    d.last = pt;
    if (d.mode === "crop") {
      const media = shotMedia(shot);
      if (media) panCrop(media, dx, dy);
      touchFrame();
      return;
    }
    const it = frame.items.find((i) => i.id === d.id);
    if (!it) return;
    if (d.mode === "move") moveItem(it, dx, dy, frame);
    else if (d.mode === "tail" && it.type === "bubble") {
      it.tx += dx;
      it.ty += dy;
    } else if (d.mode === "rotate") applyRotate(it, pt, e.shiftKey);
    else if (d.mode === "resize" && d.corner) applyResize(it, d.corner, dx, dy, null);
    clampItem(it, frame);
    touchFrame();
  }

  function onUp() {
    drag.current = null;
  }

  const media = shotMedia(shot);
  const adjust = media?.adjust ?? { brightness: 1, contrast: 1, saturate: 1, warmth: 0 };

  const tools: { value: Tool; label: React.ReactNode }[] = [
    {
      value: "crop",
      label: (
        <span className="flex items-center gap-1.5">
          <Crop />
          قاب
        </span>
      ),
    },
    ...(video
      ? [
          {
            value: "clip" as Tool,
            label: (
              <span className="flex items-center gap-1.5">
                <Film />
                ویدئو
              </span>
            ),
          },
        ]
      : []),
    {
      value: "color",
      label: (
        <span className="flex items-center gap-1.5">
          <Palette />
          رنگ
        </span>
      ),
    },
    {
      value: "bubble",
      label: (
        <span className="flex items-center gap-1.5">
          <MessageCircle />
          حباب
        </span>
      ),
    },
  ];

  const panel = (
    <>
      {tool === "crop" && <CropPanel shot={shot} />}
      {tool === "clip" && video && <ClipPanel item={video} />}
      {tool === "color" && <ColorPanel adjust={adjust} />}
      {tool === "bubble" && <BubblePanel selected={selected} />}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 lg:grid lg:h-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-4">
      {/* Zone one: the frame itself, which never scrolls away. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:flex-none">
        <div className="material min-h-0 flex-1 overflow-hidden rounded-2xl bg-elevated p-2 lg:h-[60dvh] lg:flex-none">
          <div className="checker size-full overflow-hidden rounded-xl">
            <FrameCanvas
              page={frame}
              tick={tick}
              selectedId={selectedBubbleId}
              onScenePointerDown={onDown}
              onScenePointerMove={onMove}
              onScenePointerUp={onUp}
            />
          </div>
        </div>
        <p className="hidden text-center text-[11px] text-muted sm:block">
          {selected
            ? "حباب را بکش تا جابه‌جا شود · گوشه‌ها اندازه · نقطهٔ نوک، دنبالهٔ حباب"
            : "روی تصویر بکش تا داخل قاب جابه‌جا شود"}
        </p>

        {/* Zone two: the film strip. */}
        <ShotStrip shots={shots} activeId={shot.id} onPick={setActiveShot} />
      </div>

      {/* Zone three: tools — a fixed, scrollable panel on a phone; a column on
          a desktop. Either way the frame above stays visible. */}
      <div className="flex shrink-0 flex-col gap-2 lg:gap-3">
        <Segmented
          ariaLabel="ابزار"
          value={tool}
          onChange={setTool}
          className="w-full"
          options={tools}
        />
        <div className="max-h-[34dvh] space-y-3 overflow-y-auto overscroll-contain pb-1 lg:max-h-none lg:overflow-visible">
          {panel}
        </div>
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
    <div className="rail-x rail-fade no-scrollbar shrink-0 items-stretch py-1">
      {shots.map((s, i) => {
        const active = s.id === activeId;
        const bubbles = s.frame.items.filter((it: ComicItem) => it.type === "bubble").length;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={cn(
              "tap relative w-16 shrink-0 overflow-hidden rounded-lg bg-elevated sm:w-20",
              active ? "shadow-[0_0_0_1.5px_var(--color-brand)]" : "shadow-[var(--shadow-border)]",
            )}
          >
            {thumbUrl(s.assetId) ? (
              <img src={thumbUrl(s.assetId)} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <span className="grid aspect-square w-full place-items-center text-muted">
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
