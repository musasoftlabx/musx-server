const context = cast.framework.CastReceiverContext.getInstance();
const castDebugLogger = cast.debug.CastDebugLogger.getInstance();
const playerManager = context.getPlayerManager();

castDebugLogger.setEnabled(true);
castDebugLogger.showDebugLogs(true);

castDebugLogger.warn(
  "Musix logger",
  "Playable URL:",
  playerManager.getMediaInformation()?.title
);

const artwork = document.getElementById("artwork");
const title = document.getElementById("title");
const artist = document.getElementById("artist");
const album = document.getElementById("album");

const progress = document.getElementById("progress");
const elapsed = document.getElementById("elapsed");
const total = document.getElementById("total");
const playbackState = document.getElementById("playbackState");

const DEFAULT_ARTWORK = "artwork.png";

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(
    2,
    "0"
  )}`;
}

function setText(element, value, fallback) {
  element.textContent = value || fallback;
}

function updateMetadata() {
  const media = playerManager.getMediaInformation();

  if (!media) return;

  const metadata = media.metadata || {};

  setText(title, metadata.title, "Unknown Track");
  setText(artist, metadata.artist, "Unknown Artist");
  setText(album, metadata.albumName, "");

  const imageUrl = metadata.images?.[0]?.url;

  artwork.src = imageUrl || DEFAULT_ARTWORK;
}

artwork.addEventListener("error", () => {
  if (artwork.src !== location.origin + DEFAULT_ARTWORK) {
    artwork.src = DEFAULT_ARTWORK;
  }
});

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

  elapsed.textContent = formatTime(current);
  total.textContent = formatTime(duration);
}

function updatePlaybackState(event) {
  const state = event.playerState;

  switch (state) {
    case cast.framework.messages.PlayerState.PLAYING:
      playbackState.textContent = "NOW PLAYING";
      break;

    case cast.framework.messages.PlayerState.PAUSED:
      playbackState.textContent = "PAUSED";
      break;

    case cast.framework.messages.PlayerState.BUFFERING:
      playbackState.textContent = "BUFFERING";
      break;

    default:
      playbackState.textContent = "READY TO PLAY";
  }
}

// Metadata updates
playerManager.addEventListener(
  cast.framework.events.EventType.MEDIA_STATUS,
  updateMetadata
);

// // Playback updates
// playerManager.addEventListener(
//   cast.framework.events.EventType.PLAYER_STATE_CHANGED,
//   updatePlaybackState
// );

// Progress updates
// playerManager.addEventListener(
//   cast.framework.events.EventType.TIME_UPDATE,
//   updateProgress
// );

// // Handle receiver errors
playerManager.addEventListener(
  cast.framework.events.EventType.ERROR,
  (event) => {
    fetch("https://musasoftlabs.com:3000/castError", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        error: event.error,
        mediaInformation: playerManager.getMediaInformation(),
        currentTimeSec: playerManager.getCurrentTimeSec(),
        durationSec: playerManager.getDurationSec(),
      }),
    }).catch((err) => {
      console.error("Failed to report cast error:", err);
    });
    playbackState.textContent = "PLAYBACK ERROR";
  }
);

// Configure supported controls
playerManager.setSupportedMediaCommands(
  cast.framework.messages.Command.PLAY |
    cast.framework.messages.Command.PAUSE |
    cast.framework.messages.Command.SEEK |
    cast.framework.messages.Command.STREAM_TRANSFER
);

// Start receiver
context.start();
