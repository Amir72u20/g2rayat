import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAppNav } from "@/lib/comic/nav";
import { EASY_STEPS, useEasy, type EasyStep } from "@/lib/comic/easy-store";
import { cn } from "@/lib/utils";
import { StepPick } from "./StepPick";
import { StepEdit } from "./StepEdit";
import { StepLayout } from "./StepLayout";
import { StepPreview } from "./StepPreview";

const HINTS: Record<EasyStep, string> = {
  pick: "عکس‌ها و ویدئوهایی که می‌خواهی در کمیک بیایند را انتخاب کن — ترتیبشان همان ترتیب قاب‌هاست.",
  edit: "هر تصویر را جدا و بیرون از قاب بساز: برش، رنگ و نور، حباب گفتگو، و برای ویدئو، بازه و صدا.",
  layout: "چیدمان و شکل قاب‌ها را انتخاب کن و اگر خواستی موسیقی پس‌زمینه بگذار.",
  preview: "کمیک را ببین؛ هر صفحه‌ای ایراد داشت، همان‌جا با مداد درستش کن.",
};

export function EasyWizard() {
  const go = useAppNav();
  const step = useEasy((s) => s.step);
  const setStep = useEasy((s) => s.setStep);
  const nextStep = useEasy((s) => s.nextStep);
  const prevStep = useEasy((s) => s.prevStep);
  const restore = useEasy((s) => s.restore);
  const rehydrateAssets = useEasy((s) => s.rehydrateAssets);
  const mainRef = useRef<HTMLElement>(null);
  const reset = useEasy((s) => s.reset);
  const shots = useEasy((s) => s.shots);
  const [leaveOpen, setLeaveOpen] = useState(false);

  useEffect(() => {
    restore();
    // A reload keeps the wizard's state but not its blob URLs; without this the
    // restored pictures and clips come back blank.
    void rehydrateAssets();
  }, [restore, rehydrateAssets]);

  const index = EASY_STEPS.findIndex((s) => s.id === step);
  const canGoNext = step === "pick" ? shots.length > 0 : true;
  const isLast = step === "preview";

  function tryNext() {
    if (!canGoNext) {
      toast.message("اول چند عکس انتخاب کن");
      return;
    }
    nextStep();
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function leave() {
    if (shots.length) setLeaveOpen(true);
    else go("/");
  }

  // One viewport-tall column: header, a body that owns its own scrolling, and a
  // footer that is always within thumb reach on a phone.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="z-20 shrink-0 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 md:px-8">
          <Button variant="ghost" size="icon-sm" aria-label="بستن" onClick={leave}>
            <X />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand">
              <Wand2 className="size-3.5" />
              ساخت آسان
            </div>
            <h1 className="truncate text-sm font-semibold">{EASY_STEPS[index]?.label}</h1>
          </div>
          <span className="num ms-auto shrink-0 rounded-full bg-elevated px-2.5 py-1 text-[11px] text-muted">
            {index + 1} / {EASY_STEPS.length}
          </span>
        </div>

        {/* Step rail: every step stays reachable, so going back never means
            starting over — the wizard keeps all of its state. */}
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 pb-3 md:px-8">
          {EASY_STEPS.map((s, i) => {
            const done = i < index;
            const active = i === index;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={cn(
                  "tap group flex min-w-0 flex-1 flex-col gap-1.5",
                  !active && !done && "opacity-70",
                )}
              >
                <span
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    active ? "bg-brand" : done ? "bg-brand/45" : "bg-line",
                  )}
                />
                <span
                  className={cn(
                    "truncate text-[11px]",
                    active ? "font-semibold text-fg" : "text-muted group-hover:text-fg",
                  )}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <main
        ref={mainRef}
        className={cn(
          "mx-auto w-full max-w-5xl flex-1 px-4 py-3 md:px-8 md:py-4",
          // The picture editor manages its own zones; every other step scrolls.
          step === "edit"
            ? "flex min-h-0 flex-col overflow-hidden lg:overflow-y-auto"
            : "min-h-0 overflow-y-auto",
        )}
      >
        <p
          className={cn(
            "mb-3 text-[12px] leading-relaxed text-muted",
            step === "edit" && "hidden lg:block",
          )}
        >
          {HINTS[step]}
        </p>
        {step === "pick" && <StepPick />}
        {step === "edit" && <StepEdit />}
        {step === "layout" && <StepLayout />}
        {step === "preview" && <StepPreview />}
      </main>

      {!isLast && (
        <footer className="z-20 shrink-0 border-t border-line bg-surface/95 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-8">
            <Button variant="outline" onClick={prevStep} disabled={index === 0}>
              <ChevronRight />
              قبلی
            </Button>
            <Button className="flex-1" onClick={tryNext}>
              {step === "layout" ? "ذخیره و پیش‌نمایش" : "ذخیره و مرحلهٔ بعد"}
              <ChevronLeft />
            </Button>
          </div>
        </footer>
      )}

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogTitle>ساخت آسان را ببندیم؟</DialogTitle>
          <DialogDescription>
            کارت تا وقتی این پنجرهٔ مرورگر باز است نگه داشته می‌شود؛ با «دور انداختن» پاک می‌شود.
          </DialogDescription>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLeaveOpen(false);
                go("/");
              }}
            >
              بستن و نگه‌داشتن کار
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                reset();
                setLeaveOpen(false);
                go("/");
              }}
            >
              دور انداختن
            </Button>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              ادامه می‌دهم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
