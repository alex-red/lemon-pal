"use client";

import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent, type PointerEvent } from "react";
import { Button, CameraIcon, MinusIcon, PhotoIcon, PlusIcon, Sheet, TrashIcon } from "@/components/kit";

/** Item photos are cropped to this many pixels square. Register tiles show them about 20rem across at most. */
export const THUMB_SIZE = 480;

const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

/** A new photo waiting for the seller to frame it. */
type Pending = { url: string; bitmap: ImageBitmap };
/** The square kept: how far it's zoomed in from the photo's short side, and its centre, in photo pixels. */
type Crop = { zoom: number; cx: number; cy: number };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const sideOf = (photo: ImageBitmap, zoom: number) => Math.min(photo.width, photo.height) / zoom;

/** Keeps the square inside the photo. */
function fit(photo: ImageBitmap, crop: Crop): Crop {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM);
  const half = sideOf(photo, zoom) / 2;
  return { zoom, cx: clamp(crop.cx, half, photo.width - half), cy: clamp(crop.cy, half, photo.height - half) };
}

/**
 * One item's photo, shown large, with ways to replace or remove it. The photo is what buyers tap on the register
 * and in the store, so it's worth seeing at size before publishing. A new photo opens in a square frame to drag
 * and zoom, and only replaces the old one once the seller confirms it. Mount the sheet only while it's open.
 */
export function PhotoSheet({
  name,
  image,
  emoji,
  liveCamera,
  initialPhoto,
  onLiveCamera,
  onReplace,
  onRemove,
  onClose,
}: {
  name: string;
  image: string | undefined;
  emoji: string;
  /** Whether the page can show its own camera. Otherwise Take photo opens the device's camera app. */
  liveCamera: boolean;
  /** A photo just taken with the in-page camera, to frame straight away. */
  initialPhoto?: Blob | null;
  onLiveCamera: () => void;
  /** The framed photo, as a square JPEG data URL. */
  onReplace: (image: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const library = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [crop, setCrop] = useState<Crop>({ zoom: 1, cx: 0, cy: 0 });
  const [error, setError] = useState<string | null>(null);

  async function startCrop(photo: Blob) {
    setError(null);
    try {
      const bitmap = await createImageBitmap(photo);
      setPending({ url: URL.createObjectURL(photo), bitmap });
      setCrop({ zoom: 1, cx: bitmap.width / 2, cy: bitmap.height / 2 });
    } catch {
      setError("Couldn’t open that photo. Try another one.");
    }
  }

  useEffect(() => {
    // Decoding the camera's photo is async work in the browser, so it starts here rather than during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialPhoto) void startCrop(initialPhoto);
  }, [initialPhoto]);

  // Frees the photo once it's used, discarded, or the sheet closes.
  useEffect(
    () => () => {
      if (!pending) return;
      URL.revokeObjectURL(pending.url);
      pending.bitmap.close();
    },
    [pending],
  );

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void startCrop(file);
    e.target.value = ""; // lets the same photo be picked again
  };

  /** Moves the photo under the frame by a distance in screen pixels, as a drag does. */
  function pan(dx: number, dy: number) {
    const photo = pending?.bitmap;
    const width = frame.current?.clientWidth;
    if (!photo || !width) return;
    setCrop((c) => {
      const scale = sideOf(photo, c.zoom) / width;
      return fit(photo, { ...c, cx: c.cx - dx * scale, cy: c.cy - dy * scale });
    });
  }

  const zoomTo = (zoom: number) => pending && setCrop((c) => fit(pending.bitmap, { ...c, zoom }));
  // Steps build on the latest zoom, so quick presses all count.
  const zoomBy = (delta: number) => pending && setCrop((c) => fit(pending.bitmap, { ...c, zoom: c.zoom + delta }));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = { x: event.clientX, y: event.clientY };
  }
  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const last = dragging.current;
    if (!last) return;
    pan(event.clientX - last.x, event.clientY - last.y);
    dragging.current = { x: event.clientX, y: event.clientY };
  }
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = (frame.current?.clientWidth ?? 300) / 20;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      pan(...move);
    } else if (event.key === "+" || event.key === "=") zoomBy(ZOOM_STEP);
    else if (event.key === "-") zoomBy(-ZOOM_STEP);
  }

  /** Draws the framed square at thumbnail size and hands it over. */
  function confirmPhoto() {
    if (!pending) return;
    const { bitmap } = pending;
    const side = sideOf(bitmap, crop.zoom);
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = THUMB_SIZE;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingQuality = "high";
    context.filter = "saturate(1.12) contrast(1.05)"; // the same small lift as thumbnails read from a sign
    context.drawImage(bitmap, crop.cx - side / 2, crop.cy - side / 2, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
    onReplace(canvas.toDataURL("image/jpeg", 0.72));
    setPending(null);
  }

  const box =
    "relative mx-auto aspect-square w-full max-w-[22rem] overflow-hidden rounded-[22px] bg-fill shadow-card tight:max-w-[14rem] short:max-w-[12rem]";

  if (pending) {
    const { bitmap } = pending;
    const side = sideOf(bitmap, crop.zoom);
    return (
      <Sheet open onClose={onClose} title={`Frame ${name}`}>
        <div className="flex flex-col gap-5">
          <div
            ref={frame}
            role="group"
            tabIndex={0}
            aria-label="Photo framing. Drag, or use the arrow keys, to move the photo. Plus and minus zoom."
            className={`${box} focus-ring cursor-grab touch-none select-none active:cursor-grabbing`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={() => (dragging.current = null)}
            onPointerCancel={() => (dragging.current = null)}
            onKeyDown={onKeyDown}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being framed */}
            <img
              src={pending.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                width: `${(bitmap.width / side) * 100}%`,
                height: `${(bitmap.height / side) * 100}%`,
                left: `${(-(crop.cx - side / 2) / side) * 100}%`,
                top: `${(-(crop.cy - side / 2) / side) * 100}%`,
              }}
            />
            {/* Thirds, to help centre the item. */}
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-1/3 w-1/3 border-x border-hairline" />
            <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/3 h-1/3 border-y border-hairline" />
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              iconOnly
              aria-label="Zoom out"
              icon={<MinusIcon />}
              disabled={crop.zoom <= 1}
              onClick={() => zoomBy(-ZOOM_STEP)}
            />
            <input
              type="range"
              aria-label="Zoom"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={crop.zoom}
              onChange={(e) => zoomTo(Number(e.target.value))}
              className="h-11 min-w-0 flex-1 cursor-pointer accent-lemon"
            />
            <Button
              variant="ghost"
              iconOnly
              aria-label="Zoom in"
              icon={<PlusIcon />}
              disabled={crop.zoom >= MAX_ZOOM}
              onClick={() => zoomBy(ZOOM_STEP)}
            />
          </div>
          <p className="-mt-3 text-center text-footnote text-ink-2">Drag to move the photo. Zoom in to fill the square with the item.</p>

          <div className="grid grid-cols-2 gap-3">
            <Button variant="tinted" size="lg" onClick={() => setPending(null)}>
              Discard
            </Button>
            <Button variant="filled" size="lg" onClick={confirmPhoto}>
              Use photo
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title={name}>
      <div className="flex flex-col gap-5">
        <div className={box}>
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL cropped in the browser, or a bundled demo photo
            <img src={image} alt={`Photo of ${name}`} className="absolute inset-0 size-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <span aria-hidden className="text-[5rem] leading-none">
                {emoji || <CameraIcon className="text-ink-3" />}
              </span>
              <p className="text-subhead text-ink-2">
                No photo yet. Buyers see {emoji ? "the icon" : "the first letter"} on the register and in your store.
              </p>
            </div>
          )}
        </div>
        {error ? (
          <p role="alert" className="-mt-2 text-center text-footnote text-berry">
            {error}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="tinted" size="lg" icon={<CameraIcon />} onClick={() => (liveCamera ? onLiveCamera() : camera.current?.click())}>
            Take photo
          </Button>
          <Button variant="tinted" size="lg" icon={<PhotoIcon />} onClick={() => library.current?.click()}>
            {image ? "Replace" : "Choose"}
          </Button>
        </div>
        {image ? (
          <Button variant="destructive" icon={<TrashIcon />} className="self-center" onClick={onRemove}>
            Remove photo
          </Button>
        ) : null}
        {/* The library picker has no capture hint, so phones offer saved photos. The other opens the camera app. */}
        <input ref={library} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden onChange={pick} />
        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={pick} />
      </div>
    </Sheet>
  );
}
