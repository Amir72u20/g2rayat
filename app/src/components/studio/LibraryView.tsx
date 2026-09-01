import { useEffect, useMemo, useRef, useState } from "react";
import { useAppNav } from "@/lib/comic/nav";
import {
  BookOpen,
  Clock,
  Copy,
  Download,
  FileUp,
  Layers,
  LayoutGrid,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { useStudio } from "@/lib/comic/store";
import { PAGE_SIZES, type ProjectMeta } from "@/lib/comic/types";
import { ensureAssetUrl, thumbUrl } from "@/lib/comic/db";
import { formatRelativeFa } from "@/lib/utils";
import { loadPrefs, savePrefs, type StudioPrefs } from "@/lib/comic/prefs";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { Wordmark } from "./Brand";

type SortKey = "updated" | "created" | "name";
type ViewKey = "grid" | "list";

const VIEW_KEY = "kader.libraryView.v1";

async function downloadStudioHtml() {
  try {
    const res = await fetch("/kader.html", { cache: "no-store" });
    if (!res.ok) throw new Error("missing");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "kader.html";
    a.click();
    URL.revokeObjectURL(href);
    toast.success("فایل HTML ذخیره شد");
  } catch {
    toast.error("فایل HTML هنوز آماده نیست");
  }
}

export function LibraryView() {
  const go = useAppNav();
  const ready = useStudio((s) => s.ready);
  const library = useStudio((s) => s.library);
  const boot = useStudio((s) => s.boot);
  const createProject = useStudio((s) => s.createProject);
  const removeProject = useStudio((s) => s.removeProject);
  const duplicateProject = useStudio((s) => s.duplicateProject);
  const importProjectFile = useStudio((s) => s.importProjectFile);
  const exportProjectFile = useStudio((s) => s.exportProjectFile);
  const renameProject = useStudio((s) => s.renameProject);

  const importRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<ViewKey>("grid");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl");
  const [size, setSize] = useState<string>("webtoon");
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [rename, setRename] = useState<ProjectMeta | null>(null);
  const [renameVal, setRenameVal] = useState("");
  const [del, setDel] = useState<ProjectMeta | null>(null);
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState<StudioPrefs>(() => loadPrefs());
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    void boot();
    const p = loadPrefs();
    setPrefs(p);
    setDir(p.defaultDirection);
    setSize(p.defaultSize);
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "grid") setView(v);
    } catch {
      /* storage blocked — grid is a fine default */
    }
  }, [boot]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of library) {
        if (!p.coverAssetId) continue;
        await ensureAssetUrl(p.coverAssetId);
        next[p.id] = thumbUrl(p.coverAssetId);
      }
      if (!cancelled) setCovers(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [library]);

  // Desktop muscle memory: "/" jumps to search, "n" starts a comic.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        el?.tagName === "INPUT" || el?.tagName === "TEXTAREA" || el?.isContentEditable === true;
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The phone gets a floating button only once the hero (which carries the same
  // action) has scrolled away — otherwise it just covers a card.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 220);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function pickView(v: ViewKey) {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* not worth surfacing */
    }
  }

  const rows = useMemo(() => {
    const filtered = library.filter((p) =>
      (p.title + " " + p.description).toLowerCase().includes(q.trim().toLowerCase()),
    );
    filtered.sort((a, b) => {
      if (sort === "name") return a.title.localeCompare(b.title, "fa");
      if (sort === "created") return b.createdAt - a.createdAt;
      return b.updatedAt - a.updatedAt;
    });
    return filtered;
  }, [library, q, sort]);

  const totalPages = library.reduce((n, p) => n + p.pageCount, 0);

  async function create() {
    const sz = PAGE_SIZES.find((s) => s.id === size) || PAGE_SIZES[0];
    const p = await createProject(title || "کمیک تازه", {
      description: desc,
      direction: dir,
      w: sz.w,
      h: sz.h,
    });
    setOpen(false);
    setTitle("");
    setDesc("");
    go("/studio/$id", { id: p.id });
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3 md:px-8">
          <Wordmark subtitle="استودیو کمیک" />
          <div className="ms-auto flex shrink-0 items-center gap-1">
            <ThemeButton />
            <Tooltip content="ورود پرونده">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => importRef.current?.click()}
                aria-label="ورود پرونده"
              >
                <FileUp />
              </Button>
            </Tooltip>
            <Tooltip content="تنظیمات">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSettings(true)}
                aria-label="تنظیمات"
              >
                <Settings />
              </Button>
            </Tooltip>
            <Button className="ms-1 hidden md:inline-flex" onClick={() => setOpen(true)}>
              <Plus />
              کمیک تازه
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-10">
        {/* Hero. On a phone it shrinks to a headline + one action so the
            library itself is still above the fold. */}
        <section className="material halftone relative overflow-hidden rounded-2xl px-4 py-4 md:px-8 md:py-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 start-[-10%] size-64 rounded-full bg-brand/16 blur-3xl"
          />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/12 px-2.5 py-1 text-[11px] font-semibold text-brand">
              <Sparkles className="size-3.5" />
              روی همین دستگاه، بدون حساب کاربری
            </span>
            <h1 className="mt-2 font-display text-[24px] leading-tight md:mt-3 md:text-4xl">
              کمیک خودت را قاب به قاب بساز
            </h1>
            <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted md:mt-2 md:text-[15px]">
              قاب بچین، عکس و ویدئو بگذار، حباب بنویس
              <span className="hidden sm:inline">
                {" "}
                و موسیقی اضافه کن؛ بعد مثل یک کمیک واقعی بخوانش
              </span>
              .
            </p>
            <div className="mt-3.5 flex flex-wrap gap-2 md:mt-5">
              <Button className="md:h-12 md:px-5" onClick={() => setOpen(true)}>
                <Plus />
                شروع یک کمیک
              </Button>
              <Button
                variant="outline"
                className="hidden md:inline-flex md:h-12 md:px-5"
                onClick={() => importRef.current?.click()}
              >
                <Upload />
                ورود پرونده
              </Button>
            </div>
          </div>
        </section>

        <div className="sticky top-[72px] z-10 -mx-4 mt-5 bg-bg/85 px-4 py-2 backdrop-blur-xl md:top-[76px] md:-mx-8 md:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-full sm:basis-auto">
              <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-subtle" />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQ("");
                    e.currentTarget.blur();
                  }
                }}
                placeholder="جست‌وجوی کمیک…"
                className="pe-10 ps-9"
                aria-label="جست‌وجو"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  aria-label="پاک‌کردن جست‌وجو"
                  className="tap absolute top-1/2 start-2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-elevated text-muted hover:text-fg"
                >
                  <X className="size-3.5" />
                </button>
              ) : (
                <kbd className="num pointer-events-none absolute top-1/2 start-3 hidden -translate-y-1/2 rounded bg-elevated px-1.5 py-0.5 text-[10px] text-subtle md:block">
                  /
                </kbd>
              )}
            </div>
            <Segmented
              ariaLabel="مرتب‌سازی"
              value={sort}
              onChange={(v) => setSort(v)}
              className="min-w-0 flex-1 sm:flex-none sm:shrink-0"
              options={[
                { value: "updated", label: "آخرین", title: "آخرین ویرایش" },
                { value: "created", label: "ساخت", title: "تاریخ ساخت" },
                { value: "name", label: "نام", title: "بر اساس نام" },
              ]}
            />
            <Segmented
              ariaLabel="نمایش"
              value={view}
              onChange={pickView}
              className="shrink-0"
              options={[
                { value: "grid", label: <LayoutGrid />, title: "شبکه‌ای" },
                { value: "list", label: <Rows3 />, title: "فهرستی" },
              ]}
            />
          </div>
        </div>

        <div className="mb-3 mt-3 flex items-center gap-2 text-[11px] text-muted">
          <Layers className="size-3.5" />
          {library.length ? (
            <span>
              {library.length} کمیک · {totalPages} صفحه
              {q ? ` · ${rows.length} نتیجه` : ""}
            </span>
          ) : (
            <span>کتابخانه خالی است</span>
          )}
        </div>

        {!ready ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton aspect-[4/5] rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          library.length === 0 ? (
            <Empty onNew={() => setOpen(true)} onImport={() => importRef.current?.click()} />
          ) : (
            <NoResults q={q} onClear={() => setQ("")} />
          )
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
            {rows.map((p, i) => (
              <Card
                key={p.id}
                index={i}
                project={p}
                cover={covers[p.id]}
                onOpen={() => go("/studio/$id", { id: p.id })}
                onRead={() => go("/read/$id", { id: p.id })}
                onDup={async () => {
                  const copy = await duplicateProject(p.id);
                  if (copy) toast.success("کپی ساخته شد");
                }}
                onExport={() => void exportProjectFile(p.id)}
                onRename={() => {
                  setRename(p);
                  setRenameVal(p.title);
                }}
                onDel={() => setDel(p)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((p, i) => (
              <Row
                key={p.id}
                index={i}
                project={p}
                cover={covers[p.id]}
                onOpen={() => go("/studio/$id", { id: p.id })}
                onRead={() => go("/read/$id", { id: p.id })}
                onDup={async () => {
                  const copy = await duplicateProject(p.id);
                  if (copy) toast.success("کپی ساخته شد");
                }}
                onExport={() => void exportProjectFile(p.id)}
                onRename={() => {
                  setRename(p);
                  setRenameVal(p.title);
                }}
                onDel={() => setDel(p)}
              />
            ))}
          </div>
        )}
      </main>

      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-hidden={!scrolled}
        tabIndex={scrolled ? 0 : -1}
        className={`tap fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] start-4 z-30 flex h-14 items-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-fg shadow-[var(--shadow-brand),var(--shadow-lift)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:hidden ${
          scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        <Plus className="size-5" />
        کمیک تازه
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>شروع کمیک</DialogTitle>
          <DialogDescription>
            عنوان، جهت خواندن و اندازهٔ صفحه را انتخاب کن. بعداً هم قابل تغییر است.
          </DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="nt">عنوان</Label>
              <Input
                id="nt"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: ماجراجویی در شهر نئون"
                maxLength={120}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
              />
            </div>
            <div>
              <Label htmlFor="nd">توضیح کوتاه</Label>
              <Textarea
                id="nd"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="یک خط دربارهٔ داستان…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>جهت خواندن</Label>
                <Segmented
                  ariaLabel="جهت خواندن"
                  value={dir}
                  onChange={setDir}
                  className="w-full"
                  options={[
                    { value: "rtl", label: "راست به چپ" },
                    { value: "ltr", label: "چپ به راست" },
                  ]}
                />
              </div>
              <div>
                <Label htmlFor="ns">اندازه صفحه</Label>
                <Select id="ns" value={size} onChange={(e) => setSize(e.target.value)}>
                  {PAGE_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button className="flex-1" onClick={() => void create()}>
                ساخت و ورود به ویرایشگر
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                انصراف
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rename} onOpenChange={(v) => !v && setRename(null)}>
        <DialogContent>
          <DialogTitle>نام کمیک</DialogTitle>
          <DialogDescription>نام روی کارت کتابخانه دیده می‌شود.</DialogDescription>
          <Input
            className="mt-4"
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            maxLength={120}
            autoFocus
          />
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              onClick={async () => {
                if (!rename || !renameVal.trim()) return;
                await renameProject(rename.id, renameVal.trim());
                setRename(null);
              }}
            >
              ذخیره
            </Button>
            <Button variant="outline" onClick={() => setRename(null)}>
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={(v) => !v && setDel(null)}>
        <DialogContent>
          <DialogTitle>حذف «{del?.title}»؟</DialogTitle>
          <DialogDescription>
            این کار برگشت ندارد. پرونده روی همین دستگاه پاک می‌شود.
          </DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                if (!del) return;
                await removeProject(del.id);
                setDel(null);
              }}
            >
              <Trash2 />
              حذف کمیک
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => setDel(null)}>
              انصراف
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={settings} onOpenChange={setSettings}>
        <DialogContent>
          <DialogTitle>تنظیمات</DialogTitle>
          <DialogDescription>این‌ها فقط روی همین دستگاه ذخیره می‌شوند.</DialogDescription>
          <div className="mt-4 space-y-4">
            <div>
              <Label>ظاهر</Label>
              <ThemePicker />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="sd">جهت پیش‌فرض</Label>
                <Select
                  id="sd"
                  value={prefs.defaultDirection}
                  onChange={(e) => {
                    const next = { ...prefs, defaultDirection: e.target.value as "rtl" | "ltr" };
                    setPrefs(next);
                    savePrefs(next);
                    setDir(next.defaultDirection);
                  }}
                >
                  <option value="rtl">راست به چپ</option>
                  <option value="ltr">چپ به راست</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ss">اندازه پیش‌فرض صفحه</Label>
                <Select
                  id="ss"
                  value={prefs.defaultSize}
                  onChange={(e) => {
                    const next = { ...prefs, defaultSize: e.target.value };
                    setPrefs(next);
                    savePrefs(next);
                    setSize(next.defaultSize);
                  }}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <label className="flex items-center justify-between gap-3 rounded-lg bg-elevated px-3 py-2.5 text-sm">
              <span>
                چسبیدن به مرکز هنگام جابه‌جایی
                <span className="mt-0.5 block text-[11px] text-muted">
                  قاب‌ها موقع کشیدن به وسط صفحه می‌چسبند.
                </span>
              </span>
              <Switch
                checked={prefs.snap}
                onCheckedChange={(v) => {
                  const next = { ...prefs, snap: v };
                  setPrefs(next);
                  savePrefs(next);
                }}
              />
            </label>
            <Button variant="outline" className="w-full" onClick={() => void downloadStudioHtml()}>
              <Download />
              دانلود فایل HTML استودیو
            </Button>
            <p className="text-[11px] leading-relaxed text-muted">
              کمیک‌ها و فایل‌ها در حافظهٔ همین مرورگر ذخیره می‌شوند. برای نگه‌داشتن نسخهٔ پشتیبان،
              از هر کمیک «خروجی پرونده» بگیر.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json,.kader.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const p = await importProjectFile(f);
            go("/studio/$id", { id: p.id });
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "ورود ناموفق بود");
          }
        }}
      />
    </div>
  );
}

function ThemeButton() {
  const { choice, resolved, set } = useTheme();
  const next: ThemeChoice = resolved === "dark" ? "light" : "dark";
  return (
    <Tooltip content={resolved === "dark" ? "روشن کن" : "تاریک کن"}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="تغییر ظاهر"
        onClick={() => set(next)}
        title={choice === "system" ? "هماهنگ با سیستم" : undefined}
      >
        {resolved === "dark" ? <Sun /> : <Moon />}
      </Button>
    </Tooltip>
  );
}

function ThemePicker() {
  const { choice, set } = useTheme();
  return (
    <Segmented
      ariaLabel="ظاهر"
      value={choice}
      onChange={set}
      className="w-full"
      options={[
        { value: "system", label: <Monitor />, title: "هماهنگ با سیستم" },
        { value: "light", label: <Sun />, title: "روشن" },
        { value: "dark", label: <Moon />, title: "تاریک" },
      ]}
    />
  );
}

/** Placeholder art for a comic with no cover yet — a tiny page layout instead
 *  of a lonely icon, so an empty card still looks like part of the product. */
function CoverFallback({ seed }: { seed: string }) {
  const variant = seed.charCodeAt(0) % 3;
  return (
    <div className="halftone grid size-full place-items-center bg-elevated">
      <svg viewBox="0 0 60 76" className="h-[62%] w-auto text-subtle/70" fill="none">
        {variant === 0 && (
          <>
            <rect x="6" y="6" width="48" height="28" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect
              x="6"
              y="40"
              width="22"
              height="30"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="32"
              y="40"
              width="22"
              height="30"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
          </>
        )}
        {variant === 1 && (
          <>
            <rect x="6" y="6" width="22" height="30" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect
              x="32"
              y="6"
              width="22"
              height="30"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="6"
              y="42"
              width="48"
              height="28"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
          </>
        )}
        {variant === 2 && (
          <>
            <rect x="6" y="6" width="48" height="20" rx="2" stroke="currentColor" strokeWidth="2" />
            <rect
              x="6"
              y="32"
              width="48"
              height="18"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <rect
              x="6"
              y="56"
              width="48"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
          </>
        )}
        <rect
          x="14"
          y="12"
          width="20"
          height="9"
          rx="4.5"
          fill="var(--color-brand)"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

function ItemMenu({
  onDup,
  onRename,
  onExport,
  onDel,
}: {
  onDup: () => void;
  onRename: () => void;
  onExport: () => void;
  onDel: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="بیشتر">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onDup}>
          <Copy />
          کپی
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onRename}>
          <Pencil />
          تغییر نام
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onExport}>
          <Download />
          خروجی پرونده
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDel} className="text-danger [&_svg]:text-danger">
          <Trash2 />
          حذف
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Card({
  project,
  cover,
  index,
  onOpen,
  onRead,
  onDup,
  onDel,
  onExport,
  onRename,
}: {
  project: ProjectMeta;
  cover?: string;
  index: number;
  onOpen: () => void;
  onRead: () => void;
  onDup: () => void;
  onDel: () => void;
  onExport: () => void;
  onRename: () => void;
}) {
  return (
    <article
      className="material group relative overflow-hidden rounded-xl transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] animate-rise"
      style={{ animationDelay: `${Math.min(index, 7) * 35}ms` }}
    >
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <div className="relative aspect-[4/5] overflow-hidden bg-elevated">
          {cover ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
            />
          ) : (
            <CoverFallback seed={project.id} />
          )}
          <div className="pointer-events-none absolute inset-0 shadow-[inset_0_-40px_60px_-40px_rgba(0,0,0,0.9)]" />
          <div className="absolute top-2 end-2 flex gap-1">
            {project.sample && <Badge tone="brand">نمونه</Badge>}
          </div>
          <div className="absolute bottom-2 start-2 flex items-center gap-1 rounded-full bg-bg/75 px-2 py-0.5 text-[10px] text-fg backdrop-blur-sm">
            <BookOpen className="size-3" />
            <span className="num">{project.pageCount}</span>
          </div>
        </div>
        <div className="p-3 pb-1.5">
          <div className="truncate text-sm font-semibold">{project.title}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted">
            <Clock className="size-3" />
            {formatRelativeFa(project.updatedAt)}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1 px-2 pb-2">
        <Button variant="secondary" size="sm" className="flex-1" onClick={onRead}>
          <BookOpen />
          خواندن
        </Button>
        <ItemMenu onDup={onDup} onRename={onRename} onExport={onExport} onDel={onDel} />
      </div>
    </article>
  );
}

function Row({
  project,
  cover,
  index,
  onOpen,
  onRead,
  onDup,
  onDel,
  onExport,
  onRename,
}: {
  project: ProjectMeta;
  cover?: string;
  index: number;
  onOpen: () => void;
  onRead: () => void;
  onDup: () => void;
  onDel: () => void;
  onExport: () => void;
  onRename: () => void;
}) {
  return (
    <article
      className="material group flex items-center gap-3 overflow-hidden rounded-xl p-2 transition-colors hover:bg-elevated animate-rise"
      style={{ animationDelay: `${Math.min(index, 9) * 25}ms` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-start"
      >
        <span className="block h-16 w-[3.25rem] shrink-0 overflow-hidden rounded-lg bg-elevated">
          {cover ? (
            <img src={cover} alt="" loading="lazy" className="size-full object-cover" />
          ) : (
            <CoverFallback seed={project.id} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{project.title}</span>
            {project.sample && <Badge tone="brand">نمونه</Badge>}
          </span>
          <span className="mt-1 flex items-center gap-2 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <BookOpen className="size-3" />
              <span className="num">{project.pageCount}</span> صفحه
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatRelativeFa(project.updatedAt)}
            </span>
          </span>
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onRead}>
          خواندن
        </Button>
        <ItemMenu onDup={onDup} onRename={onRename} onExport={onExport} onDel={onDel} />
      </div>
    </article>
  );
}

function Empty({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <div className="material halftone relative overflow-hidden rounded-2xl px-6 py-14 text-center">
      <div className="relative mx-auto mb-5 w-32">
        <svg viewBox="0 0 120 92" className="w-full text-line" fill="none">
          <rect
            x="4"
            y="10"
            width="54"
            height="34"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <rect
            x="66"
            y="10"
            width="50"
            height="34"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <rect
            x="4"
            y="52"
            width="112"
            height="34"
            rx="4"
            stroke="currentColor"
            strokeWidth="2.5"
          />
          <rect x="16" y="20" width="30" height="13" rx="6.5" fill="var(--color-brand)" />
          <path d="M22 33 L22 40 L30 33 Z" fill="var(--color-brand)" />
          <rect x="78" y="22" width="26" height="4" rx="2" fill="currentColor" />
          <rect x="78" y="30" width="18" height="4" rx="2" fill="currentColor" />
        </svg>
      </div>
      <h2 className="font-display text-2xl">اولین کمیکت را بساز</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
        یک پروژهٔ تازه بساز یا پرونده‌ای که قبلاً خروجی گرفتی را وارد کن. چیزی روی اینترنت فرستاده
        نمی‌شود.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button size="lg" onClick={onNew}>
          <Plus />
          کمیک تازه
        </Button>
        <Button size="lg" variant="outline" onClick={onImport}>
          <Upload />
          ورود پرونده
        </Button>
      </div>
    </div>
  );
}

function NoResults({ q, onClear }: { q: string; onClear: () => void }) {
  return (
    <div className="material rounded-2xl px-6 py-12 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-full bg-elevated text-subtle">
        <Search className="size-5" />
      </div>
      <h2 className="text-base font-semibold">چیزی برای «{q}» پیدا نشد</h2>
      <p className="mt-1 text-sm text-muted">شاید نام دیگری داشته باشد.</p>
      <Button variant="outline" className="mt-4" onClick={onClear}>
        پاک‌کردن جست‌وجو
      </Button>
    </div>
  );
}
