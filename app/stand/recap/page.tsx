import { RecapLoader } from "./recap-loader";

export default function RecapPage() {
  return (
    <main className="flex flex-1 flex-col px-4 py-6">
      <h1 className="text-2xl font-bold">Stand recap</h1>
      <div className="mt-4 min-h-[70vh] flex-1">
        <RecapLoader />
      </div>
    </main>
  );
}
