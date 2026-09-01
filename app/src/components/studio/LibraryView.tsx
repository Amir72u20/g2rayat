import { useEffect, useMemo, useRef, useState } from "react";
import { useAppNav } from "@/lib/comic/nav";
import { BookOpen, Copy, Download, FolderOpen, MoreHorizontal, Pencil, Plus, Search, Settings, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useStudio } from "@/lib/comic/store";
import { PAGE_SIZES, type ProjectMeta } from "@/lib/comic/types";
import { ensureAssetUrl, thumbUrl } from "@/lib/comic/db";
import { formatRelativeFa } from "@/lib/utils";
import { loadPrefs, savePrefs, type StudioPrefs } from "@/lib/comic/prefs";

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
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "name">("updated");
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

  useEffect(() => {
    void boot();
    const p = loadPrefs();
    setPrefs(p);
    setDir(p.defaultDirection);
    setSize(p.defaultSize);
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
      <header className="sticky top-0 z-20 border-b border-line bg-bg/92 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-lg bg-elevated shadow-[var(--shadow-border)]">
                <BookOpen className="size-4 text-steel" />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] font-medium tracking-wide text-muted">استودیو کمیک</div>
                <h1 className="truncate text-lg font-semibold leading-tight">کادر</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => importRef.current?.click()} aria-label="ورود پرونده">
                <Upload />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSettings(true)} aria-label="تنظیمات">
                <Settings />
              </Button>
            </div>
            <div className="ms-auto hidden md:block">
              <Button onClick={() => setOpen(true)}>
                <Plus />
                کمیک تازه
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 end-3 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="جست‌وجوی کمیک…"
                className="pe-10"
                aria-label="جست‌وجو"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-11 w-28 shrink-0 rounded-md bg-bg px-2 text-sm shadow-[var(--shadow-border)] md:w-36"
              aria-label="مرتب‌سازی"
            >
              <option value="updated">آخرین</option>
              <option value="created">ساخت</option>
              <option value="name">نام</option>
            </select>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 md:px-8 md:pb-8">
        <p className="mb-4 text-sm text-muted">کمیک بساز، قاب بچین، از فایل خودت عکس و ویدئو بگذار. همه‌چیز روی همین دستگاه است.</p>

        {!ready ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] animate-pulse rounded-xl bg-surface" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Empty onNew={() => setOpen(true)} onImport={() => importRef.current?.click()} />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((p) => (
              <Card
                key={p.id}
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
        className="fixed bottom-6 start-4 z-30 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-fg shadow-[var(--shadow-lift)] md:hidden"
      >
        <Plus className="size-5" />
        کمیک تازه
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>شروع کمیک</DialogTitle>
          <DialogDescription>عنوان، جهت خواندن و اندازهٔ صفحه را انتخاب کن. بعداً هم قابل تغییر است.</DialogDescription>
          <div className="mt-4 space-y-3">
            <div>
              <Label htmlFor="nt">عنوان</Label>
              <Input id="nt" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً: ماجراجویی در شهر نئون" maxLength={120} />
            </div>
            <div>
              <Label htmlFor="nd">توضیح کوتاه</Label>
              <Textarea id="nd" value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={500} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>جهت خواندن</Label>
                <select
                  value={dir}
                  onChange={(e) => setDir(e.target.value as "rtl" | "ltr")}
                  className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
                >
                  <option value="rtl">راست به چپ</option>
                  <option value="ltr">چپ به راست</option>
                </select>
              </div>
              <div>
                <Label>اندازه صفحه</Label>
                <select
                  value={size}
                  onChange={(e) => setSize(e.target.value)}
                  className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
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
          <Input className="mt-4" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} maxLength={120} />
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
          <DialogDescription>این کار برگشت ندارد. پرونده روی همین دستگاه پاک می‌شود.</DialogDescription>
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
              حذف
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
          <div className="mt-4 space-y-3">
            <div>
              <Label>جهت پیش‌فرض</Label>
              <select
                className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
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
              </select>
            </div>
            <div>
              <Label>اندازه پیش‌فرض صفحه</Label>
              <select
                className="h-11 w-full rounded-md bg-bg px-3 text-sm shadow-[var(--shadow-border)]"
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
              </select>
            </div>
            <label className="flex items-center justify-between text-sm">
              چسبیدن به مرکز هنگام جابه‌جایی
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

function Empty({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <div className="rounded-xl bg-surface px-6 py-16 text-center shadow-[var(--shadow-border)]">
      <div className="mx-auto mb-4 grid size-14 place-items-center rounded-xl bg-elevated">
        <FolderOpen className="size-6 text-steel" />
      </div>
      <h2 className="text-lg font-semibold">اولین کمیکت را بساز</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
        یک پروژه تازه بساز یا پرونده‌ای که قبلاً خروجی گرفتی را وارد کن.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={onNew}>
          <Plus />
          کمیک تازه
        </Button>
        <Button variant="outline" onClick={onImport}>
          <Upload />
          ورود پرونده
        </Button>
      </div>
    </div>
  );
}

function Card({
  project,
  cover,
  onOpen,
  onRead,
  onDup,
  onDel,
  onExport,
  onRename,
}: {
  project: ProjectMeta;
  cover?: string;
  onOpen: () => void;
  onRead: () => void;
  onDup: () => void;
  onDel: () => void;
  onExport: () => void;
  onRename: () => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5">
      <button type="button" onClick={onOpen} className="block w-full text-start">
        <div className="relative aspect-[4/5] overflow-hidden bg-elevated">
          {cover ? (
            <img src={cover} alt="" className="size-full object-cover" />
          ) : (
            <div className="grid size-full place-items-center text-subtle">
              <BookOpen className="size-8" />
            </div>
          )}
          {project.sample && (
            <span className="absolute top-2 end-2 rounded-full bg-bg/80 px-2 py-0.5 text-[10px] font-medium">
              نمونه
            </span>
          )}
        </div>
        <div className="p-3">
          <div className="truncate text-sm font-semibold">{project.title}</div>
          <div className="mt-0.5 text-[11px] text-muted">
            {project.pageCount} صفحه · {formatRelativeFa(project.updatedAt)}
          </div>
        </div>
      </button>
        <div className="flex items-center gap-1 px-2 pb-2">
          <Button variant="ghost" size="sm" className="flex-1" onClick={onRead}>
            خواندن
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="بیشتر">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onDup}>
                <Copy className="size-4" />
                کپی
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onRename}>
                <Pencil className="size-4" />
                تغییر نام
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onExport}>
                <Upload className="size-4 rotate-180" />
                خروجی
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onDel} className="text-danger">
                <Trash2 className="size-4" />
                حذف
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
    </article>
  );
}
