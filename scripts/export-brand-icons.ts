// From the repo root: bun scripts/export-brand-icons.ts
// Requires rsvg-convert (librsvg) and magick (ImageMagick).
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PalAppIcon, palBody, palLeaf } from "../components/kit/pal-app-icon";

const scratch = await mkdtemp(join(tmpdir(), "lemonpal-icons-"));
try {
  const tile = join(scratch, "tile.svg");
  await writeFile(tile, renderToStaticMarkup(createElement(PalAppIcon, { fullBleed: true })));
  await mkdir("public/icons", { recursive: true });
  for (const size of [192, 512]) {
    const file = `public/icons/lemonpal-${size}.png`;
    execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), tile, "-o", file]);
  }
  execFileSync("rsvg-convert", ["-w", "180", "-h", "180", tile, "-o", "app/apple-icon.png"]);

  const flat = join(scratch, "flat.svg");
  await writeFile(flat, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <rect width="24" height="24" rx="5.5" fill="#f5df3d"/>
    <path fill="#272215" d="${palLeaf}"/>
    <path fill="#272215" fill-rule="evenodd" d="${palBody}"/>
  </svg>`);
  const frames = [16, 32, 48].map((size) => ({ size, file: join(scratch, `favicon-${size}.png`) }));
  for (const { size, file } of frames) {
    execFileSync("rsvg-convert", ["-w", String(size), "-h", String(size), flat, "-o", file]);
  }
  execFileSync("magick", [...frames.map(({ file }) => file), "app/favicon.ico"]);
} finally {
  await rm(scratch, { recursive: true, force: true });
}
