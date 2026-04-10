import { config } from "@/lib/config";
import { getAllSeries, listAlerts } from "@/lib/storage";
import type { DashboardPayload, OIPoint, SymbolSeries } from "@/lib/types";

function computeLatestDelta(points: OIPoint[]): number | null {
  if (points.length < 2) {
    return null;
  }

  const prev = points[points.length - 2];
  const latest = points[points.length - 1];
  return latest.openInterest - prev.openInterest;
}

export async function getDashboardData(): Promise<DashboardPayload> {
  const allSeries = await getAllSeries(config.symbols);
  const alerts = await listAlerts(50);

  const series: SymbolSeries[] = config.symbols.map((symbol) => {
    const points = (allSeries[symbol] || []).sort((a, b) => a.timestamp - b.timestamp);

    return {
      symbol,
      points,
      latestDelta: computeLatestDelta(points)
    };
  });

  return {
    updatedAt: Date.now(),
    series,
    alerts
  };
}
