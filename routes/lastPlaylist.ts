import playlists from "./playlists";

export default function lastPlaylist() {
  return playlists(1)[0];
}
