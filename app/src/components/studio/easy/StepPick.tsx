import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Film, ImagePlus, Images, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { intakeFile } from "@/lib/comic/asset-intake";
import { ensureAssetUrl, listAssets, thumbUrl } from "@/lib/comic/db";
import { useEasy } from "@/lib/comic/easy-store";
import type { AssetMeta } from "@/lib/comic/types";

export function StepPick() {
  const shots = useEasy((s) => s.shots);
  const title = useEasy((s) => s.title);
  const setTitle = useEasy((s) => s.setTitle);
  const addShot = useEasy((s) => s.addShot);
  const removeShot = useEasy((s) => s.removeShot);
  const moveShot = useEasy((s) => s.moveShot);
  const fileRef = useRef<HTMLInputElement>(null);
  const [library, setLibrary] = useState<AssetMeta[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [images, videos] = await Promise.all([listAssets("image"), listAssets("video")]);
      const rows = [...images, ...videos].sort((a, b) => b.createdAt - a.createdAt);
      await Promise.all(rows.slice(0, 40).map((a) => ensureAssetUrl(a.id)));
      setLibrary(rows);
    })();
  }, [shots.length]);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      for (const file of [...list]) {
        const rec = await intakeFile(file);
        if (!rec) {
          toast.message(`این فایل پشتیبانی نمی‌شود: ${file.name}`);
          continue;
        }
        addShot(
          rec.id,
          rec.name,
          (rec.width || 1) / Math.max(1, rec.height || 1),
          rec.kind === "video" ? "video" : "image",
          rec.duration || 0,
        );
      }
      toast.success("به فهرست اضافه شد");
    } catch {
      toast.error("خواندن فایل‌ها ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <Label htmlFor="easy-title">نام کمیک (اختیاری)</Label>
        <Input
          id="easy-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: شب اول"
          maxLength={120}
        />
      </div>

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="tap flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface px-6 py-8 text-center hover:border-brand/60 hover:bg-elevated"
      >
        <span className="grid size-12 place-items-center rounded-full bg-brand/12 text-brand">
          <ImagePlus className="size-6" />
        </span>
        <span className="text-sm font-semibold">
          {busy ? "در حال افزودن…" : "عکس یا ویدئو انتخاب کن"}
        </span>
        <span className="text-[11px] text-muted">
          چند تا با هم — ترتیبشان همان ترتیب قاب‌های کمیک است.
        </span>
      </button>

      {shots.length > 0 && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-xs font-semibold">
              انتخاب‌شده‌ها <span className="num text-muted">({shots.length})</span>
            </h2>
            <span className="ms-auto text-[11px] text-muted">با فلش‌ها ترتیب را عوض کن</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {shots.map((shot, i) => (
              <figure
                key={shot.id}
                className="material group relative overflow-hidden rounded-xl bg-elevated"
              >
                <span className="num absolute top-1 start-1 z-10 rounded-full bg-bg/80 px-1.5 text-[10px] font-semibold">
                  {i + 1}
                </span>
                <button
                  type="button"
                  aria-label="حذف"
                  onClick={() => removeShot(shot.id)}
                  className="tap absolute top-1 end-1 z-10 grid size-6 place-items-center rounded-full bg-bg/80 text-danger"
                >
                  <X className="size-3.5" />
                </button>
                {thumbUrl(shot.assetId) ? (
                  <img
                    src={thumbUrl(shot.assetId)}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-square w-full place-items-center text-subtle">
                    {shot.kind === "video" ? (
                      <Film className="size-6" />
                    ) : (
                      <Images className="size-6" />
                    )}
                  </div>
                )}
                {shot.kind === "video" && (
                  <span className="absolute bottom-9 start-1 z-10 flex items-center gap-1 rounded-full bg-bg/85 px-1.5 py-0.5 text-[10px] text-brand">
                    <Film className="size-2.5" />
                    ویدئو
                  </span>
                )}
                <figcaption className="flex items-center justify-between gap-1 p-1">
                  <button
                    type="button"
                    aria-label="جابه‌جایی به عقب"
                    disabled={i === 0}
                    onClick={() => moveShot(shot.id, -1)}
                    className="tap grid size-7 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg disabled:opacity-30"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="جابه‌جایی به جلو"
                    disabled={i === shots.length - 1}
                    onClick={() => moveShot(shot.id, 1)}
                    className="tap grid size-7 place-items-center rounded-md text-muted hover:bg-bg hover:text-fg disabled:opacity-30"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {library.length > 0 && (
        <section>
          <h2 className="mb-1 text-xs font-semibold">فایل‌های همین دستگاه</h2>
          <p className="mb-2 text-[11px] text-muted">
            هر کدام را بزنی به انتهای فهرست اضافه می‌شود — می‌توانی یک عکس را چند بار هم بگذاری.
          </p>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8">
            {library.slice(0, 32).map((a) => (
              <button
                key={a.id}
                type="button"
                title={a.name}
                onClick={() =>
                  addShot(
                    a.id,
                    a.name,
                    (a.width || 1) / Math.max(1, a.height || 1),
                    a.kind === "video" ? "video" : "image",
                    a.duration || 0,
                  )
                }
                className="tap relative aspect-square overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]"
              >
                {thumbUrl(a.id) ? (
                  <img src={thumbUrl(a.id)} alt="" className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-[10px] text-muted">
                    {a.kind === "video" ? (
                      <Film className="size-4" />
                    ) : (
                      <Images className="size-4" />
                    )}
                  </span>
                )}
                {a.kind === "video" && (
                  <span className="absolute bottom-1 start-1 grid size-4 place-items-center rounded-full bg-bg/80 text-brand">
                    <Film className="size-2.5" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {shots.length === 0 && library.length === 0 && (
        <p className="text-center text-sm text-muted">
          هنوز چیزی نیست. از دکمهٔ بالا چند عکس یا ویدئو بردار تا شروع کنیم.
        </p>
      )}

      {shots.length > 0 && (
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => shots.forEach((s) => removeShot(s.id))}
        >
          <Trash2 />
          پاک‌کردن همه
        </Button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          void onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
