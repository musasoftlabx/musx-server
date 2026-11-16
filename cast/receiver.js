const context = cast.framework.CastReceiverContext.getInstance();
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const playerManager = context.getPlayerManager();
const playbackConfig = new cast.framework.PlaybackConfig();
const artwork = document.getElementById("artwork");
const albumCover = document.getElementById("albumCover");
const artistImage = document.getElementById("artistImage");
const artistIcon = document.getElementById("artistIcon");
const title = document.getElementById("title");
const artist = document.getElementById("artist");
const album = document.getElementById("album");
const progress = document.getElementById("progress");
const elapsed = document.getElementById("elapsed");
const total = document.getElementById("total");
const playbackState = document.getElementById("playbackState");
const ambientArt = document.getElementById("ambientArt");
const lyricsEl = document.getElementById("lyrics");
const lyricsMode = document.getElementById("lyricsMode");
const logs = document.getElementById("logs");
const nextTrack = document.getElementById("nextTrack");
const nextArtwork = document.getElementById("nextArtwork");
const nextTitle = document.getElementById("nextTitle");
const nextArtist = document.getElementById("nextArtist");
const nextAlbum = document.getElementById("nextAlbum");
const artistMarquee = document.getElementById("artistMarquee");
const artistResizeObserver = new ResizeObserver(() => {
  const overflow = Math.max(0, artist.scrollWidth - artistMarquee.clientWidth);
  artistMarquee.classList.toggle(
    "is-overflowing",
    artistMarquee.clientWidth > 0 && overflow > 0,
  );
  artistMarquee.style.setProperty("--artist-marquee-offset", `${-overflow}px`);
  artistMarquee.style.setProperty(
    "--artist-marquee-duration",
    `${Math.max(4, overflow / 30 + 2)}s`,
  );
});

const API_BASE = "https://musasoftlabs.com";
const DEFAULT_ARTWORK = "artwork.png";
let nextArtworkUrl = null;
let artistImageUrl = null;
let currentMediaKey = null;
let lyricLines = [];
let lyricsSynced = false;
let lyricsOffset = 0;
let activeLyricIndex = -1;

playerManager.setPlaybackConfig(playbackConfig);
artistResizeObserver.observe(artistMarquee);
artistResizeObserver.observe(artist);

function updateArtistImage(contentUrl) {
  const imageUrl = contentUrl
    ? new URL("artist.jpg", new URL(contentUrl, document.baseURI)).href
    : null;
  if (imageUrl === artistImageUrl) return;
  artistImageUrl = imageUrl;
  artistImage.hidden = true;
  artistIcon.style.display = "";
  if (imageUrl) artistImage.src = imageUrl;
  else artistImage.removeAttribute("src");
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(
    2,
    "0",
  )}`;
}

function setText(element, value, fallback) {
  element.textContent = value || fallback;
}

function updatePlaybackState(state) {
  const states = cast.framework.messages.PlayerState;
  document.body.classList.toggle("playback-paused", state === states.PAUSED);

  logs.textContent = JSON.stringify(state);

  switch (state.type) {
    case states.PLAY:
      playbackState.textContent = "NOW PLAYING";
      break;
    case states.PAUSE:
      if (state.ended) playbackState.textContent = "QUEUE FINISHED";
      else playbackState.textContent = "PAUSED";
      break;
    case states.BUFFERING:
      state.isBuffering
        ? (playbackState.textContent = "BUFFERING")
        : (playbackState.textContent = "NOW PLAYING");
      break;
    case states.FINISHED:
      if (state.endedReason === cast.framework.messages.EndedReason.ENDED)
        playbackState.textContent = "QUEUE FINISHED";
      else playbackState.textContent = "ISSUE";
      break;
    case states.IDLE:
      playbackState.textContent = "READY TO PLAY";
      break;
  }
}

function parseLyrics(raw) {
  const lines = [];
  let offset = 0;
  const timeTag = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  String(raw)
    .replace(/\r/g, "")
    .split("\n")
    .forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      const offsetMatch = /^\[offset:\s*([+-]?\d+)\s*\]$/i.exec(line);
      if (offsetMatch) {
        offset = Number(offsetMatch[1]) / 1000;
        return;
      }

      // Skip ID tags such as [ar:], [ti:], [al:], [by:]
      if (/^\[[a-z]+:.*\]$/i.test(line)) return;

      const stamps = [...line.matchAll(timeTag)];
      const text = line.replace(timeTag, "").trim();

      stamps.forEach((m) => {
        const fraction = m[3] ? Number(`0.${m[3]}`) : 0;
        lines.push({ time: Number(m[1]) * 60 + Number(m[2]) + fraction, text });
      });

      if (!stamps.length) lines.push({ time: null, text: line });
    });

  const synced = lines.filter((l) => l.time !== null);

  if (synced.length) {
    synced.sort((a, b) => a.time - b.time);
    return { lines: synced, synced: true, offset };
  }

  return { lines, synced: false, offset: 0 };
}

function renderLyrics(raw) {
  const parsed = raw
    ? parseLyrics(raw)
    : { lines: [], synced: false, offset: 0 };

  lyricLines = parsed.lines;
  lyricsSynced = parsed.synced;
  lyricsOffset = parsed.offset;
  activeLyricIndex = -1;

  lyricsEl.replaceChildren();
  lyricsEl.style.transform = "translateY(0)";

  if (!lyricLines.length) {
    document.body.classList.add("no-lyrics");
    lyricsMode.textContent = "";
    return;
  }

  const fragment = document.createDocumentFragment();
  lyricLines.forEach((line) => {
    const p = document.createElement("p");
    p.className = "lyric-line";
    if (!line.text) p.classList.add("lyric-gap");
    p.textContent = line.text || "\u266A";
    fragment.appendChild(p);
  });
  lyricsEl.appendChild(fragment);

  lyricsMode.textContent = lyricsSynced ? "SYNCED" : "";
  document.body.classList.toggle("lyrics-static", !lyricsSynced);
  document.body.classList.remove("no-lyrics");

  if (lyricsSynced) syncLyrics(playerManager.getCurrentTimeSec());
}

function syncLyrics(currentTime) {
  if (!lyricsSynced || !lyricLines.length) return;

  const time = currentTime + lyricsOffset;
  let index = -1;
  for (let i = 0; i < lyricLines.length; i++) {
    if (lyricLines[i].time <= time) index = i;
    else break;
  }

  if (index === activeLyricIndex) return;

  const nodes = lyricsEl.children;
  nodes[activeLyricIndex]?.classList.remove("active");
  activeLyricIndex = index;

  for (let i = 0; i < nodes.length; i++) {
    nodes[i].classList.toggle("past", i < index);
  }

  const target = nodes[Math.max(index, 0)];
  if (index >= 0) target.classList.add("active");

  // Keep the active line vertically centred in the viewport
  const viewport = lyricsEl.parentElement;
  const offsetY =
    target.offsetTop - viewport.clientHeight / 2 + target.offsetHeight / 2;
  lyricsEl.style.transform = `translateY(${-Math.max(0, offsetY)}px)`;
}

artwork.addEventListener("error", () => {
  if (artwork.src !== location.origin + DEFAULT_ARTWORK) {
    artwork.src = DEFAULT_ARTWORK;
  }
});

albumCover.addEventListener("error", () => {
  if (albumCover.src !== new URL(DEFAULT_ARTWORK, document.baseURI).href) {
    albumCover.src = DEFAULT_ARTWORK;
  }
});

artistImage.addEventListener("load", () => {
  if (artistImageUrl && artistImage.naturalWidth > 0) {
    artistImage.hidden = false;
    artistIcon.style.display = "none";
  }
});

artistImage.addEventListener("error", () => {
  artistImage.hidden = true;
  artistIcon.style.display = "";
});

nextArtwork.addEventListener("error", () => {
  if (nextArtwork.src !== new URL(DEFAULT_ARTWORK, document.baseURI).href) {
    nextArtworkUrl = null;
    nextArtwork.src = DEFAULT_ARTWORK;
  }
});

ambientArt.addEventListener(
  "error",
  () => {
    ambientArt.src = DEFAULT_ARTWORK;
  },
  { once: true },
);

// Metadata updates
playerManager.addEventListener(
  cast.framework.events.EventType.MEDIA_STATUS,
  () => {
    const media = playerManager.getMediaInformation();

    if (!media) return;

    const metadata = media.metadata || {};
    const imageUrl = metadata.images?.[0]?.url;

    setText(title, metadata.title, "Unknown Track");
    setText(artist, metadata.artist, "Unknown Artist");
    setText(album, metadata.albumName, "");

    artwork.src = imageUrl || DEFAULT_ARTWORK;
    albumCover.src = artwork.src;
    ambientArt.src = artwork.src;
    updateArtistImage(media.contentUrl);

    // MEDIA_STATUS fires often; only reload lyrics when the track changes
    const key = media.contentId || media.contentUrl || metadata.title;
    if (key !== currentMediaKey) {
      currentMediaKey = key;
      renderLyrics(null);
      fetch(media?.contentUrl.replace(".mp3", ".lrc"))
        .then((res) => res.text())
        .then((text) => {
          if (text.includes("404") || text.includes("Not Found")) {
            if (key === currentMediaKey) renderLyrics(null);
            return;
          }
          key === currentMediaKey && renderLyrics(text);
        });
    }
  },
);

playerManager.addEventListener(
  cast.framework.events.EventType.MEDIA_STATUS,
  () => {
    const queue = playerManager.getQueueManager();
    const items = queue?.getItems() ?? [];
    const currentItem = queue?.getCurrentItem();
    const currentIndex =
      currentItem?.itemId != null
        ? items.findIndex((item) => item.itemId === currentItem.itemId)
        : (queue?.getCurrentItemIndex() ?? -1);
    const next = currentIndex >= 0 ? items[currentIndex + 1] : null;
    nextTrack.hidden = !next;
    if (!next) return;
    const media = next.media || {};
    const metadata = media.metadata || {};

    setText(nextTitle, metadata?.title, "Unknown Track");
    setText(nextArtist, metadata?.artist, "Unknown Artist");
    if (nextAlbum) setText(nextAlbum, metadata?.albumName, "");
    const imageUrl =
      metadata.images?.find((image) => image?.url)?.url ||
      metadata.posterUrl ||
      media.customData?.artwork ||
      media.customData?.image ||
      DEFAULT_ARTWORK;
    if (nextArtworkUrl !== imageUrl) {
      nextArtworkUrl = imageUrl;
      nextArtwork.src = imageUrl;
    }
  },
);

// Playback updates
playerManager.addEventListener(cast.framework.events.EventType.PLAY, (state) =>
  updatePlaybackState(state),
);
playerManager.addEventListener(cast.framework.events.EventType.PAUSE, (state) =>
  updatePlaybackState(state),
);
playerManager.addEventListener(
  cast.framework.events.EventType.BUFFERING,
  (state) => updatePlaybackState(state),
);
playerManager.addEventListener(
  cast.framework.events.EventType.MEDIA_FINISHED,
  (state) => updatePlaybackState(state),
);

// Progress updates
playerManager.addEventListener(
  cast.framework.events.EventType.TIME_UPDATE,
  () => {
    const current = playerManager.getCurrentTimeSec();
    const duration = playerManager.getDurationSec();

    if (!Number.isFinite(duration) || duration <= 0) {
      progress.style.width = "0%";
      elapsed.textContent = formatTime(current);
      total.textContent = "LIVE";
      return;
    }

    const percentage = Math.min(100, Math.max(0, (current / duration) * 100));

    progress.style.width = `${percentage}%`;

    syncLyrics(current);

    elapsed.textContent = formatTime(current);
    total.textContent = formatTime(duration);
  },
);

// Handle receiver errors
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR,
  (event) => (playbackState.textContent = "PLAYBACK ERROR"),
);

// Configure supported controls
playerManager.setSupportedMediaCommands(
  cast.framework.messages.Command.PLAY |
    cast.framework.messages.Command.PAUSE |
    cast.framework.messages.Command.SEEK |
    cast.framework.messages.Command.STREAM_TRANSFER,
);

// Start receiver
context.start();
