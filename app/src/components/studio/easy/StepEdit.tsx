import { useRef, useState } from "react";
import {
  Crop,
  FlipHorizontal,
  FlipVertical,
  MessageCircle,
  Palette,
  RotateCcw,
  Trash2,
  Type,
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
import { FRAME_RATIOS, shotImage, type EasyShot } from "@/lib/comic/easy";
import { useEasy } from "@/lib/comic/easy-store";
import { thumbUrl } from "@/lib/comic/db";
import type { BubbleItem, BubbleKind, ComicItem } from "@/lib/comic/types";
import { cn } from "@/lib/utils";
import { FrameCanvas, type ScenePoint } from "./FrameCanvas";

type Tool = "crop" | "color" | "bubble";

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

  if (!shot) {
    return (
      <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
        اول در مرحلهٔ قبل چند عکس انتخاب کن.
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
    if (!d) return;
    const dx = pt.x - d.last.x;
    const dy = pt.y - d.last.y;
    d.last = pt;
    if (d.mode === "crop") {
      const img = shotImage(shot!);
      if (img) panCrop(img, dx, dy);
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

  const img = shotImage(shot);
  const adjust = img?.adjust ?? { brightness: 1, contrast: 1, saturate: 1, warmth: 0 };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="space-y-3">
        <div className="material overflow-hidden rounded-2xl bg-elevated p-2 [--frame-max:40dvh] sm:[--frame-max:48dvh] lg:[--frame-max:62dvh]">
          <div className="checker overflow-hidden rounded-xl">
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
        <p className="text-center text-[11px] text-muted">
          {selected
            ? "حباب را بکش تا جابه‌جا شود · گوشه‌ها اندازه · نقطهٔ نوک، دنبالهٔ حباب"
            : "روی عکس بکش تا داخل قاب جابه‌جا شود · با «برش» بزرگ‌نمایی را عوض کن"}
        </p>

        <ShotStrip shots={shots} activeId={shot.id} onPick={setActiveShot} />
      </div>

      <div className="space-y-3">
        <Segmented
          ariaLabel="ابزار"
          value={tool}
          onChange={setTool}
          className="w-full"
          options={[
            {
              value: "crop",
              label: (
                <span className="flex items-center gap-1.5">
                  <Crop />
                  برش
                </span>
              ),
            },
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
          ]}
        />

        {tool === "crop" && <CropPanel shot={shot} />}
        {tool === "color" && <ColorPanel adjust={adjust} />}
        {tool === "bubble" && <BubblePanel selected={selected} />}
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
  const img = shotImage(shot);
  const zoom = img?.zoom ?? 1;

  return (
    <>
      <Section
        title="قاب عکس"
        hint="نسبت قاب را انتخاب کن؛ پنل کمیک بعداً خودش با همین نسبت ساخته می‌شود."
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
          <Button variant="outline" size="sm" onClick={() => patchImage({ flipX: !img?.flipX })}>
            <FlipHorizontal /> افقی
          </Button>
          <Button variant="outline" size="sm" onClick={() => patchImage({ flipY: !img?.flipY })}>
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
      <Section title="حباب تازه" hint="یکی را بزن تا روی عکس بیفتد، بعد جابه‌جا و بزرگش کن.">
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
          یک حباب روی عکس بزن تا تنظیماتش اینجا باز شود.
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
    <div className="rail-x rail-fade no-scrollbar items-stretch py-1">
      {shots.map((s, i) => {
        const active = s.id === activeId;
        const bubbles = s.frame.items.filter((it: ComicItem) => it.type === "bubble").length;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            className={cn(
              "tap relative w-20 shrink-0 overflow-hidden rounded-lg bg-elevated",
              active ? "shadow-[0_0_0_1.5px_var(--color-brand)]" : "shadow-[var(--shadow-border)]",
            )}
          >
            {thumbUrl(s.assetId) ? (
              <img src={thumbUrl(s.assetId)} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <span className="grid aspect-square w-full place-items-center text-[10px] text-muted">
                <Type className="size-4" />
              </span>
            )}
            <span className="num absolute top-1 start-1 rounded-full bg-bg/80 px-1.5 text-[10px] font-semibold">
              {i + 1}
            </span>
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
