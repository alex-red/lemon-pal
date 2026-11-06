import type { SVGProps } from "react";
import { palBody, palLeaf } from "./pal-app-icon";

// A small symbol set drawn on a 24pt grid with a 1.75 stroke and round joins, in the spirit of SF Symbols.
// Icons inherit currentColor and scale with font size (1em), so they align with the text beside them.

type IconProps = SVGProps<SVGSVGElement> & { title?: string };

function Icon({ title, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Icon>
);

export const XmarkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
  </Icon>
);

export const ClockIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Icon>
);

export const StopwatchIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 13.5V10M10 3h4M18.5 6.5l-1.5 1.5" />
  </Icon>
);

export const TagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 12.1V4.75c0-.69.56-1.25 1.25-1.25h7.35c.33 0 .65.13.88.37l7.4 7.4a1.25 1.25 0 0 1 0 1.76l-7.36 7.36a1.25 1.25 0 0 1-1.76 0l-7.4-7.4a1.25 1.25 0 0 1-.36-.88Z" />
    <circle cx="8" cy="8" r="1.4" />
  </Icon>
);

export const ExclamationIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 4.3 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.3l1.4-2h5.6l1.4 2h1.3A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5Z" />
    <circle cx="12" cy="12.5" r="3.5" />
  </Icon>
);

/** A framed picture: a photo from the library rather than a new one. */
export const PhotoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="m4 17.5 4.6-4.4a1.5 1.5 0 0 1 2.1 0l1.8 1.8 2.8-2.8a1.5 1.5 0 0 1 2.1 0l3.1 3" />
  </Icon>
);

/** Lines of text with bullets: a typed or pasted list. */
export const ListIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.5 7h10M9.5 12h10M9.5 17h10" />
    <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
  </Icon>
);

export const QrCodeIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h.01M20 14h.01" />
  </Icon>
);

export const ChartIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 19.5V13M10 19.5V8.5M15 19.5v-5M20 19.5V5" />
  </Icon>
);

export const SparklesIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 3.5 11.6 8a3 3 0 0 0 1.9 1.9L18 11.5l-4.5 1.6a3 3 0 0 0-1.9 1.9L10 19.5l-1.6-4.5a3 3 0 0 0-1.9-1.9L2 11.5l4.5-1.6A3 3 0 0 0 8.4 8Z" />
    <path d="M18.5 3v4M16.5 5h4" />
  </Icon>
);

export const ArrowUturnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 14 4.5 9.5 9 5" />
    <path d="M4.5 9.5h10a5 5 0 0 1 0 10H11" />
  </Icon>
);

export const WalletIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h10A2.5 2.5 0 0 1 19 7.5V9" />
    <rect x="4" y="9" width="16.5" height="10" rx="2.5" />
    <path d="M16.5 14h.01" strokeWidth={2.5} />
  </Icon>
);

export const PersonIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
  </Icon>
);

export const BagIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5.5 8h13l-1 11.1a1.5 1.5 0 0 1-1.5 1.4H8a1.5 1.5 0 0 1-1.5-1.4Z" />
    <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
  </Icon>
);

export const BoxIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3.5 7.5 4v9L12 20.5l-7.5-4v-9Z" />
    <path d="m4.5 7.5 7.5 4 7.5-4M12 11.5v9M8.25 5.5l7.5 4" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 20.5s-6.5-5.6-6.5-10.75a6.5 6.5 0 0 1 13 0C18.5 14.9 12 20.5 12 20.5Z" />
    <circle cx="12" cy="9.75" r="2.25" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
);

/** The flat Lemon Pal mark for in-app use. */
export const LemonIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d={palLeaf} fill="currentColor" stroke="none" />
    <path d={palBody} fill="currentColor" fillRule="evenodd" stroke="none" />
  </Icon>
);
