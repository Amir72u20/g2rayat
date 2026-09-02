import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Pencil, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { LayoutGrid, PanelKindGrid } from "@/components/studio/ComicBits";
import { useAppNav } from "@/lib/comic/nav";
import { useEasy } from "@/lib/comic/easy-store";
import type { PanelKind } from "@/lib/comic/types";
import { cn } from "@/lib/utils";
import { FrameCanvas } from "./FrameCanvas";

/**
 * Step four: the comic as the reader will meet it — plus a pencil on every page
 * that opens just that page's settings, so a small fix never means walking back
 * through the whole wizard.
 */
export function StepPreview() {
  const go = useAppNav();
  const build = useEasy((s) => s.build);
  const built = useEasy((s) => s.built);
  const save = useEasy((s) => s.save);
  const reset = useEasy((s) => s.reset);
  const setStep = useEasy((s) => s.setStep);
  const setActiveShot = useEasy((s) => s.setActiveShot);
  const shotsOfPage = useEasy((s) => s.shotsOfPage);
  const setPagePlan = useEasy((s) => s.setPagePlan);
  const planPagesOf = useEasy((s) => s.pagePlans);
  const pagePlans = planPagesOf();
  const music = useEasy((s) => s.music);
  const patchMusic = useEasy((s) => s.patchMusic);
  const tick = useEasy((s) => s.tick);
  const shots = useEasy((s) => s.shots);
  const sizeId = useEasy((s) => s.sizeId);
  const direction = useEasy((s) => s.direction);
  const [index, setIndex] = useState(0);
  const [editPage, setEditPage] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Rebuild whenever anything upstream changes, so the preview is never stale.
  useEffect(() => {
    build();
  }, [build, tick, shots, sizeId, direction, music]);

  const pages = built?.pages ?? [];
  const page = pages[Math.min(index, Math.max(0, pages.length - 1))] ?? null;

  async function finish(where: "studio" | "read" | "home") {
    setSaving(true);
    try {
      const project = await save();
      toast.success("کمیک ذخیره شد");
      reset();
      if (where === "studio") go("/studio/$id", { id: project.id });
      else if (where === "read") go("/read/$id", { id: project.id });
      else go("/");
    } catch {
      toast.error("ذخیره ناموفق بود");
    } finally {
      setSaving(false);
    }
  }

  if (!page) {
    return (
      <p className="rounded-xl bg-surface p-6 text-center text-sm text-muted shadow-[var(--shadow-border)]">
        هنوز چیزی برای نمایش نیست — به مرحلهٔ عکس‌ها برگرد.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="material relative overflow-hidden rounded-2xl bg-elevated p-2 [--frame-max:52dvh] lg:[--frame-max:66dvh]">
        <div className="checker overflow-hidden rounded-xl">
          <FrameCanvas page={page} tick={tick} handles={false} />
        </div>
        <Button
          size="icon"
          className="absolute bottom-4 end-4 rounded-full shadow-[var(--shadow-lift)]"
          aria-label="ویرایش همین صفحه"
          onClick={() => setEditPage(index)}
        >
          <Pencil />
        </Button>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label="صفحهٔ قبل"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronRight />
        </Button>
        <div className="flex items-center gap-1.5">
          {pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-label={`صفحهٔ ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "tap h-2 rounded-full transition-all",
                i === index ? "w-6 bg-brand" : "w-2 bg-line hover:bg-muted",
              )}
            />
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label="صفحهٔ بعد"
          disabled={index >= pages.length - 1}
          onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}
        >
          <ChevronLeft />
        </Button>
        <span className="num ms-2 text-xs text-muted">
          {index + 1} / {pages.length}
        </span>
      </div>

      <section className="material rounded-xl bg-surface p-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="size-3.5 text-brand" />
          آمادهٔ ذخیره
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
          همه‌چیز بعد از ذخیره هم قابل ویرایش است — عکس‌ها، حباب‌ها و قاب‌ها در استودیو باز می‌شوند.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Button disabled={saving} onClick={() => void finish("studio")}>
            ذخیره و باز کردن استودیو
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => void finish("read")}>
            <BookOpen />
            ذخیره و خواندن
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => void finish("home")}>
            ذخیره و بستن
          </Button>
        </div>
      </section>

      <BottomSheet
        open={editPage !== null}
        onOpenChange={(v) => setEditPage(v ? editPage : null)}
        title={`تنظیم صفحهٔ ${(editPage ?? 0) + 1}`}
        description="بدون برگشتن به مرحله‌های قبل، همین صفحه را عوض کن."
      >
        {editPage !== null && (
          <div className="space-y-4 pt-1">
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-muted">
                چیدمان قاب‌ها
              </span>
              <LayoutGrid
                value={pagePlans[editPage]?.layoutKey}
                onPick={(layoutKey) => setPagePlan(editPage, { layoutKey })}
              />
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold text-muted">شکل قاب‌ها</span>
              <PanelKindGrid
                value={pagePlans[editPage]?.panelKind}
                onPick={(panelKind: PanelKind) => setPagePlan(editPage, { panelKind })}
              />
            </div>
            {music && (
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold text-muted">موسیقی</span>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    variant={music.throughPage === -1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => patchMusic({ throughPage: -1 })}
                  >
                    تا آخر پخش شود
                  </Button>
                  <Button
                    variant={music.throughPage === editPage + 1 ? "default" : "outline"}
                    size="sm"
                    onClick={() => patchMusic({ throughPage: editPage + 1 })}
                  >
                    تا همین صفحه
                  </Button>
                </div>
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                variant="secondary"
                onClick={() => {
                  const first = shotsOfPage(editPage)[0];
                  if (first) setActiveShot(first.id);
                  setEditPage(null);
                  setStep("edit");
                }}
              >
                <Pencil />
                ویرایش عکس‌های این صفحه
              </Button>
              <Button variant="outline" onClick={() => setEditPage(null)}>
                بستن
              </Button>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
