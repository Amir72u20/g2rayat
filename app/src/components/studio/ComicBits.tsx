import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PANEL_LAYOUTS, type PanelLayout } from "@/lib/comic/layouts";
import { PANEL_KINDS, panelKindOf, panelSvgD } from "@/lib/comic/panel-shape";
import { useStudio } from "@/lib/comic/store";
import type { PanelKind } from "@/lib/comic/types";
import { thumbUrl } from "@/lib/comic/db";
import { cn } from "@/lib/utils";

const PAPER = [
  { c: "#f6f1e6", n: "کاغذ" },
  { c: "#ffffff", n: "سفید" },
  { c: "#111318", n: "شب" },
  { c: "#e8eef4", n: "مه" },
  { c: "#d7c4a3", n: "کرافت" },
  { c: "#c9895c", n: "غروب" },
];

export function LayoutThumb({ layout, className }: { layout: PanelLayout; className?: string }) {
  const W = 56;
  const H = 42;
  const ox = 2;
  const oy = 2;
  return (
    <svg viewBox="0 0 60 46" className={cn("h-full w-full text-muted", className)}>
      {layout.cells.length === 0 ? (
        <text x="30" y="26" fontSize="9" textAnchor="middle" fill="currentColor">
          خالی
        </text>
      ) : (
        layout.cells.map((c, i) => {
          const x = ox + c.x * W;
          const y = oy + c.y * H;
          const w = Math.max(2, c.w * W - 1.6);
          const h = Math.max(2, c.h * H - 1.6);
          const kind = c.kind || "rect";
          const fillOp = kind.startsWith("slash") || kind === "tri" || kind === "tri-down" ? 0.22 : 0.08;
          return (
            <path
              key={i}
              d={panelSvgD(kind, x, y, w, h)}
              fill="currentColor"
              fillOpacity={fillOp}
              stroke="currentColor"
              strokeWidth="2"
            />
          );
        })
      )}
    </svg>
  );
}

export function LayoutGrid({ onPick }: { onPick?: (key: string) => void }) {
  const applyLayoutKey = useStudio((s) => s.applyLayoutKey);
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
      {PANEL_LAYOUTS.map((L) => (
        <button
          key={L.k}
          type="button"
          title={L.n}
          onClick={() => (onPick ? onPick(L.k) : applyLayoutKey(L.k))}
          className="flex h-14 flex-col items-center justify-center rounded-md bg-elevated p-1 hover:bg-line/50"
        >
          <LayoutThumb layout={L} />
        </button>
      ))}
    </div>
  );
}

export function PanelKindGrid({
  value,
  onPick,
}: {
  value?: PanelKind;
  onPick: (k: PanelKind) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {PANEL_KINDS.map((s) => {
        const active = panelKindOf({ kind: value }) === s.k;
        return (
          <button
            key={s.k}
            type="button"
            title={s.n}
            onClick={() => onPick(s.k)}
            className={cn(
              "flex h-12 items-center justify-center rounded-md p-1",
              active ? "bg-select/35 text-select-fg" : "bg-elevated text-muted hover:text-fg",
            )}
          >
            <svg viewBox="0 0 36 28" className="h-full w-full">
              <path
                d={panelSvgD(s.k, 3, 3, 30, 22)}
                fill="currentColor"
                fillOpacity="0.14"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

export function PageBackgroundPicker({ onPickImage }: { onPickImage: () => void }) {
  const page = useStudio((s) => s.page());
  const setBgColor = useStudio((s) => s.setBgColor);
  const touchPage = useStudio((s) => s.touchPage);
  if (!page) return null;
  const current = page.background.color;
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold">پس‌زمینه همین صفحه</div>
      <p className="text-[11px] text-muted">رنگ کاغذ یا یک عکس از فایل‌هایت.</p>
      <div className="flex flex-wrap gap-1.5">
        {PAPER.map((p) => (
          <button
            key={p.c}
            type="button"
            title={p.n}
            aria-label={p.n}
            onClick={() => setBgColor(p.c)}
            className={cn(
              "size-9 rounded-full shadow-[var(--shadow-border)]",
              current.toLowerCase() === p.c.toLowerCase() && "ring-2 ring-steel ring-offset-2 ring-offset-bg",
            )}
            style={{ background: p.c }}
          />
        ))}
        <label className="grid size-9 place-items-center overflow-hidden rounded-full bg-elevated shadow-[var(--shadow-border)]">
          <input
            type="color"
            value={current}
            onChange={(e) => setBgColor(e.target.value)}
            className="size-12 cursor-pointer"
            aria-label="رنگ دلخواه"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onPickImage}>
          <ImagePlus className="size-4" />
          عکس پس‌زمینه
        </Button>
        {page.background.assetId ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              touchPage((pg) => {
                pg.background.assetId = "";
              })
            }
          >
            حذف عکس
          </Button>
        ) : null}
      </div>
      {page.background.assetId && thumbUrl(page.background.assetId) ? (
        <img
          src={thumbUrl(page.background.assetId)}
          alt=""
          className="h-16 w-full rounded-md object-cover"
        />
      ) : null}
    </div>
  );
}
