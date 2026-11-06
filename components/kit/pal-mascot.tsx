import { cn } from "./cn";

// The face is always dark, like any text on lemon, because the fruit stays bright in dark mode too.
const FACE = "oklch(0.23 0.03 85)";

/**
 * Pal, the smiling lemon. Decorative: pair it with words that carry the meaning.
 * Colors come from the lemon and leaf tokens, so it follows light, dark and Increase Contrast.
 */
export function PalMascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className={cn("overflow-visible", className)}>
      <g transform="rotate(-10 60 64)">
        <path
          d="M74 31c2-11 11-18 24-18-1 12-10 19-24 18Z"
          fill="var(--leaf)"
          stroke="var(--leaf)"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M70 32c1-4 3-7 6-9" fill="none" stroke="var(--leaf)" strokeWidth="2.5" strokeLinecap="round" />
        <path
          d="M10 66c2-4 5-6 9-8 6-19 24-30 42-30 21 0 37 12 42 28 4 2 7 5 8 8-1 3-4 5-8 7-5 17-22 27-42 27S24 88 19 74c-4-2-7-4-9-8Z"
          fill="var(--lemon)"
          stroke="var(--lemon-deep)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <ellipse cx="42" cy="42" rx="13" ry="6" fill="white" opacity="0.45" transform="rotate(-24 42 42)" />
        <ellipse cx="36" cy="70" rx="6" ry="3.5" fill="oklch(0.72 0.15 22)" opacity="0.4" />
        <ellipse cx="86" cy="70" rx="6" ry="3.5" fill="oklch(0.72 0.15 22)" opacity="0.4" />
        <g fill="none" stroke={FACE} strokeWidth="4.5" strokeLinecap="round">
          <path d="M40 60q5-7 10 0" />
          <path d="M70 60q5-7 10 0" />
        </g>
        <path d="M49 69q11 15 22 0Z" fill={FACE} stroke={FACE} strokeWidth="3" strokeLinejoin="round" />
        <path d="M54 76q6 4 12 0q-6-4-12 0Z" fill="oklch(0.68 0.16 22)" />
      </g>
    </svg>
  );
}
