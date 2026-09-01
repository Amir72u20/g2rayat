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
      <button
        type="button"
        onClick={addPage}
        className={cn(
          "flex shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-muted hover:text-fg",
          col ? "h-14 w-full" : "w-16",
        )}
      >
        <Plus className="size-4" />
        <span className="text-[10px] leading-tight">صفحه تازه</span>
      </button>
      <div className={cn("flex min-w-0 flex-1 gap-2", col ? "flex-col overflow-y-auto" : "no-scrollbar overflow-x-auto")}>
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
      </div>
      <div className={cn("shrink-0 gap-1", col ? "grid grid-cols-2" : "hidden flex-col sm:flex")}>
        <Button variant="outline" size="sm" onClick={() => movePage(pageIndex, pageIndex - 1)} disabled={pageIndex <= 0}>
          <ChevronUp /> قبل
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => movePage(pageIndex, pageIndex + 1)}
          disabled={pageIndex >= pages.length - 1}
        >
          <ChevronDown /> بعد
        </Button>
        <Button variant="outline" size="sm" onClick={duplicatePage}>
          <Copy /> کپی
        </Button>
        <Button variant="destructive" size="sm" onClick={deletePage}>
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
      className={cn(
        "shrink-0 overflow-hidden rounded-lg bg-elevated text-center",
        wide ? "flex w-full items-center gap-2 p-1 text-start" : "w-[76px]",
        active ? "ring-2 ring-steel" : "shadow-[var(--shadow-border)]",
      )}
    >
      <canvas ref={ref} className={cn("block bg-ink", wide ? "h-16 w-12 rounded-md" : "h-24 w-full")} />
      <span className="block truncate px-1 py-1 text-[10px]">
        {index + 1}. {name}
      </span>
    </button>
  );
}
