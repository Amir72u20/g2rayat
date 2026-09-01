import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FlipHorizontal,
  FlipVertical,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { COMIC_FONTS } from "@/lib/comic/fonts";
import { itemLabel } from "@/lib/comic/factory";
import { useStudio } from "@/lib/comic/store";
import {
  PAGE_SIZES,
  LANGUAGES,
  type BubbleKind,
  type ComicItem,
  type InspectorTab,
  type PanelKind,
  type VideoItem,
} from "@/lib/comic/types";
import { LayoutGrid, PageBackgroundPicker, PanelKindGrid } from "./ComicBits";
import {
  loadVideoAsset,
  playVideo,
  pauseVideo,
  seekVideo,
  getMediaBag,
} from "@/lib/comic/media-cache";
import { thumbUrl, mediaUrl } from "@/lib/comic/db";
import { cn } from "@/lib/utils";

const TABS: { id: InspectorTab; label: string }[] = [
  { id: "props", label: "ویژگی" },
  { id: "layers", label: "لایه" },
  { id: "pages", label: "صفحه" },
  { id: "export", label: "خروجی" },
];

export function Inspector({
  onPickFiles,
  onExportPage,
  onExportAll,
  onRead,
  className,
  hideTabs,
  mode = "full",
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string, extra?: string) => void;
  onExportPage: () => void;
  onExportAll: () => void;
  onRead: () => void;
  className?: string;
  hideTabs?: boolean;
  mode?: "full" | "style" | "layers";
}) {
  const tab = useStudio((s) => s.inspectorTab);
  const setTab = useStudio((s) => s.setTab);
  const page = useStudio((s) => s.page());

  if (mode === "style") {
    return (
      <div className={cn("min-h-0", className)}>
        <SelectionProperties onPickFiles={onPickFiles} />
      </div>
    );
  }
  if (mode === "layers") {
    return (
      <div className={cn("min-h-0", className)}>
        <LayersPane />
      </div>
    );
  }

  return (
    <aside className={cn("flex min-h-0 flex-col bg-surface", className)}>
      <div
        className={cn(
          "no-scrollbar gap-1 overflow-x-auto border-b border-line px-2 py-2",
          hideTabs ? "hidden" : "hidden lg:flex",
        )}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`tap h-9 shrink-0 rounded-md px-3 text-xs font-medium ${
              tab === t.id ? "bg-brand/15 text-brand" : "text-muted hover:bg-elevated hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!page ? (
          <p className="text-sm text-muted">صفحه‌ای برای ویرایش نیست.</p>
        ) : (
          <>
            {tab === "props" && <SelectionProperties onPickFiles={onPickFiles} />}
            {tab === "pages" && <PagesPane onPickFiles={onPickFiles} />}
            {tab === "layers" && <LayersPane />}
            {tab === "export" && (
              <ExportPane onExportPage={onExportPage} onExportAll={onExportAll} onRead={onRead} />
            )}
          </>
        )}
      </div>
    </aside>
  );
}

function SelectionProperties({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string, extra?: string) => void;
}) {
  const selected = useStudio((s) => s.selected());
  const patchItem = useStudio((s) => s.patchItem);
  const addBubble = useStudio((s) => s.addBubble);
  const addText = useStudio((s) => s.addText);
  const drawColor = useStudio((s) => s.drawColor);
  const drawWidth = useStudio((s) => s.drawWidth);
  const setDrawColor = useStudio((s) => s.setDrawColor);
  const setDrawWidth = useStudio((s) => s.setDrawWidth);

  if (!selected) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          قاب را بگیر و جابه‌جا کن. برای قاب تازه، چیدمان بزن یا روی صفحه بکش.
        </p>
        <PageBackgroundPicker onPickImage={() => onPickFiles("image", undefined, "bg")} />
        <div>
          <div className="mb-2 text-xs font-semibold">چیدمان قاب‌ها</div>
          <LayoutGrid />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onPickFiles("image")}>
            تصویر
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPickFiles("video")}>
            ویدئو
          </Button>
          <Button variant="outline" size="sm" onClick={() => onPickFiles("audio")}>
            صدا
          </Button>
          <Button variant="outline" size="sm" onClick={addText}>
            متن
          </Button>
          <Button variant="outline" size="sm" onClick={() => addBubble("round")}>
            حباب
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-muted">{itemLabel(selected)}</div>
      {(selected.type === "bubble" || selected.type === "text") && <BubbleFields item={selected} />}
      {selected.type === "image" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPickFiles("image", selected.panelId, undefined)}
          >
            جایگزینی تصویر
          </Button>
          <p className="text-xs text-muted">
            روی بوم داخل قاب بکش تا عکس جابه‌جا شود. دو انگشت بزرگ‌نمایی است.
          </p>
          <MediaCrop item={selected} />
        </>
      )}
      {selected.type === "video" && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPickFiles("video", selected.panelId)}
          >
            جایگزینی ویدئو
          </Button>
          <VideoEditor item={selected} />
          <MediaCrop item={selected} />
        </>
      )}
      {selected.type === "panel" && (
        <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
          <div className="text-xs font-semibold">شکل قاب</div>
          <PanelKindGrid
            value={selected.kind}
            onPick={(k: PanelKind) =>
              patchItem(selected.id, { kind: k } as Partial<ComicItem>, true)
            }
          />
          <p className="text-[11px] text-muted">
            قاب را روی صفحه بکش. گوشه‌ها اندازه را عوض می‌کنند.
          </p>
          <Range
            label="ضخامت خط"
            value={selected.stroke}
            min={0}
            max={24}
            onChange={(v) => patchItem(selected.id, { stroke: v } as Partial<ComicItem>, false)}
          />
          <Range
            label="گردی گوشه"
            value={selected.radius}
            min={0}
            max={60}
            onChange={(v) => patchItem(selected.id, { radius: v } as Partial<ComicItem>, false)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="رنگ خط">
              <input
                type="color"
                value={selected.strokeColor}
                onChange={(e) =>
                  patchItem(
                    selected.id,
                    { strokeColor: e.target.value } as Partial<ComicItem>,
                    false,
                  )
                }
                className="h-11 w-full"
              />
            </Field>
            <Field label="رنگ داخل">
              <input
                type="color"
                value={selected.fill}
                onChange={(e) =>
                  patchItem(selected.id, { fill: e.target.value } as Partial<ComicItem>, false)
                }
                className="h-11 w-full"
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={() => onPickFiles("image", selected.id)}>
              تصویر داخل قاب
            </Button>
            <Button variant="outline" size="sm" onClick={() => onPickFiles("video", selected.id)}>
              ویدئو داخل قاب
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPickFiles("audio", undefined, "panel-audio")}
            >
              صدای قاب
            </Button>
          </div>
        </div>
      )}
      {selected.type === "shape" && (
        <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
          <Range
            label="ضخامت خط"
            value={selected.stroke}
            min={0}
            max={24}
            onChange={(v) => patchItem(selected.id, { stroke: v } as Partial<ComicItem>, false)}
          />
          <Range
            label="گردی"
            value={selected.radius}
            min={0}
            max={80}
            onChange={(v) => patchItem(selected.id, { radius: v } as Partial<ComicItem>, false)}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field label="پر">
              <input
                type="color"
                value={selected.fill}
                onChange={(e) =>
                  patchItem(selected.id, { fill: e.target.value } as Partial<ComicItem>, false)
                }
                className="h-11 w-full"
              />
            </Field>
            <Field label="خط">
              <input
                type="color"
                value={selected.strokeColor}
                onChange={(e) =>
                  patchItem(
                    selected.id,
                    { strokeColor: e.target.value } as Partial<ComicItem>,
                    false,
                  )
                }
                className="h-11 w-full"
              />
            </Field>
          </div>
        </div>
      )}
      {selected.type === "drawing" && (
        <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
          <Field label="رنگ قلم">
            <input
              type="color"
              value={selected.color}
              onChange={(e) => {
                setDrawColor(e.target.value);
                patchItem(selected.id, { color: e.target.value } as Partial<ComicItem>, false);
              }}
              className="h-11 w-full"
            />
          </Field>
          <Range
            label="ضخامت"
            value={selected.width}
            min={2}
            max={36}
            onChange={(v) => {
              setDrawWidth(v);
              patchItem(selected.id, { width: v } as Partial<ComicItem>, false);
            }}
          />
          <p className="text-[11px] text-muted">
            رنگ پیش‌فرض قلم: {drawColor} · {drawWidth}px
          </p>
        </div>
      )}
      <details className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold marker:hidden">
          جایگاه و چرخش
        </summary>
        <div className="mt-3 space-y-2">
          <Range
            label="شفافیت"
            value={Math.round((selected.opacity ?? 1) * 100)}
            min={0}
            max={100}
            onChange={(v) =>
              patchItem(selected.id, { opacity: v / 100 } as Partial<ComicItem>, false)
            }
          />
          {selected.type !== "panel" && (
            <Range
              label="چرخش"
              value={selected.rot || 0}
              min={-180}
              max={180}
              onChange={(v) => patchItem(selected.id, { rot: v } as Partial<ComicItem>, false)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <Input
                type="number"
                value={Math.round(selected.x)}
                onChange={(e) =>
                  patchItem(selected.id, { x: Number(e.target.value) } as Partial<ComicItem>, false)
                }
              />
            </Field>
            <Field label="Y">
              <Input
                type="number"
                value={Math.round(selected.y)}
                onChange={(e) =>
                  patchItem(selected.id, { y: Number(e.target.value) } as Partial<ComicItem>, false)
                }
              />
            </Field>
            <Field label="W">
              <Input
                type="number"
                value={Math.round(selected.w)}
                onChange={(e) =>
                  patchItem(selected.id, { w: Number(e.target.value) } as Partial<ComicItem>, false)
                }
              />
            </Field>
            <Field label="H">
              <Input
                type="number"
                value={Math.round(selected.h)}
                onChange={(e) =>
                  patchItem(selected.id, { h: Number(e.target.value) } as Partial<ComicItem>, false)
                }
              />
            </Field>
          </div>
        </div>
      </details>
      <Button className="w-full lg:hidden" onClick={() => useStudio.getState().setSheet(null)}>
        ثبت
      </Button>
    </div>
  );
}

function BubbleFields({ item }: { item: Extract<ComicItem, { type: "bubble" | "text" }> }) {
  const patchItem = useStudio((s) => s.patchItem);
  return (
    <>
      <Field label="متن">
        <Textarea
          rows={3}
          value={item.text}
          onChange={(e) =>
            patchItem(item.id, { text: e.target.value } as Partial<ComicItem>, false)
          }
        />
      </Field>
      <Button
        className="w-full"
        onClick={() => {
          useStudio.getState().setSheet(null);
        }}
      >
        ثبت متن
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Field label="فونت">
          <Select
            value={item.fontFamily}
            onChange={(e) =>
              patchItem(item.id, { fontFamily: e.target.value } as Partial<ComicItem>, false)
            }
          >
            {COMIC_FONTS.map((f) => (
              <option key={f.v} value={f.v}>
                {f.n}
              </option>
            ))}
          </Select>
        </Field>
        <Range
          label="اندازه"
          value={item.font}
          min={12}
          max={96}
          onChange={(v) => patchItem(item.id, { font: v } as Partial<ComicItem>, false)}
        />
      </div>
      <div className="flex gap-1">
        <Toggle
          on={!!item.bold}
          onClick={() => patchItem(item.id, { bold: !item.bold } as Partial<ComicItem>, false)}
        >
          B
        </Toggle>
        <Toggle
          on={!!item.italic}
          onClick={() => patchItem(item.id, { italic: !item.italic } as Partial<ComicItem>, false)}
        >
          I
        </Toggle>
        {(["right", "center", "left"] as const).map((a) => (
          <Toggle
            key={a}
            on={item.align === a}
            onClick={() => patchItem(item.id, { align: a } as Partial<ComicItem>, false)}
          >
            {a === "right" ? "راست" : a === "center" ? "وسط" : "چپ"}
          </Toggle>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="رنگ متن">
          <input
            type="color"
            value={item.color}
            onChange={(e) =>
              patchItem(item.id, { color: e.target.value } as Partial<ComicItem>, false)
            }
            className="h-11 w-full"
          />
        </Field>
        {item.type === "bubble" && (
          <Field label="رنگ حباب">
            <input
              type="color"
              value={item.fill}
              onChange={(e) =>
                patchItem(item.id, { fill: e.target.value } as Partial<ComicItem>, false)
              }
              className="h-11 w-full"
            />
          </Field>
        )}
      </div>
      {item.type === "bubble" && (
        <>
          <Range
            label="ضخامت خط"
            value={item.stroke}
            min={0}
            max={20}
            onChange={(v) => patchItem(item.id, { stroke: v } as Partial<ComicItem>, false)}
          />
          <Range
            label="گردی"
            value={item.radius}
            min={0}
            max={80}
            onChange={(v) => patchItem(item.id, { radius: v } as Partial<ComicItem>, false)}
          />
          <Range
            label="طول دنباله"
            value={item.tail}
            min={20}
            max={240}
            onChange={(v) => patchItem(item.id, { tail: v } as Partial<ComicItem>, false)}
          />
        </>
      )}
    </>
  );
}

function PagesPane({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string, extra?: string) => void;
}) {
  const project = useStudio((s) => s.project)!;
  const page = useStudio((s) => s.page())!;
  const renamePage = useStudio((s) => s.renamePage);
  const setDescription = useStudio((s) => s.setDescription);
  const setDirection = useStudio((s) => s.setDirection);
  const setPageSize = useStudio((s) => s.setPageSize);
  const touchPage = useStudio((s) => s.touchPage);
  const duplicatePage = useStudio((s) => s.duplicatePage);
  const deletePage = useStudio((s) => s.deletePage);

  const sizeId = PAGE_SIZES.find((s) => s.w === page.w && s.h === page.h)?.id ?? "custom";

  return (
    <div className="space-y-4">
      <Field label="نام این صفحه">
        <Input value={page.name} onChange={(e) => renamePage(e.target.value)} maxLength={40} />
      </Field>
      <Field label="توضیح کمیک">
        <Textarea
          value={project.description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="جهت خواندن">
          <Select
            value={project.readingDirection}
            onChange={(e) => setDirection(e.target.value as "rtl" | "ltr")}
          >
            <option value="rtl">راست به چپ</option>
            <option value="ltr">چپ به راست</option>
          </Select>
        </Field>
        <Field label="اندازه صفحه">
          <Select
            value={sizeId}
            onChange={(e) => {
              const s = PAGE_SIZES.find((x) => x.id === e.target.value);
              if (s) setPageSize(s.w, s.h);
            }}
          >
            {PAGE_SIZES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
            {sizeId === "custom" && <option value="custom">سفارشی</option>}
          </Select>
        </Field>
      </div>

      <section className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <PageBackgroundPicker onPickImage={() => onPickFiles("image", undefined, "bg")} />
        {page.background.assetId && (
          <div className="mt-2 space-y-2">
            <Range
              label="بزرگ‌نمایی"
              value={Math.round(page.background.zoom * 100)}
              min={100}
              max={300}
              onChange={(v) =>
                touchPage((p) => {
                  p.background.zoom = v / 100;
                }, false)
              }
            />
            <Range
              label="جابه‌جایی افقی"
              value={Math.round(page.background.x * 100)}
              min={-100}
              max={100}
              onChange={(v) =>
                touchPage((p) => {
                  p.background.x = v / 100;
                }, false)
              }
            />
            <Range
              label="جابه‌جایی عمودی"
              value={Math.round(page.background.y * 100)}
              min={-100}
              max={100}
              onChange={(v) =>
                touchPage((p) => {
                  p.background.y = v / 100;
                }, false)
              }
            />
          </div>
        )}
      </section>

      <AudioEditor onPickFiles={onPickFiles} />

      <details className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-semibold marker:hidden">
          تنظیمات پیشرفته صفحه
        </summary>
        <div className="mt-3 space-y-2">
          <label className="mb-2 flex items-center justify-between gap-2 text-sm">
            قفل کارگردان
            <Switch
              checked={page.playback.directorLock}
              onCheckedChange={(v) =>
                touchPage((p) => {
                  p.playback.directorLock = v;
                }, false)
              }
            />
          </label>
          <Range
            label="زمان پیش‌فرض قاب (ثانیه)"
            value={page.playback.defaultDelayMs / 1000}
            min={0.5}
            max={12}
            step={0.1}
            onChange={(v) =>
              touchPage((p) => {
                p.playback.defaultDelayMs = Math.round(v * 1000);
              }, false)
            }
          />
          <Field label="نمایش پیش‌فرض">
            <Select
              value={page.playback.defaultReveal}
              onChange={(e) =>
                touchPage((p) => {
                  p.playback.defaultReveal = e.target.value as "click" | "auto";
                }, false)
              }
            >
              <option value="click">با لمس</option>
              <option value="auto">خودکار</option>
            </Select>
          </Field>
        </div>
      </details>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={duplicatePage}>
          کپی صفحه
        </Button>
        <Button variant="destructive" className="flex-1" onClick={deletePage}>
          حذف صفحه
        </Button>
      </div>
    </div>
  );
}

export function AudioEditor({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string, extra?: string) => void;
}) {
  const page = useStudio((s) => s.page());
  const pageIndex = useStudio((s) => s.pageIndex);
  const pages = useStudio((s) => s.project?.pages ?? []);
  const touchPage = useStudio((s) => s.touchPage);
  const selected = useStudio((s) => s.selected());
  const assets = useStudio((s) => s.assets);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [listening, setListening] = useState(false);
  if (!page) return <p className="text-sm text-muted">صفحه‌ای باز نیست.</p>;
  const clip = page.playback.ambientAudio;
  const panelStory =
    selected &&
    (selected.type === "panel" || selected.type === "image" || selected.type === "video")
      ? selected.story
      : null;
  const audios = assets.filter((a) => a.kind === "audio");
  const clipMeta = clip ? assets.find((a) => a.id === clip.assetId) : null;

  function stopListen() {
    audioRef.current?.pause();
    setListening(false);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <div className="mb-2 text-xs font-semibold">موسیقی پس‌زمینه</div>
        <p className="mb-2 text-[11px] text-muted">
          فایل بگذار، بعد روی خط راست کنار صفحات دستگیره را بکش؛ تا همان صفحه پخش می‌شود.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => onPickFiles("audio")}>
            فایل از دستگاه
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!clip}
            onClick={() => {
              if (!clip) return;
              if (listening) {
                stopListen();
                return;
              }
              if (!audioRef.current) audioRef.current = new Audio();
              const a = audioRef.current;
              a.src = mediaUrl(clip.assetId);
              a.currentTime = clip.start;
              a.volume = clip.volume;
              a.onended = () => setListening(false);
              void a.play();
              setListening(true);
            }}
          >
            {listening ? "توقف" : "شنیدن"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!clip}
            onClick={() => {
              stopListen();
              touchPage((p) => {
                p.playback.ambientAudio = null;
              });
            }}
          >
            حذف
          </Button>
        </div>
        {clip && (
          <div className="mt-2 space-y-2">
            {clipMeta && <p className="truncate text-xs text-muted">{clipMeta.name}</p>}
            <div>
              <div className="mb-1.5 text-xs font-semibold">پخش تا کدام صفحه؟</div>
              <p className="mb-2 text-[11px] text-muted">
                همین موسیقی تا صفحه انتخاب‌شده ادامه پیدا می‌کند.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`tap h-11 rounded-full px-4 text-sm ${
                    !clip.throughPage || clip.throughPage === 0
                      ? "bg-brand text-brand-fg"
                      : "bg-bg text-fg shadow-[var(--shadow-border)]"
                  }`}
                  onClick={() =>
                    touchPage((p) => {
                      if (!p.playback.ambientAudio) return;
                      p.playback.ambientAudio.throughPage = 0;
                      p.playback.ambientAudio.continuePages = false;
                    }, false)
                  }
                >
                  فقط همین
                </button>
                {pages.map((_, i) =>
                  i > pageIndex ? (
                    <button
                      key={i}
                      type="button"
                      className={`tap h-11 min-w-11 rounded-full px-4 text-sm ${
                        clip.throughPage === i + 1
                          ? "bg-brand text-brand-fg"
                          : "bg-bg text-fg shadow-[var(--shadow-border)]"
                      }`}
                      onClick={() =>
                        touchPage((p) => {
                          if (!p.playback.ambientAudio) return;
                          p.playback.ambientAudio.throughPage = i + 1;
                          p.playback.ambientAudio.continuePages = false;
                        }, false)
                      }
                    >
                      تا {i + 1}
                    </button>
                  ) : null,
                )}
                <button
                  type="button"
                  className={`tap h-11 rounded-full px-4 text-sm ${
                    clip.throughPage === -1 || clip.continuePages
                      ? "bg-brand text-brand-fg"
                      : "bg-bg text-fg shadow-[var(--shadow-border)]"
                  }`}
                  onClick={() =>
                    touchPage((p) => {
                      if (!p.playback.ambientAudio) return;
                      p.playback.ambientAudio.throughPage = -1;
                      p.playback.ambientAudio.continuePages = true;
                    }, false)
                  }
                >
                  تا آخر
                </button>
              </div>
            </div>
            <Range
              label="بلندی"
              value={Math.round(clip.volume * 100)}
              min={0}
              max={100}
              onChange={(v) =>
                touchPage((p) => {
                  if (p.playback.ambientAudio) p.playback.ambientAudio.volume = v / 100;
                }, false)
              }
            />
            <p className="text-[11px] text-muted">
              تا کجا پخش شود را از خط راست کنار صفحات بکش. ثانیه‌ها لازم نیست.
            </p>
            <details className="rounded-md bg-bg p-2">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs text-muted marker:hidden">
                تنظیمات پیشرفته صدا
              </summary>
              <div className="mt-2 space-y-2">
                <Range
                  label="شروع (ثانیه)"
                  value={clip.start}
                  min={0}
                  max={120}
                  step={0.1}
                  onChange={(v) =>
                    touchPage((p) => {
                      if (p.playback.ambientAudio) p.playback.ambientAudio.start = v;
                    }, false)
                  }
                />
                <Range
                  label="پایان (۰ = تا آخر)"
                  value={clip.end}
                  min={0}
                  max={180}
                  step={0.1}
                  onChange={(v) =>
                    touchPage((p) => {
                      if (p.playback.ambientAudio) p.playback.ambientAudio.end = v;
                    }, false)
                  }
                />
                <Range
                  label="محو ورود (ثانیه)"
                  value={clip.fadeInMs / 1000}
                  min={0}
                  max={4}
                  step={0.05}
                  onChange={(v) =>
                    touchPage((p) => {
                      if (p.playback.ambientAudio)
                        p.playback.ambientAudio.fadeInMs = Math.round(v * 1000);
                    }, false)
                  }
                />
                <Range
                  label="محو خروج (ثانیه)"
                  value={clip.fadeOutMs / 1000}
                  min={0}
                  max={4}
                  step={0.05}
                  onChange={(v) =>
                    touchPage((p) => {
                      if (p.playback.ambientAudio)
                        p.playback.ambientAudio.fadeOutMs = Math.round(v * 1000);
                    }, false)
                  }
                />
              </div>
            </details>
            <label className="flex items-center justify-between gap-2 text-sm">
              در صفحه بعد ادامه بده
              <Switch
                checked={!!clip.continuePages || clip.throughPage === -1}
                onCheckedChange={(v) =>
                  touchPage((p) => {
                    if (p.playback.ambientAudio) {
                      p.playback.ambientAudio.continuePages = v;
                      p.playback.ambientAudio.throughPage = v ? -1 : 0;
                    }
                  }, false)
                }
              />
            </label>
          </div>
        )}
        {audios.length > 0 && (
          <div className="mt-3">
            <div className="mb-1.5 text-[11px] font-semibold text-muted">فایل‌های صدا</div>
            <div className="flex flex-col gap-1">
              {audios.slice(0, 12).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className="tap flex min-h-11 items-center justify-between rounded-lg bg-bg px-3 text-start text-sm shadow-[var(--shadow-border)] hover:bg-overlay"
                  onClick={() => useStudio.getState().placeAsset(a.id)}
                >
                  <span className="truncate">{a.name}</span>
                  {a.duration ? (
                    <span className="ms-2 shrink-0 font-mono text-[11px] text-muted">
                      {a.duration.toFixed(0)}ث
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      <section className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <div className="mb-2 text-xs font-semibold">صدای قاب انتخاب‌شده</div>
        <p className="mb-2 text-xs text-muted">یک قاب یا تصویر را انتخاب کن، بعد فایل صدا بگذار.</p>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPickFiles("audio", undefined, "panel-audio")}
            disabled={!selected}
          >
            صدای این قاب
          </Button>
          {panelStory?.audio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selected) return;
                useStudio
                  .getState()
                  .patchItem(
                    selected.id,
                    { story: { ...panelStory, audio: null } } as Partial<ComicItem>,
                    true,
                  );
              }}
            >
              حذف صدای قاب
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function FramesPane({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string) => void;
}) {
  const addShape = useStudio((s) => s.addShape);
  const setTool = useStudio((s) => s.setTool);
  const tool = useStudio((s) => s.tool);
  const selected = useStudio((s) => s.selected());
  const patchItem = useStudio((s) => s.patchItem);
  const snap = useStudio((s) => s.snap);
  const assets = useStudio((s) => s.assets);
  const fillEmptyPanels = useStudio((s) => s.fillEmptyPanels);

  const frame =
    selected &&
    (selected.type === "panel" || selected.type === "image" || selected.type === "shape")
      ? selected
      : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold">چیدمان قاب‌ها</div>
        <LayoutGrid />
        <p className="mt-1 text-[11px] text-muted">
          چیدمان تازه قاب‌های قبلی را جایگزین می‌کند؛ حباب‌ها می‌مانند.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button variant="outline" size="sm" onClick={() => onPickFiles("image")}>
          تصویر از دستگاه
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fillEmptyPanels(assets.filter((a) => a.kind === "image").map((a) => a.id))}
        >
          پرکردن قاب‌ها
        </Button>
      </div>

      <div className="rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
        <div className="mb-2 text-xs font-semibold">شکل و قلم</div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" onClick={() => addShape("rect")}>
            مستطیل
          </Button>
          <Button variant="outline" size="sm" onClick={() => addShape("round")}>
            گرد
          </Button>
          <Button variant="outline" size="sm" onClick={() => addShape("circle")}>
            دایره
          </Button>
          <Button variant="outline" size="sm" onClick={() => addShape("arrow")}>
            پیکان
          </Button>
          <Button
            variant={tool === "draw" ? "steel" : "outline"}
            size="sm"
            onClick={() => setTool(tool === "draw" ? "select" : "draw")}
          >
            قلم آزاد
          </Button>
        </div>
        <label className="mt-3 flex items-center justify-between gap-2 text-sm">
          چسبیدن به مرکز
          <Switch checked={snap} onCheckedChange={(v) => useStudio.setState({ snap: v })} />
        </label>
      </div>

      {frame && frame.type !== "shape" && (
        <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
          <div className="text-xs font-semibold">ظاهر قاب</div>
          {"stroke" in frame && (
            <Range
              label="ضخامت خط"
              value={frame.stroke}
              min={0}
              max={24}
              onChange={(v) => patchItem(frame.id, { stroke: v } as Partial<ComicItem>, false)}
            />
          )}
          {"radius" in frame && (
            <Range
              label="گردی گوشه"
              value={frame.radius}
              min={0}
              max={60}
              onChange={(v) => patchItem(frame.id, { radius: v } as Partial<ComicItem>, false)}
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            {"strokeColor" in frame && (
              <Field label="رنگ خط">
                <input
                  type="color"
                  value={frame.strokeColor}
                  onChange={(e) =>
                    patchItem(
                      frame.id,
                      { strokeColor: e.target.value } as Partial<ComicItem>,
                      false,
                    )
                  }
                  className="h-11 w-full"
                />
              </Field>
            )}
            {"fill" in frame && frame.type === "panel" && (
              <Field label="رنگ داخل">
                <input
                  type="color"
                  value={frame.fill}
                  onChange={(e) =>
                    patchItem(frame.id, { fill: e.target.value } as Partial<ComicItem>, false)
                  }
                  className="h-11 w-full"
                />
              </Field>
            )}
          </div>
        </div>
      )}

      {selected && (selected.type === "image" || selected.type === "video") && (
        <MediaCrop item={selected} />
      )}
      {selected &&
        (selected.type === "panel" || selected.type === "image" || selected.type === "video") &&
        selected.story && <PanelStoryCard item={selected} onPickFiles={onPickFiles} />}
    </div>
  );
}

function MediaCrop({ item }: { item: Extract<ComicItem, { type: "image" | "video" }> }) {
  const patchItem = useStudio((s) => s.patchItem);
  return (
    <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
      <div className="text-xs font-semibold">تنظیم داخل قاب</div>
      <p className="text-[11px] text-muted">
        کشیدن روی بوم جایش را عوض می‌کند. گوشه‌ها یا دو انگشت اندازه را عوض می‌کند.
      </p>
      <Range
        label="بزرگ‌نمایی"
        value={Math.round(item.zoom * 100)}
        min={50}
        max={400}
        onChange={(v) => patchItem(item.id, { zoom: v / 100 } as Partial<ComicItem>, false)}
      />
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => useStudio.getState().scaleSelectedMedia(1 / 1.22)}
        >
          کوچک‌تر
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => useStudio.getState().scaleSelectedMedia(1.22)}
        >
          بزرگ‌تر
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => useStudio.getState().toggleMediaFree()}
      >
        {item.free || !item.panelId ? "چسباندن به قاب" : "جدا کردن از قاب — روی صفحه"}
      </Button>
      <Range
        label="افقی"
        value={Math.round(item.cropX * 100)}
        min={-100}
        max={100}
        onChange={(v) => patchItem(item.id, { cropX: v / 100 } as Partial<ComicItem>, false)}
      />
      <Range
        label="عمودی"
        value={Math.round(item.cropY * 100)}
        min={-100}
        max={100}
        onChange={(v) => patchItem(item.id, { cropY: v / 100 } as Partial<ComicItem>, false)}
      />
      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => patchItem(item.id, { flipX: !item.flipX } as Partial<ComicItem>, true)}
        >
          <FlipHorizontal /> افقی
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => patchItem(item.id, { flipY: !item.flipY } as Partial<ComicItem>, true)}
        >
          <FlipVertical /> عمودی
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            patchItem(
              item.id,
              { fitMode: "fit", zoom: 1, cropX: 0, cropY: 0 } as Partial<ComicItem>,
              true,
            )
          }
        >
          کامل دیده شود
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            patchItem(
              item.id,
              { fitMode: "fill", zoom: 1, cropX: 0, cropY: 0 } as Partial<ComicItem>,
              true,
            )
          }
        >
          پرکردن قاب
        </Button>
      </div>
    </div>
  );
}

function PanelStoryCard({
  item,
  onPickFiles,
}: {
  item: ComicItem;
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string, extra?: string) => void;
}) {
  const patchItem = useStudio((s) => s.patchItem);
  const story = "story" in item ? item.story : null;
  if (!story) return null;
  return (
    <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
      <div className="text-xs font-semibold">نمایش این قاب در خواندن</div>
      <div className="grid grid-cols-3 gap-2">
        <Field label="نوبت">
          <Input
            type="number"
            min={1}
            max={99}
            value={story.order}
            onChange={(e) =>
              patchItem(
                item.id,
                { story: { ...story, order: Number(e.target.value) } } as Partial<ComicItem>,
                false,
              )
            }
          />
        </Field>
        <Field label="روش">
          <Select
            value={story.reveal}
            onChange={(e) =>
              patchItem(
                item.id,
                {
                  story: { ...story, reveal: e.target.value as "click" | "auto" },
                } as Partial<ComicItem>,
                false,
              )
            }
          >
            <option value="click">لمس</option>
            <option value="auto">خودکار</option>
          </Select>
        </Field>
        <Field label="ثانیه">
          <Input
            type="number"
            step={0.1}
            value={story.delayMs / 1000}
            onChange={(e) =>
              patchItem(
                item.id,
                {
                  story: { ...story, delayMs: Math.round(Number(e.target.value) * 1000) },
                } as Partial<ComicItem>,
                false,
              )
            }
          />
        </Field>
      </div>
      <div className="pt-1 text-xs font-semibold">صدای همین قاب</div>
      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPickFiles("audio", undefined, "panel-audio")}
        >
          فایل صدا
        </Button>
        {story.audio && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              patchItem(item.id, { story: { ...story, audio: null } } as Partial<ComicItem>, true)
            }
          >
            حذف صدا
          </Button>
        )}
      </div>
    </div>
  );
}

function MediaPane({
  onPickFiles,
}: {
  onPickFiles: (kind: "image" | "video" | "audio", panelId?: string) => void;
}) {
  const selected = useStudio((s) => s.selected());
  const assets = useStudio((s) => s.assets);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const video = selected?.type === "video" ? selected : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" onClick={() => onPickFiles("image")}>
          تصویر از دستگاه
        </Button>
        <Button variant="outline" size="sm" onClick={() => onPickFiles("video")}>
          ویدئو از دستگاه
        </Button>
        {video && (
          <Button variant="destructive" size="sm" onClick={deleteSelected}>
            <Trash2 /> حذف ویدئو
          </Button>
        )}
      </div>

      {video ? (
        <VideoEditor item={video} />
      ) : (
        <p className="text-sm text-muted">
          یک قاب را انتخاب کن و ویدئو یا تصویر اضافه کن. ویدئو داخل همان قاب برش و زمان‌بندی می‌شود.
        </p>
      )}

      {assets.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold">کتابخانه همین دستگاه</div>
          <div className="grid grid-cols-3 gap-1.5">
            {assets.slice(0, 18).map((a) => (
              <button
                key={a.id}
                type="button"
                className="tap aspect-square overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]"
                onClick={() => {
                  useStudio.getState().placeAsset(a.id);
                }}
                title={a.name}
              >
                {a.kind === "image" && thumbUrl(a.id) ? (
                  <img src={thumbUrl(a.id)} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-[10px] text-muted">
                    {a.kind}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VideoEditor({ item }: { item: VideoItem }) {
  const patchItem = useStudio((s) => s.patchItem);
  const [playing, setPlaying] = useState(false);

  loadVideoAsset(item.assetId);
  const v = getMediaBag().videos[item.assetId];
  const dur = item.duration || v?.duration || 0;
  const end = item.trimEnd > 0 ? item.trimEnd : dur || 1;

  return (
    <div className="space-y-2.5 rounded-xl bg-elevated p-3 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2 text-sm">
        <strong className="truncate">{item.name || "ویدئو"}</strong>
        <span className="font-mono text-xs text-muted">{dur.toFixed(1)} ث</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => {
            const next = !playing;
            setPlaying(next);
            if (next) {
              seekVideo(item.assetId, item.trimStart);
              playVideo(item.assetId, item.muted, item.speed, item.volume);
              useStudio.setState({ mediaTick: Date.now() });
            } else pauseVideo(item.assetId);
          }}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <div className="min-w-0 flex-1">
          <div className="mb-1 text-[11px] text-muted">بازه برش</div>
          <Slider
            min={0}
            max={Math.max(0.1, dur || 1)}
            step={0.05}
            value={[item.trimStart, end]}
            onValueChange={([a, b]) => {
              const start = Math.min(a, b);
              const stop = Math.max(a, b);
              patchItem(item.id, { trimStart: start, trimEnd: stop } as Partial<ComicItem>, false);
              seekVideo(item.assetId, start);
            }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted">
        <span>شروع {item.trimStart.toFixed(1)}ث</span>
        <span className="text-end">پایان {end.toFixed(1)}ث</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="شروع دقیق">
          <Input
            type="number"
            min={0}
            step={0.05}
            value={Number(item.trimStart.toFixed(2))}
            onChange={(e) => {
              const start = Math.max(0, Number(e.target.value) || 0);
              patchItem(item.id, { trimStart: Math.min(start, end) } as Partial<ComicItem>, false);
              seekVideo(item.assetId, start);
            }}
          />
        </Field>
        <Field label="پایان دقیق">
          <Input
            type="number"
            min={0}
            step={0.05}
            value={Number(end.toFixed(2))}
            onChange={(e) => {
              const stop = Math.max(item.trimStart + 0.05, Number(e.target.value) || 0);
              patchItem(item.id, { trimEnd: stop } as Partial<ComicItem>, false);
            }}
          />
        </Field>
      </div>
      <Field label="سرعت">
        <Select
          value={item.speed}
          onChange={(e) =>
            patchItem(item.id, { speed: Number(e.target.value) } as Partial<ComicItem>, false)
          }
        >
          {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </Select>
      </Field>
      <Range
        label="صدای ویدئو"
        value={Math.round(item.volume * 100)}
        min={0}
        max={100}
        onChange={(v) => patchItem(item.id, { volume: v / 100 } as Partial<ComicItem>, false)}
      />
      <label className="flex items-center justify-between text-sm">
        بی‌صدا
        <Switch
          checked={item.muted}
          onCheckedChange={(v) => patchItem(item.id, { muted: v } as Partial<ComicItem>, false)}
        />
      </label>
      <label className="flex items-center justify-between text-sm">
        حفظ نسبت تصویر
        <Switch
          checked={item.aspectLock}
          onCheckedChange={(v) =>
            patchItem(item.id, { aspectLock: v } as Partial<ComicItem>, false)
          }
        />
      </label>
    </div>
  );
}

const BUBBLES: { k: BubbleKind; n: string }[] = [
  { k: "round", n: "گفتگو" },
  { k: "rect", n: "مستطیل" },
  { k: "think", n: "فکر" },
  { k: "shout", n: "فریاد" },
  { k: "caption", n: "کپشن" },
  { k: "whisper", n: "نجوا" },
  { k: "none", n: "فقط متن" },
];

function BubblesPane() {
  const addBubble = useStudio((s) => s.addBubble);
  const addText = useStudio((s) => s.addText);
  const selected = useStudio((s) => s.selected());
  const patchItem = useStudio((s) => s.patchItem);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const bubble =
    selected && (selected.type === "bubble" || selected.type === "text") ? selected : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {BUBBLES.map((b) => (
          <Button key={b.k} variant="outline" size="sm" onClick={() => addBubble(b.k)}>
            {b.n}
          </Button>
        ))}
        <Button variant="outline" size="sm" onClick={addText}>
          متن آزاد
        </Button>
      </div>
      {!bubble ? (
        <p className="text-sm text-muted">
          یک شکل را بزن تا حباب ساخته شود؛ بعد روی بوم دو بار بزن و بنویس. نوک سبز را بکش.
        </p>
      ) : (
        <>
          <Field label="متن">
            <Textarea
              rows={3}
              value={bubble.text}
              onChange={(e) =>
                patchItem(bubble.id, { text: e.target.value } as Partial<ComicItem>, false)
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="فونت">
              <Select
                value={bubble.fontFamily}
                onChange={(e) =>
                  patchItem(bubble.id, { fontFamily: e.target.value } as Partial<ComicItem>, false)
                }
              >
                {COMIC_FONTS.map((f) => (
                  <option key={f.v} value={f.v}>
                    {f.n}
                  </option>
                ))}
              </Select>
            </Field>
            <Range
              label="اندازه"
              value={bubble.font}
              min={12}
              max={96}
              onChange={(v) => patchItem(bubble.id, { font: v } as Partial<ComicItem>, false)}
            />
          </div>
          <div className="flex gap-1">
            <Toggle
              on={!!bubble.bold}
              onClick={() =>
                patchItem(bubble.id, { bold: !bubble.bold } as Partial<ComicItem>, false)
              }
            >
              B
            </Toggle>
            <Toggle
              on={!!bubble.italic}
              onClick={() =>
                patchItem(bubble.id, { italic: !bubble.italic } as Partial<ComicItem>, false)
              }
            >
              I
            </Toggle>
            {(["right", "center", "left"] as const).map((a) => (
              <Toggle
                key={a}
                on={bubble.align === a}
                onClick={() => patchItem(bubble.id, { align: a } as Partial<ComicItem>, false)}
              >
                {a === "right" ? "راست" : a === "center" ? "وسط" : "چپ"}
              </Toggle>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="رنگ متن">
              <input
                type="color"
                value={bubble.color}
                onChange={(e) =>
                  patchItem(bubble.id, { color: e.target.value } as Partial<ComicItem>, false)
                }
                className="h-11 w-full"
              />
            </Field>
            {bubble.type === "bubble" && (
              <Field label="رنگ حباب">
                <input
                  type="color"
                  value={bubble.fill}
                  onChange={(e) =>
                    patchItem(bubble.id, { fill: e.target.value } as Partial<ComicItem>, false)
                  }
                  className="h-11 w-full"
                />
              </Field>
            )}
          </div>
          {bubble.type === "bubble" && (
            <>
              <Range
                label="ضخامت خط"
                value={bubble.stroke}
                min={0}
                max={20}
                onChange={(v) => patchItem(bubble.id, { stroke: v } as Partial<ComicItem>, false)}
              />
              <Range
                label="گردی"
                value={bubble.radius}
                min={0}
                max={80}
                onChange={(v) => patchItem(bubble.id, { radius: v } as Partial<ComicItem>, false)}
              />
              <Range
                label="طول دنباله"
                value={bubble.tail}
                min={20}
                max={240}
                onChange={(v) => patchItem(bubble.id, { tail: v } as Partial<ComicItem>, false)}
              />
              <div className="rounded-lg bg-bg p-2">
                <label className="flex items-center justify-between text-sm">
                  حباب زنده (کلمه به کلمه)
                  <Switch
                    checked={bubble.timing.enabled}
                    onCheckedChange={(v) =>
                      patchItem(
                        bubble.id,
                        { timing: { ...bubble.timing, enabled: v } } as Partial<ComicItem>,
                        false,
                      )
                    }
                  />
                </label>
                {bubble.timing.enabled && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="شروع (ث)">
                      <Input
                        type="number"
                        step={0.1}
                        value={bubble.timing.startMs / 1000}
                        onChange={(e) =>
                          patchItem(
                            bubble.id,
                            {
                              timing: { ...bubble.timing, startMs: Number(e.target.value) * 1000 },
                            } as Partial<ComicItem>,
                            false,
                          )
                        }
                      />
                    </Field>
                    <Field label="پایان (ث)">
                      <Input
                        type="number"
                        step={0.1}
                        value={bubble.timing.endMs / 1000}
                        onChange={(e) =>
                          patchItem(
                            bubble.id,
                            {
                              timing: { ...bubble.timing, endMs: Number(e.target.value) * 1000 },
                            } as Partial<ComicItem>,
                            false,
                          )
                        }
                      />
                    </Field>
                  </div>
                )}
              </div>
            </>
          )}
          <Button variant="destructive" size="sm" onClick={deleteSelected}>
            حذف
          </Button>
        </>
      )}
    </div>
  );
}

function LayersPane() {
  const page = useStudio((s) => s.page());
  const selectedId = useStudio((s) => s.selectedId);
  const select = useStudio((s) => s.select);
  const toggleHidden = useStudio((s) => s.toggleHidden);
  const reorderLayer = useStudio((s) => s.reorderLayer);
  if (!page) return null;
  const items = [...page.items].reverse();
  return (
    <div className="space-y-1.5">
      <p className="mb-2 text-[11px] leading-relaxed text-muted">
        بالاترین لایه روی بقیه کشیده می‌شود. با فلش‌ها جابه‌جایش کن.
      </p>
      {items.map((it, vis) => {
        const real = page.items.length - 1 - vis;
        const active = selectedId === it.id;
        return (
          <div
            key={it.id}
            className={`flex min-h-12 items-center gap-1 rounded-lg px-1.5 transition-colors ${
              active
                ? "bg-brand/12 shadow-[0_0_0_1px_var(--color-brand)]"
                : "bg-elevated shadow-[var(--shadow-border)]"
            } ${it.hidden ? "opacity-55" : ""}`}
          >
            <button
              type="button"
              className="tap flex min-w-0 flex-1 items-center gap-2 px-1.5 py-2 text-start text-sm"
              onClick={() => select(it.id)}
            >
              <span className="num w-5 shrink-0 text-[10px] text-subtle">{vis + 1}</span>
              <span className={`truncate ${active ? "font-medium text-brand" : ""}`}>
                {itemLabel(it)}
              </span>
            </button>
            <button
              type="button"
              aria-label={it.hidden ? "نمایش لایه" : "پنهان‌کردن لایه"}
              className="tap grid size-9 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg"
              onClick={() => toggleHidden(it.id)}
            >
              {it.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <button
              type="button"
              aria-label="یک لایه بالاتر"
              className="tap grid size-9 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg"
              onClick={() => reorderLayer(real, Math.min(page.items.length - 1, real + 1))}
            >
              <ArrowUp className="size-4" />
            </button>
            <button
              type="button"
              aria-label="یک لایه پایین‌تر"
              className="tap grid size-9 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg"
              onClick={() => reorderLayer(real, Math.max(0, real - 1))}
            >
              <ArrowDown className="size-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ExportPane({
  onExportPage,
  onExportAll,
  onRead,
}: {
  onExportPage: () => void;
  onExportAll: () => void;
  onRead: () => void;
}) {
  const saveNow = useStudio((s) => s.saveNow);
  const saveStatus = useStudio((s) => s.saveStatus);
  const project = useStudio((s) => s.project)!;
  const setTab = useStudio((s) => s.setTab);
  const previewLanguage = useStudio((s) => s.previewLanguage);

  return (
    <div className="space-y-3">
      <Button className="w-full" onClick={onRead}>
        پیش‌نمایش خواندن
      </Button>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onExportPage}>
          PNG این صفحه
        </Button>
        <Button variant="outline" className="flex-1" onClick={onExportAll}>
          همه صفحه‌ها
        </Button>
      </div>
      <Button variant="secondary" className="w-full" onClick={() => void saveNow()}>
        {saveStatus === "saving"
          ? "در حال ذخیره…"
          : saveStatus === "saved"
            ? "ذخیره شد"
            : "ذخیره کن"}
      </Button>
      <Field label="زبان پیش‌نمایش حباب‌ها">
        <Select
          value={previewLanguage}
          onChange={(e) => useStudio.setState({ previewLanguage: e.target.value })}
        >
          {LANGUAGES.map(([c, n]) => (
            <option key={c} value={c}>
              {n}
            </option>
          ))}
        </Select>
      </Field>
      <p className="text-[11px] text-muted">
        کمیک «{project.title}» فقط روی همین دستگاه است. برای ترجمه، متن جایگزین هر حباب را در تب
        حباب بنویس — تصویر جایش عوض نمی‌شود.
      </p>
      <Button variant="ghost" size="sm" onClick={() => setTab("props")}>
        رفتن به ویژگی‌ها
      </Button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <b className="font-mono text-fg">{Number.isInteger(step) ? value : value.toFixed(1)}</b>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={([v]) => onChange(v)}
      />
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tap h-9 min-w-11 rounded-md px-2 text-xs font-medium ${
        on
          ? "bg-brand/15 text-brand shadow-[0_0_0_1px_var(--color-brand)]"
          : "bg-elevated text-muted hover:text-fg"
      }`}
    >
      {children}
    </button>
  );
}
