import Link from "next/link";

const links = [
  { href: "/stand/setup", label: "Set up the stand", hint: "Photograph your price sign" },
  { href: "/stand/register", label: "Open the register", hint: "Ring up a sale and show the QR code" },
  { href: "/stand/recap", label: "Stand recap", hint: "See what sold" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header>
        <h1 className="text-4xl font-bold">🍋 LemonPal</h1>
        <p className="mt-2 text-lg opacity-80">From a handwritten price sign to your first PayPal sale.</p>
      </header>
      <nav className="flex flex-col gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border-2 border-lemon-deep bg-lemon/40 px-5 py-4 hover:bg-lemon"
          >
            <span className="block text-xl font-semibold">{link.label}</span>
            <span className="block opacity-70">{link.hint}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}
