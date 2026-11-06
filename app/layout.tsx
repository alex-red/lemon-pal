import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

// Citrus Glass type: Fraunces for titles. Interface text, prices and mono use the system fonts on Apple devices
// (SF Pro, SF Pro Rounded, SF Mono), per Apple's HIG. Hanken Grotesk is the fallback everywhere else.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["SOFT", "WONK", "opsz"],
});

// Not preloaded: Apple devices render SF Pro and never need it, so the buyer's phone skips the download.
const hanken = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  title: "LemonPal: a lemonade stand for everyone",
  description: "Create a stand for anything and get paid instantly with PayPal.",
  appleWebApp: { capable: true, title: "LemonPal", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffbea" },
    { media: "(prefers-color-scheme: dark)", color: "#17150c" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${hanken.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
