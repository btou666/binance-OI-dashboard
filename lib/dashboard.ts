import { fetchAllFuturesPrices, fetchAllTradableFuturesSymbols } from "@/lib/binance";
import { config } from "@/lib/config";
import {
  getAllSymbolSnapshots,
  getMonitoredSymbols,
  getSeries,
  listAlerts,
  setMonitoredSymbols
} from "@/lib/storage";
import type { DashboardPayload, SymbolSnapshot } from "@/lib/types";

function sortByOpenInterestDesc(items: SymbolSnapshot[]): SymbolSnapshot[] {
  return [...items].sort((a, b) => {
    const av = a.latestOpenInterest ?? -1;
    const bv = b.latestOpenInterest ?? -1;
    return bv - av;
  });
}

function normalizeNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function resolveDashboardSymbols(): Promise<string[]> {
  if (config.mode === "manual") {
    return config.symbols;
  }

  const stored = await getMonitoredSymbols();
  if (stored.length > 0) {
    return stored;
  }

  try {
    const discovered = await fetchAllTradableFuturesSymbols();
    await setMonitoredSymbols(discovered);
    return discovered;
  } catch {
    return [];
  }
}

export async function getDashboardData(selectedSymbol?: string | null): Promise<DashboardPayload> {
  const symbols = await resolveDashboardSymbols();
  const emptyPriceMap: Record<string, number> = {};
  const [snapshots, realtimePrices, alerts] = await Promise.all([
    getAllSymbolSnapshots(symbols),
    fetchAllFuturesPrices().catch(() => emptyPriceMap),
    listAlerts(50)
  ]);

  const mergedSnapshots = symbols.map((symbol) => {
    const snapshot = snapshots[symbol] || {
      symbol,
      latestOpenInterest: null,
      latestPrice: null,
      lastUpdated: null,
      latestDelta: null
    };

    return {
      ...snapshot,
      latestOpenInterest: normalizeNullableNumber(snapshot.latestOpenInterest),
      latestPrice: realtimePrices[symbol] ?? normalizeNullableNumber(snapshot.latestPrice),
      lastUpdated: normalizeNullableNumber(snapshot.lastUpdated),
      latestDelta: normalizeNullableNumber(snapshot.latestDelta)
    };
  });

  const sortedSymbols = sortByOpenInterestDesc(mergedSnapshots);
  const finalSelectedSymbol =
    selectedSymbol && symbols.includes(selectedSymbol) ? selectedSymbol : (sortedSymbols[0]?.symbol ?? null);
  const chartSeries = finalSelectedSymbol ? await getSeries(finalSelectedSymbol) : [];

  return {
    updatedAt: Date.now(),
    selectedSymbol: finalSelectedSymbol,
    chartSeries,
    symbols: sortedSymbols,
    alerts
  };
}
