# کادر — Comic Studio

Standalone Persian comic studio: create pages, place images/video, add speech bubbles, preview as a reader, and keep everything on this device.

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run typecheck`
- `npm test`

## Architecture

- `src/lib/comic/types.ts` — document model (discriminated unions)
- `src/lib/comic/easy.ts` — easy builder: frames, panel fitting, project build
- `src/lib/comic/easy-store.ts` — wizard state (session-persisted)
- `src/lib/comic/store.ts` — editor state, history, autosave
- `src/lib/comic/repository.ts` — storage adapters (`ComicRepository`, `AssetRepository`)
- `src/lib/comic/db.ts` — IndexedDB implementation
- `src/lib/comic/draw.ts` — canvas renderer (editor + PNG export)
- `src/lib/comic/package.ts` — `.kader.json` project package
- `src/components/studio/` — Home, Editor, Reader shells
- `src/components/ui/` — primitives (button, select, segmented, sheet, dialog…)
- `src/styles.css` — design tokens, materials, platform behaviour
- `src/lib/theme.ts` — dark / light / system theme, applied before first paint

## Easy builder («ساخت آسان»)

A four-step route (`/easy`) for making a comic without touching the studio, built
around the one thing that is genuinely hard on a phone: editing a picture after
it is already clipped by a panel.

1. **عکس‌ها** — two buttons, «افزودن عکس» and «افزودن ویدئو», plus the local
   library; their order is the comic's panel order.
2. **ویرایش تکی** — each picture is edited *outside* any panel, on a frame of its
   own: crop ratio, zoom and pan, colour grade (presets + brightness / contrast /
   saturation / warmth), and speech bubbles with nine skins from classic white to
   glass and smoke. A clip adds its own tab for the trim range, speed, volume and
   mute. On a phone the step is a fixed three-zone editor — frame, film strip,
   tools — so the picture never scrolls away and every control is one thumb-reach
   from the bottom.
3. **پنل و موسیقی** — collapsible cards for page setup, panels and music.
   Panels come in two modes: **پنجرهٔ خودکار**, the default, builds the page from
   the pictures themselves (1–8 per page, three gutter widths, live preview of
   the real layout maths); or a ready-made layout, one for the whole comic or per
   page. Music carries volume, playback speed, bass and treble (Web Audio shelf
   filters), fade in/out, and how far through the comic it plays.
4. **پیش‌نمایش** — the built comic, page by page, with a pencil on every page that
   opens just that page's settings. Nothing is baked: the wizard writes normal
   panels, images and bubbles, so everything stays editable in the studio.

**Automatic panels** (`mosaicRects` in `src/lib/comic/easy.ts`) are a justified
mosaic: the pictures are split into rows — every way of cutting the sequence is
tried, at most 128 for eight pictures, and the split whose natural height is
closest to the page wins — then every row fills the width and the rows are
scaled together to fill the height. The page comes out full, with only the
gutter between frames and a crop of a percent or two.

Ready-made layouts keep their cells and let each picture fill the frame it was
given — panels used to shrink to the picture's aspect, which left bands of empty
paper between rows. A last page with fewer pictures than cells switches to a
layout that holds exactly what is left, and any frame with nothing in it is
dropped and the rest grown back over the page, so a comic never ends on an empty
frame or a hole.

Wizard state (including every frame) is kept in `sessionStorage`, so stepping
back — or closing the tab by accident — does not lose the work.

## Design system

Everything visual comes from one token layer in `src/styles.css`; components
never hard-code a colour, radius, shadow or easing.

- **Palette** — an "ink & paper" set: a four-step elevation ladder
  (`bg → surface → elevated → overlay`) plus hairline borders, with a single
  vermilion accent (`--color-brand`) reserved for the one action a screen exists
  for, selection state, and the canvas selection chrome. Cool cyan
  (`--color-steel`) is kept for snap guides so guides never read as selection.
- **Themes** — dark is the default; light is a warm newsprint theme, not an
  inverted dark one. The choice (dark / light / system) lives in `localStorage`
  and is applied by an inline script before first paint, so there is no flash
  of the wrong theme. `<meta name="theme-color">` follows it.
- **Materials** — `.material` (fill + hairline + a 1px top highlight),
  `.halftone` (comic print dots), `.checker`, `.scrim-top/-bottom`, `.skeleton`
  (shimmer, not a pulse). They live in `@layer components`, so Tailwind
  utilities always win over them.
- **Motion** — two easings (`--ease-out-quint` for UI, `--ease-spring` for
  anything physical) and four durations. Cards rise on entry, sheets slide,
  the segmented thumb travels. All of it collapses under
  `prefers-reduced-motion`.
- **Type** — Vazirmatn for UI, Lalezar for display headings and the wordmark,
  IBM Plex Mono (via `.num`, tabular figures) for anything numeric.

## Platform behaviour

**Android / touch**

- Every target is ≥ 44px; `touch-action: manipulation` kills the double-tap
  zoom delay without blocking pinch, and the tap highlight is replaced by a
  press-scale state (`.tap`).
- `overscroll-behavior-y: none` stops pull-to-refresh behind the app shell;
  sheets and scroll rails contain their own overscroll.
- Safe-area insets on the bottom nav, sheets, dialogs and the floating button;
  `interactive-widget=resizes-content` keeps the layout above the keyboard.
- Form controls are 16px on small screens so focusing a field never zooms the
  viewport.
- Dialogs dock to the bottom edge on phones and centre from `sm` up; the
  editor's selection actions are a scrollable chip rail with a fade edge.
- The library's floating button only appears once the hero has scrolled away.

**Windows / desktop**

- Custom thin scrollbars in both WebKit and Firefox instead of the platform's
  chunky default.
- Hover and `:focus-visible` states on everything, tooltips (pointer devices
  only) carrying the keyboard shortcut, and a `?` shortcut sheet.
- Keyboard: `/` focuses library search, `n` starts a comic, and the editor
  shortcuts below.

## Video in the reader

A clip you have not seen before holds the page for two seconds after it is
revealed: taps in that window show a countdown instead of turning the page, so a
video is never skipped before it starts. Once a comic has been read to the end
(`src/lib/comic/seen.ts`, per device), the hold is gone and every clip can be
skipped immediately.

## Canvas behaviour

Items move freely: they may bleed off the page, overlap, or grow past it, and the
only limit is that a grabbable sliver stays on paper. Order comes from magnetic
alignment instead — while `snap` is on, an item's edges and centre pull to the
page's edges/centre *and* to every other item on the page, with the guide drawn
only while the pull is active.

## Persistence

Projects and blobs live in IndexedDB (`kader-studio`). Preferences (snap, default page size, reading direction) use `localStorage`. Autosave is debounced (~700ms). `Ctrl/Cmd+S` flushes immediately.

## Project package

Export is JSON:

```json
{
  "kind": "kader.comicstudio",
  "formatVersion": 1,
  "document": { "...ComicProject" },
  "assets": [{ "id", "mime", "data": "<base64>", "thumb": "<base64>" }]
}
```

Import remaps all IDs so an existing comic is never overwritten.

## Shortcuts

| Key | Action |
| --- | --- |
| Ctrl/Cmd+Z / Shift+Z or Y | Undo / Redo |
| Ctrl/Cmd+S | Save |
| Ctrl/Cmd+C / V / D | Copy / Paste / Duplicate |
| Delete | Delete selection |
| Ctrl/Cmd + wheel, pinch | Zoom |
| Space+drag | Pan |
| Arrows / Shift+Arrows | Nudge |
| Esc | Select tool, close sheet |
| ? | Shortcut sheet |
| / (library) | Focus search |
| n (library) | New comic |
| Reader: arrows / space | Previous / next |
| Reader: a fresh clip | Holds the page for its first 2s — until the comic has been read once |
| Reader: tap or click | Right side: next · left third: back. Dragging never navigates. |
