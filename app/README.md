# کادر — Comic Studio

Standalone Persian comic studio: create pages, place images/video, add speech bubbles, preview as a reader, and keep everything on this device.

## Scripts

- `npm run dev` — development
- `npm run build` — production build
- `npm run typecheck`
- `npm test`

## Architecture

- `src/lib/comic/types.ts` — document model (discriminated unions)
- `src/lib/comic/store.ts` — editor state, history, autosave
- `src/lib/comic/repository.ts` — storage adapters (`ComicRepository`, `AssetRepository`)
- `src/lib/comic/db.ts` — IndexedDB implementation
- `src/lib/comic/draw.ts` — canvas renderer (editor + PNG export)
- `src/lib/comic/package.ts` — `.kader.json` project package
- `src/components/studio/` — Home, Editor, Reader shells

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
| Reader: Left click | Previous (desktop) |
| Reader: Right click | Next (desktop) |
| Reader: Left / right third | Previous / next (mobile) |
