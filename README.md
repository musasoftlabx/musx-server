# Elysia with Bun runtime

## Getting Started

To get started with this template, simply paste this command into your terminal:

```bash
bun create elysia ./elysia-example
```

## Development

To start the development server run:

```bash
bun run dev
```

Open http://localhost:3000/ with your browser to see the result.

Install latest ffmpeg version
check latest release
https://ffmpeg.org/releases/?C=M;O=D

> wget on terminal or click to download
> tar -xvf ffmpeg-7.1.tar.xz or > tar -xJf ffmpeg-7.1.tar.xz to extract the compressed file
> cd ffmpeg-7.1
> ./configure --disable-x86asm
> make
> make install
> ./configure --enable-libmp3lame --disable-x86asm

Also check https://ultahost.com/knowledge-base/install-ffmpeg-on-ubuntu/ incase installation fails

Install opus

opus-tools

## Scanner

`GET /scan` streams progress while scanning `./Music` for new `.mp3`, `.flac`,
`.aac`, and `.m4a` files.
It skips paths already in the database, probes up to four files concurrently,
and commits each batch in a short SQLite transaction. Each `ffprobe` process
has a 30-second timeout. Artwork and waveform generation remain disabled.
Existing MP3 asset names are preserved; FLAC, AAC, and M4A asset names retain their
extension suffixes to distinguish files with the same base name.

Cleanup checks stored files asynchronously, verifies the music directory is
still accessible and unchanged before deleting records, and tolerates missing
artwork/waveform files. Other failures are streamed and stored in `scanErrors`.

An atomic `.music-scan.lock` directory prevents overlapping scans across server
workers using the same working directory. Conflicting requests receive HTTP 409.
The lock is released when the scan finishes or its generator is closed.
After a process crash, confirm that no scan is running before manually removing
the stale, empty lock directory with `rmdir .music-scan.lock`.

Run scanner regression tests with `bun test routes/scan.test.ts`.

11:33:00 - 1900files
11:43:00 - 16200files
11:50:50 - 27113files
1:22:00 - artwork scan complete
