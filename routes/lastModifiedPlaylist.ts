import playlists from "./playlists";

export default function lastModifiedPlaylist() {
  return playlists(1)[0];
}
