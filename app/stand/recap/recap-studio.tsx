"use client";

import { AgStudio } from "ag-studio-react";

// TODO: load paid sales and line-item snapshots from the server, add the lemon theme,
// the "Today's sales" widget, and the units-by-item chart.
const data = { sources: [{ id: "sales", data: [] as Record<string, unknown>[] }] };

export function RecapStudio() {
  return (
    <div style={{ height: "100%", width: "100%" }}>
      <AgStudio data={data} mode="edit" />
    </div>
  );
}
