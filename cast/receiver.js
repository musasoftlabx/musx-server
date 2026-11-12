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

castDebugLogger.setEnabled(true);
castDebugLogger.showDebugLogs(true);

castDebugLogger.warn(
  "Musix logger",
  "Playable URL:",
  playerManager.getMediaInformation()?.title,
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
    "0",
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

  // ? Lyrics integration
  fetch("https://musasoftlabs.com/Music/Tanzania/Zuchu/Chapati.lrc")
    .then((response) => response.text())
    .then((data) => {
      const lyrics = document.getElementById("lyrics");
      lyrics.textContent = data;

      var lrc = new Lyrics(data);
      document
        .getElementById("audio")
        .addEventListener("timeupdate", function () {
          //Unhighlight all the lyrics
          var lyric_selected = lyrics_container.querySelectorAll("p[selected]");
          for (var i = 0; i < lyric_selected.length; i++) {
            lyric_selected[i].removeAttribute("selected");
          }

          //Get the lyric to highlight
          var lyric_selected = lrc.select(this.currentTime);

          //Highlight the lyric
          if (lyric_selected != undefined && lyric_selected >= 0) {
            lyrics_container
              .querySelectorAll("p")
              [lyric_selected].setAttribute("selected", "selected");
          }
        });
    })
    .catch((error) => console.error("Error:", error));
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
