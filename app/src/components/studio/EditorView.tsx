import { useEffect, useRef, useState } from "react";
import { useAppNav } from "@/lib/comic/nav";
import {
  ChevronRight,
  Copy,
  Eye,
  Film,
  Image,
  ImagePlus,
  Keyboard,
  Layers,
  Maximize,
  MessageCircle,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Music,
  Palette,
  Pencil,
  Plus,
  Redo2,
  Save,
  Square,
  SquareDashed,
  Trash2,
  Type,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { BottomSheet } from "@/components/ui/sheet";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShortcutsDialog } from "./Shortcuts";
import { CanvasStage } from "./CanvasStage";
import { Inspector, AudioEditor } from "./Inspector";
import { PageStrip } from "./PageStrip";
import { LayoutGrid, PageBackgroundPicker, PanelKindGrid } from "./ComicBits";
import { useStudio } from "@/lib/comic/store";
import { downloadBlob } from "@/lib/utils";
import { renderPageToCanvas } from "@/lib/comic/draw";
import { getMediaBag, loadImageAsset, loadVideoAsset } from "@/lib/comic/media-cache";
import { collectAssetIds, ensureAllUrls, thumbUrl } from "@/lib/comic/db";
import type { BubbleKind, PanelKind, ShapeKind, StudioSheet } from "@/lib/comic/types";

/** Ink palette for the pen — comic blacks, paper white, and the studio accent. */
const INK_COLORS = ["#15171c", "#ffffff", "#ef6446", "#2f6df6", "#f4b942", "#2fa96b"];

const BUBBLES: { k: BubbleKind; n: string }[] = [
  { k: "round", n: "گفتگو" },
  { k: "think", n: "فکر" },
  { k: "shout", n: "فریاد" },
  { k: "whisper", n: "نجوا" },
  { k: "caption", n: "روایت" },
  { k: "rect", n: "مستطیل" },
];

const SHAPES: { k: ShapeKind; n: string }[] = [
  { k: "rect", n: "مستطیل" },
  { k: "round", n: "گرد" },
  { k: "circle", n: "دایره" },
  { k: "arrow", n: "پیکان" },
];

export function EditorView({ id }: { id: string }) {
  const go = useAppNav();
  const boot = useStudio((s) => s.boot);
  const project = useStudio((s) => s.project);
  const openProject = useStudio((s) => s.openProject);
  const setTitle = useStudio((s) => s.setTitle);
  const undoAction = useStudio((s) => s.undoAction);
  const redoAction = useStudio((s) => s.redoAction);
  const undo = useStudio((s) => s.undo);
  const redo = useStudio((s) => s.redo);
  const viewZoom = useStudio((s) => s.viewZoom);
  const setZoom = useStudio((s) => s.setZoom);
  const saveStatus = useStudio((s) => s.saveStatus);
  const addBubble = useStudio((s) => s.addBubble);
  const addText = useStudio((s) => s.addText);
  const addShape = useStudio((s) => s.addShape);
  const addPage = useStudio((s) => s.addPage);
  const addPanel = useStudio((s) => s.addPanel);
  const setTab = useStudio((s) => s.setTab);
  const sheet = useStudio((s) => s.sheet);
  const setSheet = useStudio((s) => s.setSheet);
  const importFiles = useStudio((s) => s.importFiles);
  const cyclePanels = useStudio((s) => s.cyclePanels);
  const deleteSelected = useStudio((s) => s.deleteSelected);
  const duplicateSelected = useStudio((s) => s.duplicateSelected);
  const copySelected = useStudio((s) => s.copySelected);
  const pasteClipboard = useStudio((s) => s.pasteClipboard);
  const saveNow = useStudio((s) => s.saveNow);
  const selected = useStudio((s) => s.selected());
  const tool = useStudio((s) => s.tool);
  const setTool = useStudio((s) => s.setTool);
  const requestEdit = useStudio((s) => s.requestEdit);
  const wantEdit = useStudio((s) => s.wantEdit);
  const exportProjectFile = useStudio((s) => s.exportProjectFile);
  const setCoverFromPage = useStudio((s) => s.setCoverFromPage);
  const nudgeSelected = useStudio((s) => s.nudgeSelected);
  const persistError = useStudio((s) => s.persistError);
  const drawColor = useStudio((s) => s.drawColor);
  const drawWidth = useStudio((s) => s.drawWidth);
  const setDrawColor = useStudio((s) => s.setDrawColor);
  const setDrawWidth = useStudio((s) => s.setDrawWidth);
  const select = useStudio((s) => s.select);
  const assets = useStudio((s) => s.assets);

  const imageInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const pickOpts = useRef<{ panelId?: string; extra?: string }>({});
  const spacePrev = useRef<"select" | "draw" | "pan" | "panel" | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const st = useStudio.getState();
      const tasks: Promise<void>[] = [];
      if (!st.ready) tasks.push(st.boot());
      if (st.project?.id !== id) tasks.push(st.openProject(id));
      else {
        const p = st.project;
        if (p)
          void ensureAllUrls(collectAssetIds(p)).then(() =>
            useStudio.setState({ mediaTick: Date.now() }),
          );
      }
      await Promise.all(tasks);
      if (!live) return;
      if (useStudio.getState().project?.id !== id) await useStudio.getState().openProject(id);
    })();
    return () => {
      live = false;
      void useStudio
        .getState()
        .saveNow()
        .catch(() => undefined);
    };
  }, [id, boot, openProject]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "hidden") {
        const p = useStudio.getState().project;
        if (p && useStudio.getState().dirty)
          void useStudio
            .getState()
            .saveNow()
            .catch(() => undefined);
        return;
      }
      const p = useStudio.getState().project;
      if (!p) return;
      void ensureAllUrls(collectAssetIds(p)).then(() => {
        useStudio.setState({ mediaTick: Date.now() });
        collectAssetIds(p).forEach((aid) => {
          loadImageAsset(aid, () => useStudio.setState({ mediaTick: Date.now() }));
          loadVideoAsset(aid, () => useStudio.setState({ mediaTick: Date.now() }));
        });
      });
    }
    function onHide() {
      const p = useStudio.getState().project;
      if (p && useStudio.getState().dirty)
        void useStudio
          .getState()
          .saveNow()
          .catch(() => undefined);
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onVis);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onVis);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  useEffect(() => {
    function onLeave(e: BeforeUnloadEvent) {
      if (!useStudio.getState().persistError) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing =
        tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (e.code === "Space" && !typing) {
        if (!spacePrev.current) {
          spacePrev.current = useStudio.getState().tool;
          setTool("pan");
        }
        e.preventDefault();
        return;
      }
      const cmd = e.ctrlKey || e.metaKey;
      if (cmd && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redoAction();
        else undoAction();
        return;
      }
      if (cmd && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redoAction();
        return;
      }
      if (cmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (cmd && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }
      if (cmd && e.key.toLowerCase() === "c" && !typing) {
        e.preventDefault();
        copySelected();
        return;
      }
      if (cmd && e.key.toLowerCase() === "v" && !typing) {
        e.preventDefault();
        pasteClipboard();
        return;
      }
      if (cmd && e.key.toLowerCase() === "a" && !typing) {
        e.preventDefault();
        const page = useStudio.getState().page();
        const top = page ? [...page.items].reverse().find((i) => !i.hidden) : null;
        if (top) select(top.id);
        return;
      }
      if (cmd && (e.key === "0" || e.code === "Digit0")) {
        e.preventDefault();
        setZoom(1);
        return;
      }
      if (cmd && (e.key === "+" || e.key === "=")) {
        e.preventDefault();
        setZoom(useStudio.getState().viewZoom + 0.1);
        return;
      }
      if (cmd && e.key === "-") {
        e.preventDefault();
        setZoom(useStudio.getState().viewZoom - 0.1);
        return;
      }
      if (typing) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        cyclePanels(e.shiftKey ? -1 : 1);
      }
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if (e.key === "Escape") {
        setSheet(null);
        setTool("select");
        select(null);
      }
      if (
        e.key === "ArrowLeft" ||
        e.key === "ArrowRight" ||
        e.key === "ArrowUp" ||
        e.key === "ArrowDown"
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 24 : 4;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        nudgeSelected(dx, dy);
      }
    }
    function onUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setTool(spacePrev.current || "select");
        spacePrev.current = null;
      }
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onUp);
    };
  }, [
    cyclePanels,
    copySelected,
    deleteSelected,
    duplicateSelected,
    nudgeSelected,
    pasteClipboard,
    redoAction,
    saveNow,
    select,
    setSheet,
    setTool,
    setZoom,
    undoAction,
  ]);

  function pick(kind: "image" | "video" | "audio", panelId?: string, extra?: string) {
    pickOpts.current = { panelId, extra };
    if (kind === "image") imageInput.current?.click();
    else if (kind === "video") videoInput.current?.click();
    else audioInput.current?.click();
  }

  function onFiles(kind: "image" | "video" | "audio", list: FileList | null) {
    if (!list?.length) return;
    const extra = pickOpts.current.extra;
    const target =
      extra === "bg"
        ? "bg"
        : extra === "panel-audio"
          ? "panel-audio"
          : extra === "free"
            ? "free"
            : kind === "audio"
              ? "audio"
              : "page";
    void importFiles([...list], { target, panelId: pickOpts.current.panelId });
  }

  async function exportPage(all = false) {
    const p = useStudio.getState().project;
    if (!p) return;
    await Promise.all(
      collectAssetIds(p).map(
        (aid) =>
          new Promise<void>((res) => {
            loadImageAsset(aid, res);
            loadVideoAsset(aid, res);
            setTimeout(res, 400);
          }),
      ),
    );
    const pages = all ? p.pages : [p.pages[useStudio.getState().pageIndex]].filter(Boolean);
    for (let i = 0; i < pages.length; i++) {
      const cv = renderPageToCanvas(pages[i], getMediaBag(), 1);
      const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, "image/png"));
      if (blob) downloadBlob(blob, `${p.title || "comic"}-${i + 1}.png`);
    }
    toast.success(all ? "صفحه‌ها ذخیره شدند" : "صفحه ذخیره شد");
  }

  function openSheet(s: StudioSheet, tab?: Parameters<typeof setTab>[0]) {
    if (tab) setTab(tab);
    setSheet(s);
  }

  async function goHome() {
    try {
      await saveNow();
      go("/");
    } catch {
      setLeaveOpen(true);
    }
  }

  const fileInputs = (
    <>
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFiles("image", e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*,video/mp4,video/webm,video/quicktime"
        className="hidden"
        onChange={(e) => {
          onFiles("video", e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={audioInput}
        type="file"
        accept="audio/*,audio/mpeg,audio/wav,audio/ogg,audio/mp4,.mp3,.wav,.ogg,.m4a"
        className="hidden"
        onChange={(e) => {
          onFiles("audio", e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );

  if (!project || project.id !== id) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-muted">
        {fileInputs}
        <span>در حال باز کردن استودیو…</span>
      </div>
    );
  }

  const saveTone = persistError
    ? "danger"
    : saveStatus === "saved"
      ? "ok"
      : saveStatus === "saving"
        ? "warn"
        : "idle";
  const savedLabel = persistError
    ? "ذخیره نشد"
    : saveStatus === "saved"
      ? "ذخیره شد"
      : saveStatus === "saving"
        ? "در حال ذخیره"
        : "ذخیره‌نشده";

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden overscroll-none bg-bg text-fg">
      {fileInputs}
      <header className="z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-surface px-2 pl-16 md:px-3">
        <Tooltip content="کتابخانه">
          <Button variant="ghost" size="icon-sm" onClick={() => void goHome()} aria-label="بازگشت">
            <ChevronRight />
          </Button>
        </Tooltip>
        <Input
          value={project.title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-9 min-w-0 flex-1 bg-transparent font-semibold shadow-none hover:bg-elevated focus-visible:bg-bg md:max-w-xs"
          aria-label="نام کمیک"
        />
        <SaveState tone={saveTone} label={savedLabel} />
        <div className="ms-auto flex items-center gap-0.5">
          <Tooltip content="واگرد" shortcut="Ctrl Z">
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={undoAction}
              disabled={!undo.length}
              aria-label="واگرد"
            >
              <Undo2 />
            </Button>
          </Tooltip>
          <Tooltip content="ازنو" shortcut="Ctrl Y">
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              onClick={redoAction}
              disabled={!redo.length}
              aria-label="ازنو"
            >
              <Redo2 />
            </Button>
          </Tooltip>
          <span className="mx-1 hidden h-6 w-px bg-line md:block" />
          <Tooltip content="ذخیره" shortcut="Ctrl S">
            <Button
              variant={saveStatus === "unsaved" || persistError ? "default" : "ghost"}
              size="sm"
              onClick={() => void saveNow().then(() => toast.success("ذخیره شد"))}
              aria-label="ذخیره"
            >
              <Save />
              <span className="hidden sm:inline">ذخیره</span>
            </Button>
          </Tooltip>
          <Tooltip content="کمیک را مثل خواننده ببین">
            <Button
              variant="outline"
              size="sm"
              aria-label="پیش‌نمایش"
              onClick={() => {
                void saveNow()
                  .catch(() => undefined)
                  .finally(() => go("/read/$id", { id: project.id }));
              }}
            >
              <Eye />
              <span className="hidden sm:inline">پیش‌نمایش</span>
            </Button>
          </Tooltip>
          <Tooltip content="کلیدهای میان‌بر" shortcut="؟">
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden lg:inline-flex"
              onClick={() => setShortcutsOpen(true)}
              aria-label="کلیدهای میان‌بر"
            >
              <Keyboard />
            </Button>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="بیشتر">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>ویرایش</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => undoAction()}>
                <Undo2 />
                واگرد
                <DropdownMenuShortcut>Ctrl Z</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => redoAction()}>
                <Redo2 />
                ازنو
                <DropdownMenuShortcut>Ctrl Y</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>نما</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setZoom(viewZoom - 0.1)}>
                <ZoomOut />
                کوچک‌نمایی
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setZoom(viewZoom + 0.1)}>
                <ZoomIn />
                بزرگ‌نمایی
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setZoom(1)}>
                <Maximize />
                اندازه واقعی
                <DropdownMenuShortcut>Ctrl 0</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>خروجی و صفحه‌ها</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void exportPage(false)}>
                <Image />
                خروجی PNG این صفحه
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void exportProjectFile()}>
                <Save />
                خروجی پرونده
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void setCoverFromPage()}>
                <Square />
                این صفحه جلد شود
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openSheet("pages", "pages")}>
                <Layers />
                صفحه‌ها
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setShortcutsOpen(true)}>
                <Keyboard />
                کلیدهای میان‌بر
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-60 shrink-0 flex-col border-e border-line bg-surface lg:flex">
          <div className="flex items-center gap-2 border-b border-line-soft px-3 py-2.5">
            <span className="text-xs font-semibold">صفحه‌ها</span>
            <span className="num rounded-full bg-elevated px-1.5 py-0.5 text-[10px] text-muted">
              {project.pages.length}
            </span>
            <Tooltip content="صفحه تازه">
              <Button
                variant="ghost"
                size="icon-sm"
                className="ms-auto"
                onClick={addPage}
                aria-label="صفحه تازه"
              >
                <Plus />
              </Button>
            </Tooltip>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <PageStrip variant="col" />
          </div>
        </aside>

        <aside className="hidden w-14 shrink-0 flex-col items-center gap-1 border-e border-line bg-surface py-3 lg:flex">
          <RailIcon
            active={tool === "select"}
            label="انتخاب"
            shortcut="Esc"
            onClick={() => setTool("select")}
          >
            <MousePointer2 className="size-[18px]" />
          </RailIcon>
          <RailIcon active={tool === "panel"} label="کشیدن قاب" onClick={() => setTool("panel")}>
            <SquareDashed className="size-[18px]" />
          </RailIcon>
          <RailDivider />
          <RailIcon label="تصویر" onClick={() => pick("image")}>
            <ImagePlus className="size-[18px]" />
          </RailIcon>
          <RailIcon label="ویدئو" onClick={() => pick("video")}>
            <Film className="size-[18px]" />
          </RailIcon>
          <RailIcon label="صدا و موسیقی" onClick={() => openSheet("audio")}>
            <Music className="size-[18px]" />
          </RailIcon>
          <RailDivider />
          <RailIcon label="متن" onClick={addText}>
            <Type className="size-[18px]" />
          </RailIcon>
          <RailIcon label="حباب گفتگو" onClick={() => addBubble("round")}>
            <MessageCircle className="size-[18px]" />
          </RailIcon>
          <RailIcon label="شکل" onClick={() => addShape("rect")}>
            <Square className="size-[18px]" />
          </RailIcon>
          <RailIcon active={tool === "draw"} label="قلم آزاد" onClick={() => setTool("draw")}>
            <Pencil className="size-[18px]" />
          </RailIcon>

          <div className="mt-auto flex flex-col items-center gap-1 pt-3">
            <RailIcon label="بزرگ‌نمایی" shortcut="Ctrl +" onClick={() => setZoom(viewZoom + 0.1)}>
              <ZoomIn className="size-[18px]" />
            </RailIcon>
            <Tooltip content="اندازهٔ واقعی" shortcut="Ctrl 0">
              <button
                type="button"
                onClick={() => setZoom(1)}
                aria-label="اندازه واقعی"
                className="tap num rounded-md px-1 py-1 text-[10px] text-muted hover:bg-elevated hover:text-fg"
              >
                {Math.round(viewZoom * 100)}%
              </button>
            </Tooltip>
            <RailIcon label="کوچک‌نمایی" shortcut="Ctrl −" onClick={() => setZoom(viewZoom - 0.1)}>
              <ZoomOut className="size-[18px]" />
            </RailIcon>
          </div>
        </aside>

        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1">
            <CanvasStage onPickFiles={(kind, panelId) => pick(kind, panelId)} />
          </div>
        </main>

        <aside className="hidden w-72 shrink-0 overflow-hidden border-s border-line lg:flex">
          <Inspector
            className="h-full w-full"
            onPickFiles={(kind, panelId, extra) => pick(kind, panelId, extra)}
            onExportPage={() => void exportPage(false)}
            onExportAll={() => void exportPage(true)}
            onRead={() => go("/read/$id", { id: project.id })}
          />
        </aside>
      </div>

      {selected && !wantEdit && (
        <div className="shrink-0 border-t border-line bg-surface/95 px-2 py-2 backdrop-blur-md lg:hidden">
          <div className="rail-x rail-fade no-scrollbar items-center">
            <span className="flex h-10 items-center rounded-full bg-elevated px-3 text-[11px] font-semibold text-muted">
              {ITEM_NAMES[selected.type] ?? "انتخاب"}
            </span>
            <ActionChip
              icon={
                selected.type === "video" ? (
                  <Film />
                ) : selected.type === "image" ? (
                  <Image />
                ) : selected.type === "panel" ? (
                  <ImagePlus />
                ) : selected.type === "bubble" || selected.type === "text" ? (
                  <Type />
                ) : (
                  <Palette />
                )
              }
              primary
              onClick={() => {
                if (!selected) return;
                if (selected.type === "bubble" || selected.type === "text")
                  requestEdit(selected.id);
                else if (selected.type === "panel") openSheet("media");
                else openSheet("style");
              }}
            >
              {selected.type === "video"
                ? "برش ویدئو"
                : selected.type === "image"
                  ? "زوم عکس"
                  : selected.type === "panel"
                    ? "رسانه"
                    : selected.type === "bubble" || selected.type === "text"
                      ? "نوشتن"
                      : "ویرایش"}
            </ActionChip>
            {selected.type === "panel" && (
              <ActionChip icon={<SquareDashed />} onClick={() => openSheet("style")}>
                شکل قاب
              </ActionChip>
            )}
            {(selected.type === "image" || selected.type === "video") && (
              <>
                <ActionChip
                  icon={<Minus />}
                  iconOnly
                  label="کوچک‌کردن"
                  onClick={() => useStudio.getState().scaleSelectedMedia(1 / 1.22)}
                />
                <ActionChip
                  icon={<Plus />}
                  iconOnly
                  label="بزرگ‌کردن"
                  onClick={() => useStudio.getState().scaleSelectedMedia(1.22)}
                />
              </>
            )}
            <ActionChip icon={<Palette />} onClick={() => openSheet("style")}>
              استایل
            </ActionChip>
            <ActionChip icon={<Copy />} onClick={duplicateSelected}>
              کپی
            </ActionChip>
            <ActionChip icon={<Trash2 />} danger onClick={deleteSelected}>
              حذف
            </ActionChip>
          </div>
        </div>
      )}

      <nav className="grid shrink-0 grid-cols-6 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        <NavBtn label="افزودن" active={sheet === "add"} onClick={() => openSheet("add")}>
          <Plus className="size-5" />
        </NavBtn>
        <NavBtn label="حباب" active={sheet === "bubble"} onClick={() => openSheet("bubble")}>
          <MessageCircle className="size-5" />
        </NavBtn>
        <NavBtn label="رسانه" active={sheet === "media"} onClick={() => openSheet("media")}>
          <Film className="size-5" />
        </NavBtn>
        <NavBtn label="صدا" active={sheet === "audio"} onClick={() => openSheet("audio")}>
          <Music className="size-5" />
        </NavBtn>
        <NavBtn
          label="قلم"
          active={tool === "draw" || sheet === "draw"}
          onClick={() => {
            setTool("draw");
            openSheet("draw");
          }}
        >
          <Pencil className="size-5" />
        </NavBtn>
        <NavBtn
          label="لایه"
          active={sheet === "layers"}
          onClick={() => openSheet("layers", "layers")}
        >
          <Layers className="size-5" />
        </NavBtn>
      </nav>

      <BottomSheet
        open={sheet === "add"}
        onOpenChange={(v) => setSheet(v ? "add" : null)}
        title="افزودن"
      >
        <div className="space-y-4 pt-1">
          <PageBackgroundPicker onPickImage={() => pick("image", undefined, "bg")} />
          <div>
            <div className="mb-1.5 text-xs font-semibold">چیدمان قاب‌های این صفحه</div>
            <p className="mb-2 text-[11px] text-muted">
              یک قالب بزن، بعد هر قاب را جدا جابه‌جا یا عوض کن.
            </p>
            <LayoutGrid />
          </div>
          <div>
            <div className="mb-1.5 text-xs font-semibold">شکل قاب تازه</div>
            <p className="mb-2 text-[11px] text-muted">
              مثلث، برش مورب، دایره و بقیه. روی صفحه هم می‌توانی بکشیش.
            </p>
            <PanelKindGrid
              onPick={(k: PanelKind) => {
                addPanel({ kind: k });
              }}
            />
            <button
              type="button"
              className="tap mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-elevated text-sm font-medium shadow-[var(--shadow-border)] hover:bg-overlay"
              onClick={() => {
                setTool("panel");
                setSheet(null);
              }}
            >
              <SquareDashed className="size-4" />
              کشیدن قاب روی صفحه
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <SheetAction
              onClick={() => {
                addPage();
                setSheet(null);
              }}
            >
              صفحه تازه
            </SheetAction>
            <SheetAction
              onClick={() => {
                addPanel();
              }}
            >
              قاب تازه در همین صفحه
            </SheetAction>
            <SheetAction
              onClick={() => {
                openSheet("pages", "pages");
              }}
            >
              صفحه‌ها
            </SheetAction>
            <SheetAction
              onClick={() => {
                addText();
              }}
            >
              متن
            </SheetAction>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {SHAPES.map((s) => (
              <SheetAction key={s.k} onClick={() => addShape(s.k)}>
                {s.n}
              </SheetAction>
            ))}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "media"}
        onOpenChange={(v) => setSheet(v ? "media" : null)}
        title="تصویر و ویدئو"
        footer={
          <Button className="w-full" onClick={() => setSheet(null)}>
            ثبت
          </Button>
        }
      >
        <div className="space-y-3 pt-1">
          <p className="text-xs text-muted">
            قاب را انتخاب کن، بعد فایل بگذار. روی عکس داخل قاب بکش تا جایش عوض شود؛ دو انگشت
            بزرگ‌نمایی است. ویدئو بعد از گذاشتن برش می‌شود.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="tap flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm font-medium shadow-[var(--shadow-border)] hover:bg-overlay [&_svg]:text-brand"
              onClick={() => {
                pick("image");
                setSheet(null);
              }}
            >
              <ImagePlus className="size-5" />
              تصویر در قاب
            </button>
            <button
              type="button"
              className="tap flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm font-medium shadow-[var(--shadow-border)] hover:bg-overlay [&_svg]:text-brand"
              onClick={() => {
                pick("video");
                setSheet(null);
              }}
            >
              <Film className="size-5" />
              ویدئو در قاب
            </button>
            <button
              type="button"
              className="tap flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm font-medium shadow-[var(--shadow-border)] hover:bg-overlay [&_svg]:text-brand"
              onClick={() => {
                pick("image", undefined, "free");
                setSheet(null);
              }}
            >
              <ImagePlus className="size-5" />
              تصویر روی صفحه
            </button>
            <button
              type="button"
              className="tap flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl bg-elevated text-sm font-medium shadow-[var(--shadow-border)] hover:bg-overlay [&_svg]:text-brand"
              onClick={() => {
                pick("video", undefined, "free");
                setSheet(null);
              }}
            >
              <Film className="size-5" />
              ویدئو روی صفحه
            </button>
          </div>
          {assets.filter((a) => a.kind === "image" || a.kind === "video").length > 0 && (
            <div>
              <div className="mb-2 text-xs font-semibold">همین دستگاه</div>
              <div className="grid grid-cols-4 gap-1.5">
                {assets
                  .filter((a) => a.kind === "image" || a.kind === "video")
                  .slice(0, 24)
                  .map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="tap relative aspect-square overflow-hidden rounded-lg bg-elevated shadow-[var(--shadow-border)]"
                      title={a.name}
                      onClick={() => {
                        useStudio.getState().placeAsset(a.id);
                        setSheet(a.kind === "video" ? "style" : null);
                      }}
                    >
                      {a.kind === "image" && thumbUrl(a.id) ? (
                        <img src={thumbUrl(a.id)} alt="" className="size-full object-cover" />
                      ) : (
                        <span className="grid size-full place-items-center text-[10px] text-muted">
                          <Film className="size-5" />
                        </span>
                      )}
                      {a.kind === "video" && (
                        <span className="absolute bottom-1 start-1 rounded bg-bg/80 px-1 text-[9px]">
                          ویدئو
                        </span>
                      )}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "audio"}
        onOpenChange={(v) => setSheet(v ? "audio" : null)}
        title="موسیقی و صدا"
        footer={
          <Button className="w-full" onClick={() => setSheet(null)}>
            ثبت
          </Button>
        }
      >
        <AudioEditor onPickFiles={(kind, panelId, extra) => pick(kind, panelId, extra)} />
      </BottomSheet>

      <BottomSheet
        open={sheet === "bubble"}
        onOpenChange={(v) => setSheet(v ? "bubble" : null)}
        title="حباب گفتگو"
        footer={
          selected && (selected.type === "bubble" || selected.type === "text") ? (
            <Button
              className="w-full"
              onClick={() => {
                setSheet(null);
                toast.success("متن ثبت شد");
              }}
            >
              ثبت متن
            </Button>
          ) : undefined
        }
      >
        {selected && (selected.type === "bubble" || selected.type === "text") ? (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted">متن را بنویس، بعد دکمه ثبت را بزن.</p>
            <textarea
              className="min-h-32 w-full resize-none rounded-lg bg-bg p-3 text-base leading-relaxed shadow-[var(--shadow-border)] focus-visible:shadow-[0_0_0_1px_var(--color-brand)]"
              value={selected.text}
              onChange={(e) =>
                useStudio
                  .getState()
                  .patchItem(selected.id, { text: e.target.value } as never, false)
              }
              placeholder="اینجا بنویس…"
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                requestEdit(selected.id);
                setSheet(null);
              }}
            >
              نوشتن روی صفحه
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {BUBBLES.map((b) => (
              <SheetAction key={b.k} onClick={() => addBubble(b.k)}>
                {b.n}
              </SheetAction>
            ))}
          </div>
        )}
      </BottomSheet>

      <BottomSheet
        open={sheet === "draw"}
        onOpenChange={(v) => {
          setSheet(v ? "draw" : null);
          if (!v) setTool("select");
        }}
        title="قلم"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setSheet(null);
              setTool("select");
            }}
          >
            ثبت
          </Button>
        }
      >
        <div className="space-y-4 pt-1">
          <div>
            <div className="mb-2 text-xs font-semibold">رنگ قلم</div>
            <div className="flex flex-wrap items-center gap-2">
              {INK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  onClick={() => setDrawColor(c)}
                  style={{ background: c }}
                  className={`tap size-9 rounded-full shadow-[var(--shadow-border)] ${
                    drawColor.toLowerCase() === c.toLowerCase()
                      ? "ring-2 ring-brand ring-offset-2 ring-offset-surface"
                      : ""
                  }`}
                />
              ))}
              <label className="tap grid size-9 place-items-center overflow-hidden rounded-full bg-elevated shadow-[var(--shadow-border)]">
                <input
                  type="color"
                  value={drawColor}
                  onChange={(e) => setDrawColor(e.target.value)}
                  className="size-12 cursor-pointer"
                  aria-label="رنگ دلخواه"
                />
              </label>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold">ضخامت</span>
              <span className="num text-muted">{drawWidth}px</span>
            </div>
            <Slider min={2} max={36} value={[drawWidth]} onValueChange={([v]) => setDrawWidth(v)} />
            {/* Live preview of the stroke you are about to draw. */}
            <div className="mt-3 grid h-12 place-items-center rounded-lg bg-bg">
              <span
                className="block w-4/5 rounded-full"
                style={{ background: drawColor, height: Math.max(2, drawWidth) }}
              />
            </div>
          </div>
          <p className="text-xs text-muted">روی صفحه بکش. برای خروج، «ثبت» را بزن.</p>
        </div>
      </BottomSheet>

      <BottomSheet
        open={sheet === "pages"}
        onOpenChange={(v) => setSheet(v ? "pages" : null)}
        title="صفحه‌ها"
      >
        <PageStrip variant="col" />
      </BottomSheet>

      <BottomSheet
        open={sheet === "layers"}
        onOpenChange={(v) => setSheet(v ? "layers" : null)}
        title="لایه‌ها"
      >
        <Inspector
          mode="layers"
          hideTabs
          className="bg-transparent shadow-none"
          onPickFiles={(kind, panelId, extra) => pick(kind, panelId, extra)}
          onExportPage={() => void exportPage(false)}
          onExportAll={() => void exportPage(true)}
          onRead={() => go("/read/$id", { id: project.id })}
        />
      </BottomSheet>

      <BottomSheet
        open={sheet === "style"}
        onOpenChange={(v) => setSheet(v ? "style" : null)}
        title="استایل"
        footer={
          <Button
            className="w-full"
            onClick={() => {
              setSheet(null);
              toast.success("ثبت شد");
            }}
          >
            ثبت
          </Button>
        }
      >
        <Inspector
          mode="style"
          hideTabs
          className="bg-transparent shadow-none"
          onPickFiles={(kind, panelId, extra) => pick(kind, panelId, extra)}
          onExportPage={() => void exportPage(false)}
          onExportAll={() => void exportPage(true)}
          onRead={() => go("/read/$id", { id: project.id })}
        />
      </BottomSheet>

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogTitle>ذخیره نشد</DialogTitle>
          <DialogDescription>
            می‌توانی دوباره تلاش کنی، پرونده را خروجی بگیری، یا بدون ذخیره خارج شوی.
          </DialogDescription>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              onClick={() => {
                void saveNow()
                  .then(() => go("/"))
                  .catch(() => undefined);
              }}
            >
              تلاش دوباره
            </Button>
            <Button variant="outline" onClick={() => void exportProjectFile()}>
              خروجی اضطراری
            </Button>
            <Button variant="ghost" onClick={() => go("/")}>
              خروج بدون ذخیره
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

const ITEM_NAMES: Record<string, string> = {
  panel: "قاب",
  image: "تصویر",
  video: "ویدئو",
  bubble: "حباب",
  text: "متن",
  shape: "شکل",
  drawing: "خط قلم",
};

function SaveState({ tone, label }: { tone: "ok" | "warn" | "danger" | "idle"; label: string }) {
  const dot =
    tone === "danger"
      ? "bg-danger"
      : tone === "ok"
        ? "bg-ok"
        : tone === "warn"
          ? "bg-warn"
          : "bg-subtle";
  return (
    <span
      className={`shrink-0 items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-[11px] ${
        tone === "danger" ? "inline-flex text-danger" : "hidden text-muted sm:inline-flex"
      }`}
    >
      <span className={`size-1.5 rounded-full ${dot} ${tone === "warn" ? "animate-pulse" : ""}`} />
      {label}
    </span>
  );
}

function NavBtn({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`tap relative flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium ${
        active ? "text-brand" : "text-muted"
      }`}
    >
      {/* Active marker rides the top edge so the icon never shifts. */}
      <span
        className={`absolute inset-x-4 top-0 h-0.5 rounded-full bg-brand transition-opacity duration-200 ${
          active ? "opacity-100" : "opacity-0"
        }`}
      />
      {children}
      {label}
    </button>
  );
}

function RailDivider() {
  return <span className="my-1 h-px w-6 bg-line" />;
}

function RailIcon({
  label,
  shortcut,
  onClick,
  active,
  children,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label} shortcut={shortcut} side="left">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onClick={onClick}
        className={`tap relative grid size-10 place-items-center rounded-lg ${
          active ? "bg-brand/15 text-brand" : "text-muted hover:bg-elevated hover:text-fg"
        }`}
      >
        {active && <span className="absolute inset-y-2 start-0 w-0.5 rounded-full bg-brand" />}
        {children}
      </button>
    </Tooltip>
  );
}

function ActionChip({
  icon,
  children,
  onClick,
  primary,
  danger,
  iconOnly,
  label,
}: {
  icon: React.ReactNode;
  children?: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
  iconOnly?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label ?? undefined}
      className={`tap flex h-10 items-center justify-center gap-1.5 rounded-full text-xs font-medium [&_svg]:size-4 ${
        iconOnly ? "w-10 shrink-0" : "px-3.5"
      } ${
        primary
          ? "bg-brand text-brand-fg"
          : danger
            ? "bg-danger/12 text-danger"
            : "bg-elevated text-fg shadow-[var(--shadow-border)]"
      }`}
    >
      {icon}
      {!iconOnly && children}
    </button>
  );
}

function SheetAction({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex h-12 items-center justify-center rounded-lg bg-elevated text-sm font-medium text-fg shadow-[var(--shadow-border)] hover:bg-overlay"
    >
      {children}
    </button>
  );
}
