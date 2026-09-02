import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

interface Row {
  label: string;
  /** Key names render left-to-right even inside the RTL sheet. */
  keys?: string[][];
  note?: string;
}

const GROUPS: { title: string; rows: Row[] }[] = [
  {
    title: "کار با پرونده",
    rows: [
      { label: "ذخیره", keys: [["Ctrl", "S"]] },
      {
        label: "واگرد / ازنو",
        keys: [
          ["Ctrl", "Z"],
          ["Ctrl", "Shift", "Z"],
        ],
      },
      { label: "پیش‌نمایش خواندن", note: "دکمهٔ پیش‌نمایش در نوار بالا" },
    ],
  },
  {
    title: "انتخاب و ویرایش",
    rows: [
      {
        label: "کپی / چسباندن",
        keys: [
          ["Ctrl", "C"],
          ["Ctrl", "V"],
        ],
      },
      { label: "تکثیر انتخاب", keys: [["Ctrl", "D"]] },
      { label: "حذف انتخاب", keys: [["Delete"]] },
      { label: "چرخش بین قاب‌ها", keys: [["Tab"]] },
      { label: "جابه‌جایی نرم / تند", keys: [["↑ ↓ ← →"], ["Shift", "↑ ↓ ← →"]] },
      { label: "برگشت به ابزار انتخاب", keys: [["Esc"]] },
    ],
  },
  {
    title: "نما",
    rows: [
      {
        label: "بزرگ‌نمایی / کوچک‌نمایی",
        keys: [
          ["Ctrl", "+"],
          ["Ctrl", "−"],
        ],
      },
      { label: "اندازهٔ واقعی", keys: [["Ctrl", "0"]] },
      { label: "جابه‌جایی بوم", keys: [["Space", "+ درگ"]] },
      { label: "زوم با موس", keys: [["Ctrl", "+ چرخ موس"]] },
      { label: "همین راهنما", keys: [["؟"]] },
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:w-[min(560px,calc(100vw-24px))]">
        <DialogTitle>کلیدهای میان‌بر</DialogTitle>
        <DialogDescription>روی کیبورد، کار با استودیو خیلی سریع‌تر می‌شود.</DialogDescription>
        <div className="mt-4 max-h-[60dvh] space-y-4 overflow-y-auto pe-1">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-1.5 text-[11px] font-semibold text-subtle">{g.title}</h3>
              <div className="overflow-hidden rounded-lg bg-elevated">
                {g.rows.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between gap-3 px-3 py-2.5 text-sm ${
                      i ? "border-t border-line-soft" : ""
                    }`}
                  >
                    <span className="min-w-0 truncate">{row.label}</span>
                    {row.note ? (
                      <span className="shrink-0 text-[11px] text-muted">{row.note}</span>
                    ) : (
                      <span dir="ltr" className="flex shrink-0 flex-wrap items-center gap-1">
                        {row.keys?.map((combo, ci) => (
                          <span key={ci} className="flex items-center gap-1">
                            {ci > 0 && <span className="px-0.5 text-[11px] text-subtle">·</span>}
                            {combo.map((k) => (
                              <kbd
                                key={k}
                                className="num rounded bg-bg px-1.5 py-0.5 text-[11px] text-muted shadow-[var(--shadow-border)]"
                              >
                                {k}
                              </kbd>
                            ))}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
