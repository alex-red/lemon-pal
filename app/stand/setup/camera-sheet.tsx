"use client";

import { useEffect, useRef, useState } from "react";
import { Button, CameraIcon, ExclamationIcon, Pill, Sheet, Spinner } from "@/components/kit";

/** Whether this browser can show a live camera in the page. Needs HTTPS or localhost. */
export function canUseLiveCamera() {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;
}

/**
 * A live camera in a sheet, so the sign is photographed without leaving Lemon Pal. Mount it only while
 * it's open: unmounting stops the camera. If the camera is blocked, `onFallback` hands off to the
 * device's own camera or file picker.
 */
export function CameraSheet({
  onCapture,
  onClose,
  onFallback,
}: {
  onCapture: (photo: Blob) => void;
  onClose: () => void;
  onFallback: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"starting" | "live" | "blocked">("starting");

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    navigator.mediaDevices
      // The back camera on phones and tablets; any camera on a laptop.
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(async (media) => {
        if (stopped) return media.getTracks().forEach((track) => track.stop());
        stream = media;
        const element = video.current!;
        element.srcObject = media;
        await element.play().catch(() => {});
        setState("live");
      })
      .catch(() => setState("blocked"));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function shoot() {
    const element = video.current;
    if (!element?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")!.drawImage(element, 0, 0);
    canvas.toBlob((blob) => blob && onCapture(blob), "image/jpeg", 0.9);
  }

  return (
    <Sheet open onClose={onClose} title="Photograph your sign">
      <div className="flex flex-col gap-5">
        <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-[18px] bg-fill">
          <video
            ref={video}
            playsInline
            muted
            aria-label="Camera preview"
            className={state === "live" ? "absolute inset-0 size-full object-cover" : "hidden"}
          />
          {state === "starting" ? (
            <p className="flex items-center gap-2 text-subhead text-ink-2">
              <Spinner /> Starting the camera…
            </p>
          ) : null}
          {state === "blocked" ? (
            <div role="alert" className="flex flex-col items-center gap-2 px-6 text-center">
              <Pill tone="berry" icon={<ExclamationIcon />}>
                No camera
              </Pill>
              <p className="text-subhead text-ink-2">
                Lemon Pal couldn&rsquo;t open a camera here. Allow camera access in your browser, or use a photo instead.
              </p>
            </div>
          ) : null}
        </div>
        {state === "blocked" ? (
          <Button variant="tinted" size="xl" className="w-full" onClick={onFallback}>
            Use a photo instead
          </Button>
        ) : (
          <>
            <Button variant="filled" size="xl" className="w-full" icon={<CameraIcon />} disabled={state !== "live"} onClick={shoot}>
              Take photo
            </Button>
            <p className="-mt-2 text-center text-footnote text-ink-2">Fit the whole sign in the frame, as straight on as you can.</p>
          </>
        )}
      </div>
    </Sheet>
  );
}
