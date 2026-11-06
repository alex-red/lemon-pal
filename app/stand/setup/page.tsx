import { Setup } from "./setup";

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-3xl font-bold">Set up the stand</h1>
      <p className="mt-2 opacity-80">
        Photograph your price sign. LemonPal reads the names and prices, and you check them before they become
        item tiles.
      </p>
      <Setup />
    </main>
  );
}
