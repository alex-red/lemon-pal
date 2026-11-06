// From the repo root: bun scripts/export-brand-icons.ts
// Requires rsvg-convert (librsvg) and magick (ImageMagick).
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PalAppIcon, palBody, palLeaf } from "../components/kit/pal-app-icon";

const TILE = "#f5df3d";
const INK = "#272215";

// The fruit's outline without the smile cutout, which the small mark redraws thicker.
const fruitOutline = palBody.slice(0, palBody.indexOf("ZM") + 1);
// Centerline of the smile cutout in palBody.
const smileCenterline = "M7.65 15.35C10.65 17.4 14.5 16.3 16.2 13.2";

/**
 * The flat mark simplified for 16–32px: the smile is ~65% thicker and a tile-colored gap separates the leaf
 * from the fruit, so neither closes up when the browser rasterizes it at tab size. Used for favicon.ico and
 * icon.svg, which browsers also draw at 16px.
 */
const smallMark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="5.5" fill="${TILE}"/>
  <path fill="${INK}" d="${fruitOutline}"/>
  <path fill="none" stroke="${TILE}" stroke-width="3" stroke-linecap="round" d="${smileCenterline}"/>
  <path fill="${INK}" stroke="${TILE}" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke" d="${palLeaf}"/>
</svg>
`;

const scratch = await mkdtemp(join(tmpdir(), "lemonpal-icons-"));
try {
  const render = async (name: string, props: Parameters<typeof PalAppIcon>[0]) => {
    const file = join(scratch, `${name}.svg`);
    await writeFile(file, renderToStaticMarkup(createElement(PalAppIcon, props)));
    return file;
  };
  const png = (svg: string, size: number, out: string) =>
    execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), svg, "-o", out]);

  // "any" purpose: the rounded tile with transparent corners, for desktop installs and launchers that
  // show the icon as-is.
  const rounded = await render("rounded", {});
  // "maskable" purpose: a square plate with the mark inside the safe zone, for Android to crop.
  const maskable = await render("maskable", { fullBleed: true, safeZone: true });
  // iOS rounds the corners itself and rejects transparency, so it gets the square plate.
  const square = await render("square", { fullBleed: true });

  await mkdir("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    png(rounded, size, `public/icons/lemonpal-${size}.png`);
    png(maskable, size, `public/icons/lemonpal-maskable-${size}.png`);
  }
  png(square, 180, "app/apple-icon.png");

  await writeFile("app/icon.svg", smallMark);
  const small = join(scratch, "small.svg");
  await writeFile(small, smallMark);
  const frames = [16, 32, 48].map((size) => ({ size, file: join(scratch, `favicon-${size}.png`) }));
  for (const { size, file } of frames) png(small, size, file);
  execFileSync("magick", [...frames.map(({ file }) => file), "app/favicon.ico"]);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
