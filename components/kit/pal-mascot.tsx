import { cn } from "./cn";

// The face is always dark, like any text on lemon, because the fruit stays bright in dark mode too.
const FACE = "oklch(0.23 0.03 85)";
const BLUSH = "oklch(0.72 0.15 22)";

/**
 * What Pal is doing, shown on its face.
 * - happy: the big grin, for celebrations and a change that landed.
 * - idle: awake and blinking, waiting to be asked.
 * - listening: wide eyes while the seller types.
 * - thinking: eyes up, swaying, while the assistant works.
 * - talking: mouth moving while an answer arrives.
 * - oops: worried brows, when something went wrong.
 */
export type PalMood = "happy" | "idle" | "listening" | "thinking" | "talking" | "oops";

/**
 * Pal, the smiling lemon. Decorative: pair it with words that carry the meaning.
 * Colors come from the lemon and leaf tokens, so it follows light, dark and Increase Contrast.
 * Moods only move the face and a gentle sway, on the motion tokens, so Reduce Motion stills them.
 */
export function PalMascot({ mood = "happy", className }: { mood?: PalMood; className?: string }) {
  const dots = mood !== "happy";
  // Thinking looks up and to the side. Listening opens the eyes a little wider.
  const look = mood === "thinking" ? { x: 3, y: -3 } : { x: 0, y: 0 };
  const eye = mood === "listening" ? { rx: 4.8, ry: 6 } : { rx: 4.2, ry: 5.2 };

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" data-mood={mood} className={cn("overflow-visible", className)}>
      {/* Keyed by mood, so a hop or sway starts fresh each time the mood changes. */}
      <g
        key={mood}
        className={cn(
          "transform-view origin-[60px_108px]",
          mood === "thinking" && "animate-pal-ponder",
          mood === "happy" && "animate-pal-hop",
        )}
      >
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
          <ellipse cx="36" cy="70" rx="6" ry="3.5" fill={BLUSH} opacity={mood === "oops" ? 0.2 : 0.4} />
          <ellipse cx="86" cy="70" rx="6" ry="3.5" fill={BLUSH} opacity={mood === "oops" ? 0.2 : 0.4} />

          {dots ? (
            <g fill={FACE} className={cn("transform-fill origin-center", mood !== "thinking" && "animate-pal-blink")}>
              <ellipse cx={45 + look.x} cy={58 + look.y} {...eye} />
              <ellipse cx={75 + look.x} cy={58 + look.y} {...eye} />
            </g>
          ) : (
            <g fill="none" stroke={FACE} strokeWidth="4.5" strokeLinecap="round">
              <path d="M40 60q5-7 10 0" />
              <path d="M70 60q5-7 10 0" />
            </g>
          )}

          {mood === "oops" ? (
            <g fill="none" stroke={FACE} strokeWidth="3" strokeLinecap="round">
              <path d="M37 51l11-4" />
              <path d="M83 51l-11-4" />
            </g>
          ) : null}

          <Mouth mood={mood} />
        </g>
      </g>
    </svg>
  );
}

function Mouth({ mood }: { mood: PalMood }) {
  if (mood === "happy" || mood === "talking") {
    return (
      <g className={cn("transform-fill origin-top", mood === "talking" && "animate-pal-talk")}>
        <path d="M49 69q11 15 22 0Z" fill={FACE} stroke={FACE} strokeWidth="3" strokeLinejoin="round" />
        <path d="M54 76q6 4 12 0q-6-4-12 0Z" fill="oklch(0.68 0.16 22)" />
      </g>
    );
  }
  if (mood === "thinking") return <ellipse cx="64" cy="72" rx="3.5" ry="3" fill={FACE} />;
  if (mood === "oops") {
    return <path d="M49 74q5-4 11 0t11 0" fill="none" stroke={FACE} strokeWidth="3.5" strokeLinecap="round" />;
  }
  return <path d="M51 70q9 8 18 0" fill="none" stroke={FACE} strokeWidth="3.5" strokeLinecap="round" />;
}
