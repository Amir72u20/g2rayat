import { useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { drawPage } from "@/lib/comic/draw";
import { getMediaBag, loadImageAsset } from "@/lib/comic/media-cache";
import { useStudio } from "@/lib/comic/store";
import { cn } from "@/lib/utils";

export function PageStrip({ variant = "row" }: { variant?: "row" | "col" }) {
  const project = useStudio((s) => s.project);
  const pageIndex = useStudio((s) => s.pageIndex);
  const mediaTick = useStudio((s) => s.mediaTick);
  const goPage = useStudio((s) => s.goPage);
  const addPage = useStudio((s) => s.addPage);
  const duplicatePage = useStudio((s) => s.duplicatePage);
  const deletePage = useStudio((s) => s.deletePage);
  const movePage = useStudio((s) => s.movePage);
  const pages = project?.pages ?? [];
  const col = variant === "col";

  return (
    <div className={cn("flex items-stretch gap-2", col && "flex-col")}>
      <div className={cn("flex min-w-0 flex-1 gap-2", col ? "flex-col" : "rail-x no-scrollbar")}>
        {pages.map((p, i) => (
          <Thumb
            key={p.id}
            index={i}
            active={i === pageIndex}
            name={p.name || `صفحه ${i + 1}`}
            onClick={() => goPage(i)}
            tick={mediaTick}
            wide={col}
          />
        ))}
        <button
          type="button"
          onClick={addPage}
          className={cn(
            "tap flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted hover:border-brand/60 hover:bg-elevated hover:text-fg",
            col ? "h-16 w-full" : "w-20",
          )}
        >
          <Plus className="size-4" />
          <span className="text-[10px] leading-tight">صفحه تازه</span>
        </button>
      </div>

      {/* Page-level actions. On the phone sheet they sit under the list; on the
          desktop rail they stay pinned beside it. */}
      <div
        className={cn(
          "shrink-0 gap-1.5",
          col ? "mt-1 grid grid-cols-2" : "hidden flex-col sm:flex",
        )}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => movePage(pageIndex, pageIndex - 1)}
          disabled={pageIndex <= 0}
        >
          <ChevronUp /> بالا
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => movePage(pageIndex, pageIndex + 1)}
          disabled={pageIndex >= pages.length - 1}
        >
          <ChevronDown /> پایین
        </Button>
        <Button variant="outline" size="sm" onClick={duplicatePage}>
          <Copy /> کپی
        </Button>
        <Button variant="destructive" size="sm" onClick={deletePage} disabled={pages.length <= 1}>
          <Trash2 /> حذف
        </Button>
      </div>
    </div>
  );
}

function Thumb({
  index,
  active,
  name,
  onClick,
  tick,
  wide,
}: {
  index: number;
  active: boolean;
  name: string;
  onClick: () => void;
  tick: number;
  wide?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const page = useStudio.getState().project?.pages[index];
    const cv = ref.current;
    if (!page || !cv) return;
    cv.width = 120;
    cv.height = Math.round((120 * page.h) / page.w);
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(cv.width / page.w, 0, 0, cv.height / page.h, 0, 0);
    page.items.forEach((it) => {
      if (it.type === "image")
        loadImageAsset(it.assetId, () => {
          const c = ref.current;
          const p = useStudio.getState().project?.pages[index];
          if (!c || !p) return;
          const x = c.getContext("2d");
          if (!x) return;
          x.setTransform(c.width / p.w, 0, 0, c.height / p.h, 0, 0);
          drawPage(x, p, getMediaBag(), { handles: false });
        });
    });
    drawPage(ctx, page, getMediaBag(), { handles: false });
  }, [index, tick, active]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "tap group relative shrink-0 overflow-hidden rounded-lg bg-elevated text-center",
        wide ? "flex w-full items-center gap-2.5 p-1.5 text-start" : "w-20",
        active
          ? "bg-brand/10 shadow-[0_0_0_1.5px_var(--color-brand)]"
          : "shadow-[var(--shadow-border)] hover:bg-overlay",
      )}
    >
      <canvas
        ref={ref}
        className={cn(
          "block rounded-md bg-ink shadow-[var(--shadow-border)]",
          wide ? "h-16 w-12 shrink-0" : "h-24 w-full",
        )}
      />
      <span className={cn("min-w-0 flex-1", wide ? "block" : "block px-1 py-1")}>
        <span className={cn("block truncate text-[11px] font-medium", active && "text-brand")}>
          {name}
        </span>
        <span className="num block text-[10px] text-muted">صفحه {index + 1}</span>
      </span>
    </button>
  );
}
