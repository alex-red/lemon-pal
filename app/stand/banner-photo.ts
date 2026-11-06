// Shared by the store and donation editors. Runs in the browser only.

const BANNER_WIDTH = 1500;

/** Crops a photo to 3:1 from its middle and shrinks it to a JPEG small enough to keep in the store record. */
export async function bannerFrom(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const ratio = 3;
    const cropWidth = Math.min(bitmap.width, bitmap.height * ratio);
    const cropHeight = cropWidth / ratio;
    const sx = (bitmap.width - cropWidth) / 2;
    const sy = (bitmap.height - cropHeight) / 2;
    for (const [width, quality] of [
      [BANNER_WIDTH, 0.8],
      [1200, 0.7],
      [900, 0.6],
    ] as const) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(width, Math.round(cropWidth));
      canvas.height = Math.round(canvas.width / ratio);
      canvas.getContext("2d")!.drawImage(bitmap, sx, sy, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/jpeg", quality);
      if (url.length < 380_000) return url;
    }
    throw new Error("too big");
  } finally {
    bitmap.close();
  }
}
