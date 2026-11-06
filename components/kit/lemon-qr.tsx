import QRCode from "qrcode";
import { cn } from "./cn";
import { PalAppIcon } from "./pal-app-icon";

/*
 * A QR code with Pal's lemon imprinted into it, after "Halftone QR codes" (Chu et al., 2013).
 *
 * Phone scanners judge each module by its center, so every module keeps a solid center dot in its true
 * color, and the rest of the module is tinted from a picture of a lemon. The tint is pushed toward the
 * module's own value (light modules stay light, dark ones stay dark), so the code still thresholds
 * cleanly while the lemon shows through. Finder, timing and alignment patterns are drawn untouched.
 *
 * Colors are fixed, not theme tokens: a code must keep the same contrast in light and dark mode.
 */

type Tone = { light: string; dark: string };

const TONES = {
  paper: { light: "#fffdf3", dark: "#2a2414" },
  peel: { light: "#ffe14d", dark: "#5c4a06" },
  rind: { light: "#f2c21b", dark: "#4a3a04" },
  sheen: { light: "#fff6bf", dark: "#5c4a06" },
  face: { light: "#d9a20f", dark: "#2a2414" },
  leaf: { light: "#b5df84", dark: "#24501a" },
} satisfies Record<string, Tone>;

type ToneName = keyof typeof TONES;

/** Share of each module's width taken by its true-color center dot. */
const DOT = 0.46;
/** Blank modules around the code. Scanners need a clear border. */
const QUIET = 3;

// Rotates (x, y) about (cx, cy) by `deg` and reports where it lands relative to an ellipse.
function inEllipse(x: number, y: number, cx: number, cy: number, rx: number, ry: number, deg = 0) {
  const t = (deg * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const u = dx * Math.cos(t) + dy * Math.sin(t);
  const v = -dx * Math.sin(t) + dy * Math.cos(t);
  return (u / rx) ** 2 + (v / ry) ** 2;
}

/** The lemon picture, sampled at (x, y) in 0–1 code coordinates. */
function toneAt(x: number, y: number): ToneName {
  if (inEllipse(x, y, 0.63, 0.16, 0.13, 0.055, -28) <= 1) return "leaf";

  const body = Math.min(
    inEllipse(x, y, 0.5, 0.55, 0.4, 0.3, -14),
    inEllipse(x, y, 0.11, 0.65, 0.06, 0.05),
    inEllipse(x, y, 0.89, 0.45, 0.06, 0.05),
  );
  if (body > 1) return "paper";

  // Happy closed eyes and an open smile.
  const eye = Math.min(inEllipse(x, y, 0.4, 0.5, 0.045, 0.03), inEllipse(x, y, 0.6, 0.47, 0.045, 0.03));
  if (eye <= 1) return "face";
  const smile = Math.hypot(x - 0.5, y - 0.53);
  if (smile <= 0.12 && y >= 0.6) return "face";

  if (inEllipse(x, y, 0.33, 0.4, 0.1, 0.04, -30) <= 1) return "sheen";
  return body > 0.78 ? "rind" : "peel";
}

type Matrix = { size: number; dark: (r: number, c: number) => boolean; reserved: (r: number, c: number) => boolean };

function buildMatrix(value: string): Matrix {
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "H" });
  const bits = modules as unknown as { size: number; data: Uint8Array; reservedBit: Uint8Array };
  return {
    size: bits.size,
    dark: (r, c) => bits.data[r * bits.size + c] === 1,
    reserved: (r, c) => bits.reservedBit[r * bits.size + c] === 1,
  };
}

// Finder patterns sit in the three 7×7 corners. They're drawn as rounded shapes of their own.
function inFinder(r: number, c: number, size: number) {
  return (r < 7 && c < 7) || (r < 7 && c >= size - 7) || (r >= size - 7 && c < 7);
}

const square = (x: number, y: number, s: number) => `M${x} ${y}h${s}v${s}h${-s}z`;

export function LemonQR({
  value,
  label,
  art = true,
  className,
}: {
  value: string;
  /** What the code is for, read to screen readers, e.g. "Scan to pay with PayPal". */
  label: string;
  /** false draws a plain code with a lemon badge in the middle: the fallback if a phone struggles. */
  art?: boolean;
  className?: string;
}) {
  // Plain computation, no hooks, so the code also renders in server components. A few thousand modules is cheap.
  const { size, paths } = (() => {
    const m = buildMatrix(value);
    // Tinted squares first, then every center dot on top, each layer merged into one path per color.
    const layers = [new Map<string, string[]>(), new Map<string, string[]>()];
    const add = (layer: 0 | 1, color: string, d: string) => {
      const fills = layers[layer];
      fills.set(color, [...(fills.get(color) ?? []), d]);
    };
    const inset = (1 - DOT) / 2;

    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        if (inFinder(r, c, m.size)) continue;
        const dark = m.dark(r, c);
        const x = c + QUIET;
        const y = r + QUIET;
        const tone = TONES[art && !m.reserved(r, c) ? toneAt((c + 0.5) / m.size, (r + 0.5) / m.size) : "paper"];
        const own = dark ? tone.dark : tone.light;
        const truth = dark ? TONES.paper.dark : TONES.paper.light;
        add(0, own, square(x, y, 1));
        if (own !== truth) add(1, truth, square(x + inset, y + inset, DOT));
      }
    }
    return { size: m.size, paths: layers.flatMap((fills, layer) => [...fills].map(([color, d]) => ({ key: `${layer}${color}`, color, d }))) };
  })();

  const full = size + QUIET * 2;
  const finders = [
    [QUIET, QUIET],
    [QUIET + size - 7, QUIET],
    [QUIET, QUIET + size - 7],
  ];

  return (
    <div className={cn("relative", className)}>
      <svg viewBox={`0 0 ${full} ${full}`} role="img" aria-label={label} shapeRendering="crispEdges" className="block size-full">
        <rect width={full} height={full} rx={2.5} fill={TONES.paper.light} />
        {paths.map(({ key, color, d }) => (
          <path key={key} d={d.join("")} fill={color} />
        ))}
        <g shapeRendering="geometricPrecision">
          {finders.map(([x, y]) => (
            <g key={`${x}-${y}`}>
              <rect x={x} y={y} width={7} height={7} rx={2.2} fill={TONES.paper.dark} />
              <rect x={x + 1} y={y + 1} width={5} height={5} rx={1.5} fill={TONES.paper.light} />
              <rect x={x + 2} y={y + 2} width={3} height={3} rx={1} fill={TONES.paper.dark} />
            </g>
          ))}
        </g>
      </svg>
      {art ? null : (
        // About 4% of the code's area, well inside what level H can lose. The white rim keeps modules crisp.
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[20%] -translate-x-1/2 -translate-y-1/2 rounded-[22%] bg-white p-[3%]"
        >
          <PalAppIcon className="size-full" />
        </span>
      )}
    </div>
  );
}
