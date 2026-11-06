type ItemTotal = { item: string; units: number; cents: number };

export const receiptTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function receiptRef(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

export function itemLeaders(totals: ItemTotal[]) {
  const leaders = (metric: "units" | "cents") => {
    const max = totals.reduce((value, item) => Math.max(value, item[metric]), -Infinity);
    return totals.filter((item) => item[metric] === max).sort((a, b) => a.item.localeCompare(b.item));
  };

  return { byUnits: leaders("units"), bySales: leaders("cents") };
}
