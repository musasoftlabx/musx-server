export type Lyrics = { body: { id: number; lyrics: number } };
export type Palette = { body: { id: number; palette: string[] } };
export type PlayCount = { error: any; body: { id: string } };
export type CreatePlaylistBodyProps = {
  body: { name: string; description: string };
};
export type DeletePlaylistBodyProps = { query: { playlistId: number } };
export type RateTrackBodyProps = { body: { id: number; rating: number } };
