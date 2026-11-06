import { CameraIcon, ChartIcon, GroupedList, LemonIcon, ListRow, QrCodeIcon } from "@/components/kit";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-5 py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-[26px] bg-lemon text-[2.75rem] text-[oklch(0.23_0.03_85)] shadow-float">
          <LemonIcon />
        </span>
        <h1 className="font-display text-hero font-semibold">LemonPal</h1>
        <p className="max-w-sm text-body text-ink-2">From a handwritten price sign to your first PayPal sale.</p>
      </header>

      <GroupedList header="Your stand" footer="Buyers pay with PayPal on their own phone. You never handle card details.">
        <ListRow icon={<CameraIcon />} title="Set up the stand" subtitle="Photograph your price sign" href="/stand/setup" />
        <ListRow
          icon={<QrCodeIcon />}
          iconTone="ink"
          title="Open the register"
          subtitle="Ring up a sale and show the QR code"
          href="/stand/register"
        />
        <ListRow icon={<ChartIcon />} iconTone="leaf" title="Stand recap" subtitle="See what sold" href="/stand/recap" />
      </GroupedList>
    </main>
  );
}
