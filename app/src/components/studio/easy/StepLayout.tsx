import { useEffect, useRef, useState } from "react";
import { Music, Pause, Play, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { LayoutGrid, LayoutThumb } from "@/components/studio/ComicBits";
import { PanelKindGrid } from "@/components/studio/ComicBits";
import { intakeFile } from "@/lib/comic/asset-intake";
import { applyTone } from "@/lib/comic/audio-graph";
import { listAssets, mediaUrl } from "@/lib/comic/db";
import { useEasy } from "@/lib/comic/easy-store";
import { PANEL_LAYOUTS } from "@/lib/comic/layouts";
import { PANEL_KINDS } from "@/lib/comic/panel-shape";
import { PAGE_SIZES, type AssetMeta, type PanelKind } from "@/lib/comic/types";
import { cn } from "@/lib/utils";

export function StepLayout() {
  const perPage = useEasy((s) => s.perPage);
  const setPerPage = useEasy((s) => s.setPerPage);
  const globalPlan = useEasy((s) => s.globalPlan);
  const setGlobalPlan = useEasy((s) => s.setGlobalPlan);
  const setPagePlan = useEasy((s) => s.setPagePlan);
  // Selecting the function (not its result) keeps the store snapshot stable —
  // a fresh array from a selector re-renders forever.
  const planPagesOf = useEasy((s) => s.pagePlans);
  const pagePlans = planPagesOf();
  const shotsOfPage = useEasy((s) => s.shotsOfPage);
  const sizeId = useEasy((s) => s.sizeId);
  const setSize = useEasy((s) => s.setSize);
  const direction = useEasy((s) => s.direction);
  const setDirection = useEasy((s) => s.setDirection);
  const [openPage, setOpenPage] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <section className="material rounded-xl bg-surface p-3">
        <h2 className="text-xs font-semibold">صفحهٔ کمیک</h2>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-muted">اندازهٔ صفحه</span>
            <Select value={sizeId} onChange={(e) => setSize(e.target.value)}>
              {PAGE_SIZES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-muted">جهت خواندن</span>
            <Segmented
              ariaLabel="جهت خواندن"
              value={direction}
              onChange={setDirection}
              className="w-full"
              options={[
                { value: "rtl", label: "راست به چپ" },
                { value: "ltr", label: "چپ به راست" },
              ]}
            />
          </div>
        </div>
      </section>

      <section className="material rounded-xl bg-surface p-3">
        <h2 className="text-xs font-semibold">پنل‌ها</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          چیدمان و شکل قاب‌ها. هر پنل خودش را کمی کوچک می‌کند تا عکس کامل و بدون بریدگی داخلش
          بنشیند.
        </p>
        <Segmented
          ariaLabel="حالت چیدمان"
          className="mt-3 w-full"
          value={perPage ? "page" : "all"}
          onChange={(v) => setPerPage(v === "page")}
          options={[
            { value: "all", label: "یکسان برای کل کمیک" },
            { value: "page", label: "برای هر صفحه جدا" },
          ]}
        />

        {!perPage ? (
          <div className="mt-3 space-y-3">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-muted">
                چیدمان قاب‌ها
              </span>
              <LayoutGrid
                value={globalPlan.layoutKey}
                onPick={(layoutKey) => setGlobalPlan({ layoutKey })}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-muted">شکل قاب‌ها</span>
              <PanelKindGrid
                value={globalPlan.panelKind}
                onPick={(panelKind: PanelKind) => setGlobalPlan({ panelKind })}
              />
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {pagePlans.map((plan, i) => {
              const layout = PANEL_LAYOUTS.find((L) => L.k === plan.layoutKey);
              const kind = PANEL_KINDS.find((k) => k.k === plan.panelKind);
              const count = shotsOfPage(i).length;
              const open = openPage === i;
              return (
                <div key={i} className="rounded-xl bg-elevated shadow-[var(--shadow-border)]">
                  <button
                    type="button"
                    onClick={() => setOpenPage(open ? null : i)}
                    className="tap flex w-full items-center gap-3 p-2.5 text-start"
                  >
                    <span className="grid h-12 w-10 shrink-0 place-items-center rounded-md bg-bg p-1">
                      {layout ? <LayoutThumb layout={layout} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">صفحهٔ {i + 1}</span>
                      <span className="num block text-[11px] text-muted">
                        {layout?.n} · {kind?.n} · {count} عکس
                      </span>
                    </span>
                    <span className="text-[11px] text-brand">{open ? "بستن" : "تغییر"}</span>
                  </button>
                  {open && (
                    <div className="space-y-3 border-t border-line-soft p-2.5">
                      <LayoutGrid
                        value={plan.layoutKey}
                        onPick={(layoutKey) => setPagePlan(i, { layoutKey })}
                      />
                      <PanelKindGrid
                        value={plan.panelKind}
                        onPick={(panelKind: PanelKind) => setPagePlan(i, { panelKind })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <MusicSection pageCount={pagePlans.length} />
    </div>
  );
}

function MusicSection({ pageCount }: { pageCount: number }) {
  const music = useEasy((s) => s.music);
  const setMusic = useEasy((s) => s.setMusic);
  const patchMusic = useEasy((s) => s.patchMusic);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [library, setLibrary] = useState<AssetMeta[]>([]);

  useEffect(() => {
    void listAssets("audio").then(setLibrary);
  }, [music?.assetId]);

  // Keep a running preview in step with the sliders.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !music) return;
    el.volume = music.volume;
    applyTone(el, { speed: music.speed, bass: music.bass, treble: music.treble });
  }, [music?.volume, music?.speed, music?.bass, music?.treble, music]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    [],
  );

  function pick(assetId: string, name: string) {
    setMusic({
      assetId,
      name,
      volume: 0.45,
      speed: 1,
      bass: 0,
      treble: 0,
      fadeInMs: 800,
      fadeOutMs: 1200,
      throughPage: -1,
    });
  }

  function togglePlay() {
    if (!music) return;
    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      audioRef.current = el;
      el.onended = () => setPlaying(false);
    }
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    if (el.src !== mediaUrl(music.assetId)) el.src = mediaUrl(music.assetId);
    el.volume = music.volume;
    applyTone(el, { speed: music.speed, bass: music.bass, treble: music.treble });
    void el
      .play()
      .then(() => setPlaying(true))
      .catch(() => toast.error("پخش ممکن نشد"));
  }

  return (
    <section className="material rounded-xl bg-surface p-3">
      <h2 className="text-xs font-semibold">موسیقی پس‌زمینه</h2>
      <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
        یک قطعه بگذار و همین‌جا صدایش را بساز: سرعت، بم و زیر، محو ورود و خروج، و اینکه تا کدام صفحه
        پخش شود.
      </p>

      {!music ? (
        <div className="mt-3 space-y-3">
          <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
            <Upload />
            انتخاب فایل صدا
          </Button>
          {library.length > 0 && (
            <div className="space-y-1">
              <span className="block text-[11px] font-semibold text-muted">صداهای همین دستگاه</span>
              {library.slice(0, 8).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => pick(a.id, a.name)}
                  className="tap flex min-h-11 w-full items-center gap-2 rounded-lg bg-elevated px-3 text-start text-sm shadow-[var(--shadow-border)] hover:bg-overlay"
                >
                  <Music className="size-4 text-brand" />
                  <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  {a.duration ? (
                    <span className="num shrink-0 text-[11px] text-muted">
                      {a.duration.toFixed(0)}ث
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-elevated p-2 shadow-[var(--shadow-border)]">
            <Button variant="secondary" size="icon-sm" onClick={togglePlay} aria-label="پخش نمونه">
              {playing ? <Pause /> : <Play />}
            </Button>
            <span className="min-w-0 flex-1 truncate text-sm">{music.name}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="حذف موسیقی"
              onClick={() => {
                audioRef.current?.pause();
                setPlaying(false);
                setMusic(null);
              }}
            >
              <Trash2 />
            </Button>
          </div>

          <Knob label="بلندی صدا" value={`${Math.round(music.volume * 100)}٪`}>
            <Slider
              min={0}
              max={100}
              value={[Math.round(music.volume * 100)]}
              onValueChange={([v]) => patchMusic({ volume: v / 100 })}
            />
          </Knob>
          <Knob label="سرعت پخش" value={`${music.speed.toFixed(2)}×`}>
            <Slider
              min={50}
              max={200}
              value={[Math.round(music.speed * 100)]}
              onValueChange={([v]) => patchMusic({ speed: v / 100 })}
            />
          </Knob>
          <Knob label="بم (باس)" value={`${music.bass > 0 ? "+" : ""}${music.bass.toFixed(0)} dB`}>
            <Slider
              min={-12}
              max={12}
              value={[music.bass]}
              onValueChange={([v]) => patchMusic({ bass: v })}
            />
          </Knob>
          <Knob
            label="زیر (نازکی صدا)"
            value={`${music.treble > 0 ? "+" : ""}${music.treble.toFixed(0)} dB`}
          >
            <Slider
              min={-12}
              max={12}
              value={[music.treble]}
              onValueChange={([v]) => patchMusic({ treble: v })}
            />
          </Knob>
          <div className="grid grid-cols-2 gap-3">
            <Knob label="محو ورود" value={`${(music.fadeInMs / 1000).toFixed(1)}s`}>
              <Slider
                min={0}
                max={5000}
                step={100}
                value={[music.fadeInMs]}
                onValueChange={([v]) => patchMusic({ fadeInMs: v })}
              />
            </Knob>
            <Knob label="محو خروج" value={`${(music.fadeOutMs / 1000).toFixed(1)}s`}>
              <Slider
                min={0}
                max={5000}
                step={100}
                value={[music.fadeOutMs]}
                onValueChange={([v]) => patchMusic({ fadeOutMs: v })}
              />
            </Knob>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-muted">
              تا کدام صفحه پخش شود؟
            </span>
            <div className="rail-x rail-fade no-scrollbar">
              <ThroughChip
                active={music.throughPage === 0}
                onClick={() => patchMusic({ throughPage: 0 })}
              >
                فقط صفحهٔ ۱
              </ThroughChip>
              {Array.from({ length: Math.max(0, pageCount - 1) }).map((_, i) => (
                <ThroughChip
                  key={i}
                  active={music.throughPage === i + 2}
                  onClick={() => patchMusic({ throughPage: i + 2 })}
                >
                  تا صفحهٔ {i + 2}
                </ThroughChip>
              ))}
              <ThroughChip
                active={music.throughPage === -1}
                onClick={() => patchMusic({ throughPage: -1 })}
              >
                تا آخر
              </ThroughChip>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="audio/*,.mp3,.wav,.ogg,.m4a"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const rec = await intakeFile(f);
          if (!rec) {
            toast.error("این فایل صدا پشتیبانی نمی‌شود");
            return;
          }
          pick(rec.id, rec.name);
          toast.success("موسیقی اضافه شد");
        }}
      />
    </section>
  );
}

function Knob({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-muted">{label}</span>
        <span dir="ltr" className="num text-fg">
          {value}
        </span>
      </div>
      {children}
    </div>
  );
}

function ThroughChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap h-10 rounded-full px-4 text-xs font-medium",
        active ? "bg-brand text-brand-fg" : "bg-elevated text-fg shadow-[var(--shadow-border)]",
      )}
    >
      {children}
    </button>
  );
}
