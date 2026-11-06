import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const project = import.meta.dir;
const repo = resolve(project, "../..");
const width = 1920;
const height = 1080;
const fps = 30;

function run(command, args) {
  const result = Bun.spawnSync([command, ...args], { stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    throw new Error(`${command} failed: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString();
}

function probe(file) {
  return JSON.parse(run("ffprobe", [
    "-v", "error", "-show_streams", "-show_format", "-of", "json", file,
  ]));
}

function readShots(manifest) {
  if (typeof manifest.sample !== "boolean" || !Array.isArray(manifest.shots) || !manifest.shots.length) {
    throw new Error("Set sample to true or false and supply at least one shot.");
  }

  let frame = 0;
  const ids = new Set();
  return manifest.shots.map(({ id, source, seconds, in: start = 0, still = false }) => {
    const frames = Math.round(seconds * fps);
    if (!/^[a-z][a-z0-9-]*$/.test(id ?? "") || ids.has(id) || typeof source !== "string" || !source.trim()) {
      throw new Error("Every shot needs a unique lowercase id and a source file.");
    }
    if (!Number.isFinite(seconds) || frames < 1 || !Number.isFinite(start) || start < 0 || (still && start !== 0)) {
      throw new Error(`Invalid timing for ${id}.`);
    }
    ids.add(id);
    const shot = { id, source, still, start, frames, at: frame / fps, duration: frames / fps };
    frame += frames;
    return shot;
  });
}

function stageShot(shot, file, output, sample) {
  const media = probe(file);
  const picture = media.streams.find((stream) => stream.codec_type === "video");
  if (!picture) throw new Error(`${shot.id} needs a picture track.`);
  const available = Number(picture.duration ?? media.format.duration);
  if (!shot.still && (!Number.isFinite(available) || shot.start + shot.duration > available + 1 / fps)) {
    throw new Error(`${shot.id} needs ${shot.duration}s of footage from ${shot.start}s.`);
  }

  const hasAudio = !shot.still && media.streams.some((stream) => stream.codec_type === "audio");
  const input = shot.still ? ["-loop", "1", "-framerate", String(fps)] : ["-ss", String(shot.start)];
  const audio = hasAudio ? [] : ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"];
  const fit = shot.still
    ? `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height}`
    : `scale=${width}:${height}:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`;
  const label = sample
    ? ",drawtext=font=Arial:text=SAMPLE STILLS / EDIT TEST:fontsize=30:fontcolor=white:box=1:boxcolor=black@0.86:boxborderw=14:x=54:y=54"
    : "";
  run("ffmpeg", [
    "-v", "error", "-nostdin", ...input, "-i", file, ...audio,
    "-map", "0:v:0", "-map", hasAudio ? "0:a:0" : "1:a:0",
    "-vf", `${fit},setsar=1,fps=${fps}${label}`, "-af", "apad",
    "-t", String(shot.duration), "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-ar", "48000", "-ac", "2", "-map_metadata", "-1", "-movflags", "+faststart", output,
  ]);
}

function composition(shots) {
  const clips = shots.map(({ id, at, duration }) =>
    `    <video id="${id}" class="clip media" src="assets/${id}.mp4" data-start="${at}" data-duration="${duration}" data-track-index="0" data-has-audio="true" playsinline></video>`,
  ).join("\n");
  const last = shots.at(-1);
  const css = readFileSync(join(repo, "app/globals.css"), "utf8");
  const tokens = ["ink", "canvas", "lemon"].map((name) => css.match(new RegExp(`--${name}: [^;]+;`))[0]).join(" ");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Lemon Pal proof reel</title>
  <style>
    :root { ${tokens} }
    body { margin: 0; }
    #reel { position: relative; width: ${width}px; height: ${height}px; overflow: hidden; background: var(--ink); }
    .media { position: absolute; inset: 0; width: 100%; height: 100%; }
    .end-card { position: absolute; left: 54px; bottom: 54px; display: flex; align-items: center; gap: 26px;
      padding: 26px 36px; border-radius: 34px; background: var(--canvas); color: var(--ink); }
    .end-card img { width: 94px; height: 94px; border-radius: 22px; background: var(--lemon); }
    h1 { margin: 0; font: 700 56px/1.1 Georgia, serif; }
    p { margin: 8px 0 0; font: 500 30px/1.3 system-ui, sans-serif; }
  </style>
</head>
<body>
  <main id="reel" data-composition-id="reel" data-start="0" data-width="${width}" data-height="${height}" data-fps="${fps}">
${clips}
    <div id="end-card" class="clip end-card" data-start="${last.at}" data-duration="${last.duration}" data-track-index="1">
      <img src="assets/lemon-pal.png" alt="">
      <div><h1>Lemon Pal</h1><p>Open your stand with the sign you already made.</p></div>
    </div>
  </main>
</body>
</html>
`;
}

try {
  const manifestPath = resolve(process.argv[2] ?? join(project, "shots.sample.json"));
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const shots = readShots(manifest);
  const build = join(repo, "build", "video");
  mkdirSync(build, { recursive: true });
  const output = mkdtempSync(join(build, manifest.sample ? "sample-" : "recording-"));
  mkdirSync(join(output, "assets"));
  for (const shot of shots) {
    console.log(`Preparing ${shot.id} at ${shot.at.toFixed(2)}s`);
    stageShot(shot, resolve(dirname(manifestPath), shot.source), join(output, "assets", `${shot.id}.mp4`), manifest.sample);
  }
  copyFileSync(join(repo, "public/icons/lemonpal-192.png"), join(output, "assets/lemon-pal.png"));
  writeFileSync(join(output, "index.html"), composition(shots));
  writeFileSync(join(output, "concat.txt"), shots.map(({ id }) => `file 'assets/${id}.mp4'`).join("\n") + "\n");
  run("ffmpeg", [
    "-v", "error", "-nostdin", "-f", "concat", "-safe", "1", "-i", join(output, "concat.txt"),
    "-c", "copy", "-movflags", "+faststart", join(output, "review.mp4"),
  ]);
  console.log(`Review cut and HyperFrames composition ready in ${output}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
