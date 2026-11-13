const context = cast.framework.CastReceiverContext.getInstance();
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const playerManager = context.getPlayerManager();
const playbackConfig = new cast.framework.PlaybackConfig();

playbackConfig.licenseRequestHandler = (requestInfo) => {
  requestInfo.withCredentials = true;
  requestInfo.headers = requestInfo.headers || {};
  requestInfo.headers["Content-Type"] = "application/json";
};
playerManager.setPlaybackConfig(playbackConfig);

const artwork = document.getElementById("artwork");
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

const DEFAULT_ARTWORK = "artwork.png";

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

const API_BASE = "https://musasoftlabs.com";

let currentMediaKey = null;
let lyricLines = [];
let lyricsSynced = false;
let lyricsOffset = 0;
let activeLyricIndex = -1;

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

function loadLyrics() {
  fetch(`https://musasoftlabs.com/Music/Tanzania/Zuchu/Chapati.lrc`)
    .then((res) => res.text())
    .then((text) => {
      logs.textContent = text || "No lyrics found for this track";
      raw = text || null;
      if (key === currentMediaKey) renderLyrics(raw);
    })
    .catch((error) => {
      console.error("Lyrics fetch error:", error);
      logs.textContent = "Error fetching lyrics";
    });
}

//logs.textContent = raw || "No lyrics found for this track";

// Ignore results for a track that is no longer playing

// } catch (error) {
//   console.error("Lyrics error:", error);
//   if (key === currentMediaKey) renderLyrics(null);
// }

function updateMetadata() {
  const media = playerManager.getMediaInformation();

  if (!media) return;

  const metadata = media.metadata || {};

  setText(title, metadata.title, "Unknown Track");
  setText(artist, metadata.artist, "Unknown Artist");
  setText(album, metadata.albumName, "");

  const imageUrl = metadata.images?.[0]?.url;

  artwork.src = imageUrl || DEFAULT_ARTWORK;
  ambientArt.src = artwork.src;

  // MEDIA_STATUS fires often; only reload lyrics when the track changes
  const key = media.contentId || media.contentUrl || metadata.title;
  if (key !== currentMediaKey) {
    currentMediaKey = key;
    renderLyrics(null);
    loadLyrics(media);
  }
}

artwork.addEventListener("error", () => {
  if (artwork.src !== location.origin + DEFAULT_ARTWORK) {
    artwork.src = DEFAULT_ARTWORK;
  }
});

ambientArt.addEventListener(
  "error",
  () => {
    ambientArt.src = DEFAULT_ARTWORK;
  },
  { once: true },
);

function updateProgress() {
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
}

function updatePlaybackState() {
  if (cast.framework.messages.PlayerState.PLAYING)
    playbackState.textContent = "NOW PLAYING";
  else if (cast.framework.messages.PlayerState.PAUSED)
    playbackState.textContent = "PAUSED";
  else if (cast.framework.messages.PlayerState.BUFFERING)
    playbackState.textContent = "BUFFERING";
  else playbackState.textContent = "READY TO PLAY";
}

// Metadata updates
playerManager.addEventListener(
  cast.framework.events.EventType.MEDIA_STATUS,
  updateMetadata,
);

// Playback updates
// playerManager.addEventListener(
//   cast.framework.events.EventType.PLAYER_STATE_CHANGED,
//   updatePlaybackState,
// );

// Progress updates
playerManager.addEventListener(
  cast.framework.events.EventType.TIME_UPDATE,
  updateProgress,
);

// // Handle receiver errors
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR,
  (event) => {
    playbackState.textContent = "PLAYBACK ERROR";

    fetch("https://musasoftlabs.com:3000/castError", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "Cast Receiver Error",
      }),
      // body: JSON.stringify({
      //   error: event.error,
      //   mediaInformation: playerManager.getMediaInformation(),
      //   currentTimeSec: playerManager.getCurrentTimeSec(),
      //   durationSec: playerManager.getDurationSec(),
      // }),
    })
      .then((response) => response.json())
      .then((data) => console.log("Success:", data))
      .catch((error) => console.error("Error:", error));
  },
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
