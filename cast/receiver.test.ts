import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./receiver.js", import.meta.url), "utf8");
const markup = readFileSync(new URL("./index.html", import.meta.url), "utf8")
  .replace(/<!--[\s\S]*?-->/g, "");

interface QueueItem {
  itemId: number;
  media: {
    metadata: {
      title: string;
      artist: string;
      albumName: string;
      images: { url: string }[];
    };
  };
}

function element() {
  const classes = new Set<string>();
  const properties = new Map<string, string>();
  return {
    src: "artwork.png",
    textContent: "",
    hidden: false,
    clientWidth: 100,
    scrollWidth: 100,
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      getPropertyValue: (name: string) => properties.get(name),
    },
    addEventListener() {},
  };
}

function receiver() {
  const nodes = new Map(
    [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], element()])
  );
  const listeners = new Map<string, (() => void)[]>();
  const resizers: (() => void)[] = [];
  const state = { items: [] as QueueItem[], currentIndex: 0 };
  const queue = {
    getItems: () => state.items,
    getCurrentItem: () => state.items[state.currentIndex],
    getCurrentItemIndex: () => state.currentIndex,
  };
  const playerManager = {
    setPlaybackConfig() {},
    setSupportedMediaCommands() {},
    getMediaInformation: () => null,
    getQueueManager: () => queue,
    addEventListener(type: string, listener: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const context = { getPlayerManager: () => playerManager, start() {} };
  const sandbox = {
    ResizeObserver: class {
      constructor(callback: () => void) {
        resizers.push(callback);
      }
      observe() {}
    },
    document: {
      getElementById: (id: string) => nodes.get(id) ?? null,
      baseURI: "https://receiver.test/cast/index.html",
    },
    cast: {
      debug: { CastDebugLogger: { getInstance: () => ({}) } },
      framework: {
        CastReceiverContext: { getInstance: () => context },
        PlaybackConfig: function () {},
        events: { EventType: {
          MEDIA_STATUS: "MEDIA_STATUS",
          TIME_UPDATE: "TIME_UPDATE",
          ERROR: "ERROR",
        } },
        messages: { Command: { PLAY: 1, PAUSE: 2, SEEK: 4, STREAM_TRANSFER: 8 } },
      },
    },
  };
  return {
    nodes,
    state,
    start: () => runInNewContext(source, sandbox),
    resize: () => resizers.forEach((callback) => callback()),
    mediaStatus: () => {
      for (const listener of listeners.get("MEDIA_STATUS") ?? []) listener();
    },
  };
}

function track(itemId: number, url: string): QueueItem {
  return {
    itemId,
    media: { metadata: {
      title: `Track ${itemId}`,
      artist: `Artist ${itemId}`,
      albumName: `Album ${itemId}`,
      images: [{ url }],
    } },
  };
}

test("artwork updates on media status with the actual page's optional album field absent", () => {
  const app = receiver();
  app.nodes.delete("nextAlbum");
  app.state.items = [track(1, "one.jpg"), track(2, "two.jpg"), track(3, "three.jpg")];
  app.start();
  app.mediaStatus();
  expect(app.nodes.get("nextArtwork")?.src).toBe("two.jpg");
  expect(app.nodes.get("nextTitle")?.textContent).toBe("Track 2");
  expect(app.nodes.get("nextArtist")?.textContent).toBe("Artist 2");
  expect(app.nodes.get("nextTrack")?.hidden).toBe(false);

  app.state.currentIndex = 1;
  app.mediaStatus();
  expect(app.nodes.get("nextArtwork")?.src).toBe("three.jpg");
  expect(app.nodes.get("nextTitle")?.textContent).toBe("Track 3");

  app.state.items[2].media.metadata.images = [{ url: "updated-three.jpg" }];
  app.mediaStatus();
  expect(app.nodes.get("nextArtwork")?.src).toBe("updated-three.jpg");

  app.state.currentIndex = 2;
  app.mediaStatus();
  expect(app.nodes.get("nextTrack")?.hidden).toBe(true);
});

test("next album text still updates when its optional element is present", () => {
  const app = receiver();
  app.nodes.set("nextAlbum", element());
  app.state.items = [track(1, "one.jpg"), track(2, "two.jpg")];
  app.start();
  app.mediaStatus();
  expect(app.nodes.get("nextAlbum")?.textContent).toBe("Album 2");
  expect(app.nodes.get("nextArtwork")?.src).toBe("two.jpg");
});

test("artist marquee activates only on overflow and adapts to text and viewport changes", () => {
  const app = receiver();
  app.start();
  const viewport = app.nodes.get("artistMarquee")!;
  const artist = app.nodes.get("artist")!;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(false);

  artist.scrollWidth = 340;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(true);
  expect(viewport.style.getPropertyValue("--artist-marquee-offset")).toBe("-240px");

  viewport.clientWidth = 250;
  app.resize();
  expect(viewport.style.getPropertyValue("--artist-marquee-offset")).toBe("-90px");

  artist.scrollWidth = 80;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(false);
  expect(viewport.style.getPropertyValue("--artist-marquee-offset")).toBe("0px");
});
