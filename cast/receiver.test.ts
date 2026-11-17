import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

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

interface MediaInformation {
  contentUrl: string;
  metadata: { title?: string; albumName?: string };
}

function element() {
  const classes = new Set<string>();
  const properties = new Map<string, string>();
  const events = new Map<string, (() => void)[]>();
  return {
    src: "artwork.png",
    textContent: "",
    hidden: false,
    clientWidth: 100,
    scrollWidth: 100,
    naturalWidth: 0,
    replaceChildren() {},
    classList: {
      add: (name: string) => classes.add(name),
      toggle(name: string, enabled: boolean) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
      contains: (name: string) => classes.has(name),
    },
    style: {
      display: "",
      setProperty: (name: string, value: string) => properties.set(name, value),
      getPropertyValue: (name: string) => properties.get(name),
    },
    addEventListener(type: string, listener: () => void) {
      events.set(type, [...(events.get(type) ?? []), listener]);
    },
    dispatch: (type: string) => events.get(type)?.forEach((listener) => listener()),
    removeAttribute(name: string) {
      if (name === "src") this.src = "";
    },
  };
}

function receiver() {
  let media: MediaInformation | null = null;
  const nodes = new Map(
    [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => [match[1], element()])
  );
  const listeners = new Map<string, ((event: { type: string }) => void)[]>();
  const body = element();
  const resizers: (() => void)[] = [];
  const state = { items: [] as QueueItem[], currentIndex: 0, playerState: "IDLE" };
  const queue = {
    getItems: () => state.items,
    getCurrentItem: () => state.items[state.currentIndex],
    getCurrentItemIndex: () => state.currentIndex,
  };
  const playerManager = {
    setPlaybackConfig() {},
    setSupportedMediaCommands() {},
    getMediaInformation: () => media,
    getPlayerState: () => state.playerState,
    getQueueManager: () => queue,
    addEventListener(type: string, listener: (event: { type: string }) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
  };
  const context = { getPlayerManager: () => playerManager, start() {} };
  const sandbox = {
    URL,
    fetch: async () => ({ text: async () => "Not Found" }),
    ResizeObserver: class {
      constructor(callback: () => void) {
        resizers.push(callback);
      }
      observe() {}
    },
    document: {
      body,
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
          PLAY: "play",
          PLAYING: "playing",
          PAUSE: "pause",
          BUFFERING: "buffering",
          MEDIA_FINISHED: "media_finished",
          IDLE: "idle",
        } },
        messages: {
          PlayerState: {
            IDLE: "IDLE",
            PLAYING: "PLAYING",
            PAUSED: "PAUSED",
            BUFFERING: "BUFFERING",
          },
          Command: { PLAY: 1, PAUSE: 2, SEEK: 4, STREAM_TRANSFER: 8 },
        },
      },
    },
  };
  const vmContext = createContext(sandbox);
  return {
    nodes,
    body,
    state,
    setMedia: (metadata: MediaInformation["metadata"]) => {
      media = { contentUrl: "https://receiver.test/track.mp3", metadata };
    },
    start: () => runInContext(source, vmContext),
    resize: () => resizers.forEach((callback) => callback()),
    updateArtistImage: (url: string | null) =>
      runInContext("updateArtistImage", vmContext)(url),
    emit: (type: string, data: { isBuffering?: boolean } = {}) => {
      for (const listener of listeners.get(type) ?? []) listener({ type, ...data });
    },
    mediaStatus: () => {
      for (const listener of listeners.get("MEDIA_STATUS") ?? []) {
        listener({ type: "MEDIA_STATUS" });
      }
    },
  };
}

test("album chip switches between single and album as metadata changes", () => {
  const app = receiver();
  app.start();
  const update = (title?: string, albumName?: string) => {
    app.setMedia({ title, albumName });
    app.mediaStatus();
    return app.nodes.get("albumChip")?.textContent;
  };
  expect(update("Song", "Song")).toBe("SINGLE");
  expect(update("Song", "Release")).toBe("ALBUM");
  expect(update("Next song", "Next song")).toBe("SINGLE");
  expect(update()).toBe("ALBUM");
  expect(update("", "")).toBe("ALBUM");
});

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
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("-240px");

  viewport.clientWidth = 250;
  app.resize();
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("-90px");

  artist.scrollWidth = 80;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(false);
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("0px");
});

test("title marquee adapts to text and viewport changes independently of the artist", () => {
  const app = receiver();
  app.start();
  const viewport = app.nodes.get("titleMarquee")!;
  const title = app.nodes.get("title")!;

  title.scrollWidth = 500;
  viewport.clientWidth = 180;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(true);
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("-320px");
  expect(app.nodes.get("artistMarquee")?.classList.contains("is-overflowing")).toBe(false);

  viewport.clientWidth = 0;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(false);

  viewport.clientWidth = 400;
  app.resize();
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("-100px");

  title.scrollWidth = 80;
  app.resize();
  expect(viewport.classList.contains("is-overflowing")).toBe(false);
  expect(viewport.style.getPropertyValue("--marquee-offset")).toBe("0px");
});

test("artist photo replaces the icon only after loading and falls back after failure", () => {
  const app = receiver();
  app.start();
  const image = app.nodes.get("artistImage")!;
  const icon = app.nodes.get("artistIcon")!;
  app.updateArtistImage("https://music.test/Artist/track.flac?token=123");
  expect(image.src).toBe("https://music.test/Artist/artist.jpg");
  expect(image.hidden).toBe(true);
  expect(icon.style.display).toBe("");
  image.naturalWidth = 100;
  image.dispatch("load");
  expect(image.hidden).toBe(false);
  expect(icon.style.display).toBe("none");

  app.updateArtistImage("https://music.test/Artist/another.mp3");
  expect(image.hidden).toBe(false);
  expect(icon.style.display).toBe("none");
  app.updateArtistImage("https://music.test/Other/track.m4a");
  expect(image.hidden).toBe(true);
  expect(icon.style.display).toBe("");
  image.naturalWidth = 0;
  image.dispatch("error");
  expect(image.hidden).toBe(true);
  expect(icon.style.display).toBe("");
  app.updateArtistImage(null);
  expect(image.src).toBe("");
  expect(icon.style.display).toBe("");
});

test("disc stays retracted after pause until playback actually resumes", () => {
  const app = receiver();
  app.start();
  app.emit("pause");
  expect(app.body.classList.contains("playback-paused")).toBe(true);
  expect(app.nodes.get("playbackState")?.textContent).toBe("PAUSED");
  app.emit("buffering");
  expect(app.body.classList.contains("playback-paused")).toBe(true);
  app.emit("play");
  expect(app.body.classList.contains("playback-paused")).toBe(true);
  app.emit("playing");
  expect(app.body.classList.contains("playback-paused")).toBe(false);
  expect(app.nodes.get("playbackState")?.textContent).toBe("NOW PLAYING");
  app.emit("media_finished");
  expect(app.body.classList.contains("playback-paused")).toBe(true);
});

test("idle container follows initial state, media status, and playback completion", () => {
  const app = receiver();
  const container = app.nodes.get("idleContainer")!;
  const screen = app.nodes.get("playerScreen")!;
  app.start();
  expect(container.hidden).toBe(false);
  expect(screen.hidden).toBe(true);

  for (const playerState of ["PLAYING", "PAUSED", "BUFFERING"]) {
    app.state.playerState = playerState;
    app.mediaStatus();
    expect(container.hidden).toBe(true);
    expect(screen.hidden).toBe(false);
  }

  app.emit("media_finished");
  expect(container.hidden).toBe(false);
  expect(screen.hidden).toBe(true);

  app.state.playerState = "PLAYING";
  app.emit("playing");
  expect(container.hidden).toBe(true);
  expect(screen.hidden).toBe(false);

  app.state.playerState = "IDLE";
  app.mediaStatus();
  expect(container.hidden).toBe(false);
  expect(screen.hidden).toBe(true);

  app.state.playerState = "PAUSED";
  app.emit("pause");
  expect(container.hidden).toBe(true);
  expect(screen.hidden).toBe(false);
});

test("idle container is hidden when receiver starts with active media", () => {
  const app = receiver();
  app.state.playerState = "PLAYING";
  app.start();
  expect(app.nodes.get("idleContainer")?.hidden).toBe(true);
  expect(app.nodes.get("playerScreen")?.hidden).toBe(false);
});

test("cast waves animate during playing and buffering but stop on pause, finish, and error", () => {
  const app = receiver();
  const icon = app.nodes.get("castIcon")!;
  app.start();
  expect(icon.classList.contains("is-animating")).toBe(false);

  app.state.playerState = "PLAYING";
  app.emit("playing");
  expect(icon.classList.contains("is-animating")).toBe(true);
  app.emit("pause");
  expect(icon.classList.contains("is-animating")).toBe(false);

  app.state.playerState = "PAUSED";
  app.emit("buffering", { isBuffering: true });
  expect(icon.classList.contains("is-animating")).toBe(true);
  app.emit("buffering", { isBuffering: false });
  expect(icon.classList.contains("is-animating")).toBe(false);
  app.emit("play");
  expect(icon.classList.contains("is-animating")).toBe(false);

  app.emit("playing");
  app.emit("media_finished");
  expect(icon.classList.contains("is-animating")).toBe(false);
  app.emit("playing");
  app.emit("ERROR");
  expect(icon.classList.contains("is-animating")).toBe(false);
});

test("cast waves reflect current playback state at startup and on media status", () => {
  const app = receiver();
  const icon = app.nodes.get("castIcon")!;
  app.state.playerState = "PLAYING";
  app.start();
  expect(icon.classList.contains("is-animating")).toBe(true);

  for (const playerState of ["PAUSED", "BUFFERING", "IDLE", "PLAYING"]) {
    app.state.playerState = playerState;
    app.mediaStatus();
    expect(icon.classList.contains("is-animating")).toBe(
      playerState === "PLAYING" || playerState === "BUFFERING",
    );
  }
});
