import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PACKAGE_FORMAT } from "./types.ts";
import { validatePackage } from "./package-format.ts";
import {
  advanceReveal,
  cameraFor,
  containFit,
  coverFit,
  musicSpan,
  nextPageIndex,
  pageBeats,
  prevPageIndex,
  readerZone,
  retreatReveal,
  revealCamera,
  swipeDirection,
  throughPageValue,
} from "./reader.ts";
import type { ComicPage, PanelItem } from "./types.ts";
import { pointInPanel } from "./panel-shape.ts";

describe("package", () => {
  it("rejects unknown kind", () => {
    assert.throws(() => validatePackage({ kind: "nope", document: {}, assets: [] }));
  });

  it("rejects newer format versions", () => {
    assert.throws(() =>
      validatePackage({
        kind: PACKAGE_FORMAT,
        formatVersion: 99,
        document: { pages: [] },
        assets: [],
      }),
    );
  });

  it("accepts formatVersion 1", () => {
    const pack = validatePackage({
      kind: PACKAGE_FORMAT,
      formatVersion: 1,
      document: { pages: [] },
      assets: [],
    });
    assert.equal(pack.formatVersion, 1);
  });
});

describe("reader navigation", () => {
  it("uses thirds on mobile and left-click previous on desktop", () => {
    assert.equal(readerZone(10, 300, true), "prev");
    assert.equal(readerZone(290, 300, true), "next");
    assert.equal(readerZone(150, 300, true), "hud");
    assert.equal(readerZone(10, 300, false), "prev");
  });

  it("ends after the last page and never goes before the first", () => {
    assert.deepEqual(nextPageIndex(0, 2), { index: 1, ended: false });
    assert.deepEqual(nextPageIndex(1, 2), { index: 1, ended: true });
    assert.equal(prevPageIndex(0), 0);
    assert.equal(prevPageIndex(3), 2);
  });

  it("maps horizontal swipe to next/prev", () => {
    assert.equal(swipeDirection(-80, 4), "next");
    assert.equal(swipeDirection(80, 4), "prev");
    assert.equal(swipeDirection(10, 4), null);
    assert.equal(swipeDirection(-80, 200), null);
  });
});

function panel(id: string, x: number, y: number, extra: Partial<PanelItem> = {}): PanelItem {
  return {
    id,
    type: "panel",
    x,
    y,
    w: 40,
    h: 40,
    fill: "#fff",
    stroke: 2,
    strokeColor: "#000",
    radius: 0,
    story: { order: extra.story?.order ?? 1, reveal: "click", delayMs: 0, audio: null },
    ...extra,
  };
}

function pageOf(items: ComicPage["items"]): ComicPage {
  return {
    id: "p",
    name: "p",
    w: 100,
    h: 100,
    items,
    background: { color: "#fff", assetId: "", zoom: 1, x: 0, y: 0, locked: false },
    playback: { directorLock: false, defaultDelayMs: 1000, defaultReveal: "click", ambientAudio: null },
  };
}

describe("panel reveal", () => {
  it("reads right panel first when order ties, and groups children", () => {
    const pg = pageOf([
      panel("left", 0, 0),
      panel("right", 50, 0),
      {
        id: "img",
        type: "image",
        panelId: "right",
        x: 50,
        y: 0,
        w: 40,
        h: 40,
        assetId: "a",
        zoom: 1,
        cropX: 0,
        cropY: 0,
        fitMode: "fill",
        radius: 0,
        stroke: 0,
        strokeColor: "#000",
        aspectLock: true,
        sourceRatio: 1,
      },
    ]);
    const beats = pageBeats(pg);
    assert.equal(beats[0].id, "right");
    assert.ok(beats[0].itemIds.includes("img"));
    assert.equal(beats[1].id, "left");
  });

  it("advances panel then page then ends", () => {
    assert.deepEqual(advanceReveal(1, 3, 0, 2), { revealed: 2, pageIndex: 0, ended: false });
    assert.deepEqual(advanceReveal(3, 3, 0, 2), { revealed: 1, pageIndex: 1, ended: false });
    assert.deepEqual(advanceReveal(2, 2, 1, 2), { revealed: 2, pageIndex: 1, ended: true });
  });

  it("retreats to previous page at full reveal", () => {
    assert.deepEqual(retreatReveal(3, 1, 4), { revealed: 2, pageIndex: 1 });
    assert.deepEqual(retreatReveal(1, 1, 4), { revealed: 4, pageIndex: 0 });
    assert.deepEqual(retreatReveal(1, 0, 4), { revealed: 1, pageIndex: 0 });
  });

  it("frames the camera around revealed panels only", () => {
    const pg = pageOf([panel("a", 0, 0), panel("b", 0, 50, { story: { order: 2, reveal: "click", delayMs: 0, audio: null } })]);
    const beats = pageBeats(pg);
    const cam1 = cameraFor(beats, 1, pg, 0);
    assert.ok(cam1.h < 70);
    const cam2 = cameraFor(beats, 2, pg, 0);
    assert.ok(cam2.h > cam1.h);
  });

  it("cover-fits the first panel and overscans it", () => {
    const pg = pageOf([
      panel("a", 10, 10, { w: 80, h: 40 } as Partial<PanelItem>),
      panel("b", 10, 55, { w: 80, h: 40, story: { order: 2, reveal: "click", delayMs: 0, audio: null } }),
    ]);
    const beats = pageBeats(pg);
    const first = revealCamera(beats, 1, pg);
    assert.ok(first.h < 70, "first camera stays on the first panel");
    const all = revealCamera(beats, 2, pg);
    assert.ok(all.h > first.h, "camera grows when the next panel is revealed");
    const fit = containFit(first, 390, 844);
    assert.equal(fit.scale, Math.min(390 / first.w, 844 / first.h));
    const cover = coverFit(all, 390, 844);
    assert.equal(cover.scale, Math.max(390 / all.w, 844 / all.h));
  });
});

describe("music span", () => {
  it("maps a dragged end page to throughPage", () => {
    assert.equal(throughPageValue(0, 0, 4), 0);
    assert.equal(throughPageValue(0, 2, 4), 3);
    assert.equal(throughPageValue(0, 3, 4), -1);
  });

  it("reads the first ambient clip across pages", () => {
    const clip = {
      assetId: "m",
      start: 0,
      end: 0,
      volume: 1,
      fadeInMs: 0,
      fadeOutMs: 0,
      throughPage: 3,
    };
    const p1 = pageOf([]);
    p1.playback.ambientAudio = clip;
    const p2 = pageOf([]);
    const p3 = pageOf([]);
    const project = {
      id: "c",
      title: "t",
      description: "",
      readingDirection: "rtl" as const,
      sourceLanguage: "fa",
      translations: {},
      pages: [p1, p2, p3],
      createdAt: 0,
      updatedAt: 0,
      documentVersion: 1,
    };
    const span = musicSpan(project);
    assert.equal(span?.start, 0);
    assert.equal(span?.end, 2);
  });
});

describe("panel shapes", () => {
  it("hits the left triangle of a slash split and misses the right", () => {
    const left = panel("L", 0, 0, { w: 100, h: 100, kind: "slash-l" });
    const right = panel("R", 0, 0, { w: 100, h: 100, kind: "slash-r" });
    assert.equal(pointInPanel(left, 10, 10), true);
    assert.equal(pointInPanel(right, 10, 10), false);
    assert.equal(pointInPanel(right, 90, 90), true);
    assert.equal(pointInPanel(left, 90, 90), false);
  });
});

