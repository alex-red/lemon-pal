# Lemon Pal proof reel tooling

Run from the repository root with Bun, FFmpeg, and ffprobe on PATH. The sample needs an FFmpeg build with the drawtext filter.

```sh
bun scripts/video/prepare.mjs
```

The command prints a fresh output directory under `build/video/`. It contains a 1080p `review.mp4` and a HyperFrames composition in `index.html`. The 23-second sample uses labeled demo stills and silent audio.

Copy `shots.recording.example.json` to a local workspace with your footage. Paths are relative to the manifest. Set each shot's source, optional `in` point, and duration in seconds. Set `still` to true for images. For payment, use a synchronized clip with both devices in view and include the full interval from buyer approval through Paid.

```sh
bun scripts/video/prepare.mjs /path/to/shots.recording.json
```

With HyperFrames on PATH, run the following from the printed output directory. The composition adds the Lemon Pal closing card.

```sh
hyperframes preview
hyperframes check
hyperframes render --output proof-reel.mp4 --fps 30
```

Save any hand edits before preparing another set of clips. [HyperFrames CLI reference](https://hyperframes.heygen.com/packages/cli)
