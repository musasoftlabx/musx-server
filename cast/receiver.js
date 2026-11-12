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
      let lyrics = document.getElementById("lyrics");
      lyrics.textContent = data;

      const select = (ts) => {
        if (isNaN(ts)) {
          return -1;
        }
        var timestamp = Number(ts) + this.timestamp_offset;
        var i = 0;
        if (timestamp < this.lyrics_all[0].timestamp) {
          return -1;
        }
        for (i = 0; i < this.lyrics_all.length - 1; i++) {
          if (
            this.lyrics_all[i].timestamp <= timestamp &&
            this.lyrics_all[i + 1].timestamp > timestamp
          ) {
            break;
          }
        }
        return i;
      };

      let timestamp_offset = 0;
      let lyrics_all = undefined;
      let meta_info = undefined;
      let ID_TAGS = [
        { name: "artist", id: "ar" },
        { name: "album", id: "al" },
        { name: "title", id: "ti" },
        { name: "author", id: "au" },
        { name: "length", id: "length" },
        { name: "by", id: "by" },
        { name: "offset", id: "offset" },
        { name: "createdBy", id: "re" },
        { name: "createdByVersion", id: "ve" },
      ];

      /* Initialization */
      for (var i = 0; i < ID_TAGS.length; i++) {
        ID_TAGS[i].re = new RegExp("\\[" + ID_TAGS[i].id + ":(.*)\\]$", "g");
      }

      lyrics_all = new Array();
      meta_info = new Object();
      timestamp_offset = 0;

      var lines_all = String(data).split("\n");
      for (var i = 0; i < lines_all.length; i++) {
        var line = lines_all[i].replace(/(^\s*)|(\s*$)/g, "");
        if (!line) {
          continue;
        }

        //Parse ID Tags
        var is_id_tag = false;
        for (var j = 0; j < ID_TAGS.length; j++) {
          var match = ID_TAGS[j].re.exec(line);
          if (!match || match.length < 2) {
            continue;
          }

          is_id_tag = true;
          var value = match[1].replace(/(^\s*)|(\s*$)/g, "");
          if (typeof ID_TAGS[j].handler == "function") {
            meta_info[String(ID_TAGS[j].name)] = ID_TAGS[j].handler.call(
              this,
              value,
            );
          } else {
            meta_info[String(ID_TAGS[j].name)] = String(value);
          }
        }
        if (is_id_tag) {
          continue;
        }

        //Parse lyric
        var timestamp_all = Array();
        while (true) {
          var match = /^(\[\d+:\d+(.\d+)?\])(.*)/g.exec(line);
          if (match) {
            timestamp_all.push(match[1]);
            line = match[match.length - 1].replace(/(^\s*)|(\s*$)/g, "");
          } else {
            break;
          }
        }
        for (var j = 0; j < timestamp_all.length; j++) {
          var ts_match = /^\[(\d{1,2}):(\d|[0-5]\d)(\.(\d+))?\]$/g.exec(
            timestamp_all[j],
          );
          if (ts_match) {
            lyrics_all.push({
              timestamp:
                Number(ts_match[1]) * 60 +
                Number(ts_match[2]) +
                (ts_match[4] ? Number("0." + ts_match[4]) : 0),
              text: line,
            });
          }
        }
      }

      // lyrics_all.sort(function (a, b) {
      //   return a.timestamp > b.timestamp ? 1 : -1;
      // });
      // if (!lyrics_all.length) {
      //   lyrics_all = undefined;
      // }
      // if (this.isEmpty(meta_info)) {
      //   meta_info = undefined;
      // }
      // return lyrics_all !== undefined || meta_info !== undefined ? true : false;

      //var lrc = new Lyrics(data);
      document
        .getElementById("audio")
        .addEventListener("timeupdate", function () {
          //lyrics.textContent = this.currentTime;
          //Unhighlight all the lyrics
          var lyric_selected = lyrics_container.querySelectorAll("p[selected]");
          for (var i = 0; i < lyric_selected.length; i++) {
            lyric_selected[i].removeAttribute("selected");
          }

          //Get the lyric to highlight
          var lyric_selected = select(this.currentTime);

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
