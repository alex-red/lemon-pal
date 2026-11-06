import { useId } from "react";

// Shared 24-unit artwork. The second contour cuts the smile out of the fruit.
export const palBody = "M20.6 9.3c1.3-.1 1.8 1.2.9 2.2l-.8.9c-.4 4.4-4.5 8.1-9.5 8.3-2.5.1-4.6-.7-6.2-2.1l-1.3.2c-1.3.2-1.9-1.1-1.1-2.1l.8-1c.4-4.5 4.3-8.2 9.2-8.5 3-.2 5.4.5 7 2.2l1-.1ZM8.1 14.6a.9.9 0 0 0-.9 1.5c3.5 2.4 7.9 1.1 9.8-2.5a.9.9 0 0 0-1.6-.8c-1.5 2.6-4.8 3.5-7.3 1.8Z";
export const palLeaf = "M13 7.5c.3-3 2.6-4.9 5.9-4.9 1 0 1.7-.1 2.4-.4-.3 3.3-2.3 5-5.4 5.1-1.2 0-2.1 0-2.9.2Z";

// Fixed artwork colors keep the app icons independent of the page's color scheme.
const finishes = {
  default: { top: "#fff399", base: "#f5d533", fruit: "#272215", leaf: "#43842d", opacity: 1 },
  dark: { top: "#615644", base: "#272217", fruit: "#ffe144", leaf: "#79b24c", opacity: 1 },
  "clear-light": { top: "#fffff0", base: "#e4edc9", fruit: "#fffbed", leaf: "#edf3d9", opacity: 0.45 },
  "clear-dark": { top: "#b7c3a2", base: "#192414", fruit: "#f4f3de", leaf: "#d4e0bb", opacity: 0.38 },
  "tinted-light": { top: "#eef4d6", base: "#bfce9d", fruit: "#394c28", leaf: "#4d6338", opacity: 1 },
  "tinted-dark": { top: "#60754c", base: "#2b3a22", fruit: "#e9f0c5", leaf: "#cadba7", opacity: 1 },
} as const;

export function PalAppIcon({
  appearance = "default",
  fullBleed = false,
  className,
}: {
  appearance?: keyof typeof finishes;
  fullBleed?: boolean;
  className?: string;
}) {
  const id = useId();
  const plate = `${id}-plate`;
  const sheen = `${id}-sheen`;
  const edge = `${id}-edge`;
  const { top, base, fruit, leaf, opacity } = finishes[appearance];

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={plate} x2="0" y2="1">
          <stop stopColor={top} />
          <stop offset="0.48" stopColor={base} />
          <stop offset="1" stopColor={base} />
        </linearGradient>
        <radialGradient id={sheen} cx="0.3" cy="0" r="0.8">
          <stop stopColor="#fffdf0" stopOpacity="0.4" />
          <stop offset="1" stopColor="#fffdf0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={edge} x2="0" y2="1">
          <stop stopColor="#fffdf0" stopOpacity="0.85" />
          <stop offset="0.5" stopColor="#fffdf0" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fffdf0" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx={fullBleed ? 0 : 5.5} fill={`url(#${plate})`} opacity={opacity} />
      <rect width="24" height="24" rx={fullBleed ? 0 : 5.5} fill={`url(#${sheen})`} />
      {fullBleed ? null : (
        <rect x="0.22" y="0.22" width="23.56" height="23.56" rx="5.28" fill="none" stroke={`url(#${edge})`} strokeWidth="0.28" />
      )}
      <g transform="translate(1.68 1.88) scale(0.86)">
        <path d={palLeaf} fill={leaf} stroke={`url(#${edge})`} strokeWidth="0.14" strokeLinejoin="round" />
        <path d={palBody} fill={fruit} fillRule="evenodd" stroke={`url(#${edge})`} strokeWidth="0.14" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
