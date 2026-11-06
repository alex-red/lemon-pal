export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-bold">Set up the stand</h1>
      <p className="mt-2 opacity-80">
        Photograph your price sign. LemonPal reads the names and prices, and you confirm them before they
        become item tiles.
      </p>
      {/* TODO: photo capture → POST /api/stand/sign → editable DraftItem list → publish */}
      <p className="mt-8 rounded-xl border border-dashed p-6 opacity-60">Sign reading is coming next.</p>
    </main>
  );
}
