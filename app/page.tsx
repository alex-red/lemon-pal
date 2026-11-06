import { CameraIcon, ChartIcon, GroupedList, LemonIcon, ListRow, QrCodeIcon } from "@/components/kit";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-8 px-5 py-16">
      <header className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-20 place-items-center rounded-[26px] bg-lemon text-[2.75rem] text-[oklch(0.23_0.03_85)] shadow-float">
          <LemonIcon />
        </span>
        <h1 className="font-display text-hero font-semibold">LemonPal</h1>
        <p className="font-display text-title1 font-semibold text-balance">A lemonade stand for everyone.</p>
        <p className="max-w-sm text-body text-ink-2 text-balance">Create a stand for anything. Get paid instantly.</p>
      </header>

      <GroupedList header="Start selling in a minute" footer="Customers pay with PayPal on their own phone. No card reader, no cash box.">
        <ListRow icon={<CameraIcon />} title="Create your stand" subtitle="Snap your price sign and you’re set up" href="/stand/setup" />
        <ListRow
          icon={<QrCodeIcon />}
          iconTone="ink"
          title="Take a payment"
          subtitle="Tap what they bought, they scan and pay"
          href="/stand/register"
        />
        <ListRow icon={<ChartIcon />} iconTone="leaf" title="See your sales" subtitle="What sold and what you made" href="/stand/recap" />
      </GroupedList>
    </main>
  );
}
