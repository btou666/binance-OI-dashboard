import { evaluateAlert, buildAlertEvent } from "@/lib/alerts";
import {
  fetchAllFuturesPrices,
  fetchAllTradableFuturesSymbols,
  getBinanceFapiBase,
  fetchOpenInterestPoint,
  fetchUsdtPerpSymbolsFromTicker
} from "@/lib/binance";
import { config } from "@/lib/config";
import { sendFeishuAlert } from "@/lib/feishu";
import {
  appendSeriesPoint,
  getMonitoredSymbols,
  getLastSentTimestamp,
  pushAlert,
  setAllSymbolSnapshots,
  setLastSentTimestamp,
  setMonitoredSymbols
} from "@/lib/storage";
import type { AlertLevel, SymbolSnapshot } from "@/lib/types";

const HOUR_MS = 60 * 60 * 1000;

interface SymbolCollectResult {
  symbol: string;
  ok: boolean;
  openInterest?: number;
  timestamp?: number;
  latestDelta?: number | null;
  latestPrice?: number | null;
  alertLevel?: AlertLevel;
  error?: string;
}

export interface CollectResult {
  ok: boolean;
  source: "manual" | "cron";
  collectedAt: number;
  targetSymbolCount: number;
  successCount: number;
  failureCount: number;
  firstError?: string;
  symbols: SymbolCollectResult[];
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function resolveTargetSymbols(): Promise<string[]> {
  if (config.mode === "manual") {
    return config.symbols;
  }

  let exchangeInfoError: unknown;
  try {
    return await fetchAllTradableFuturesSymbols();
  } catch (error) {
    exchangeInfoError = error;
  }

  let tickerFallbackError: unknown;
  try {
    return await fetchUsdtPerpSymbolsFromTicker();
  } catch (error) {
    tickerFallbackError = error;
  }

  const stored = await getMonitoredSymbols();
  if (stored.length > 0) {
    return stored;
  }

  throw new Error(
    [
      "Failed to resolve futures symbols from both exchangeInfo and ticker/price. This environment may be region-restricted.",
      `BINANCE_FAPI_BASE=${getBinanceFapiBase()}`,
      `exchangeInfoError=${formatErrorMessage(exchangeInfoError)}`,
      `tickerFallbackError=${formatErrorMessage(tickerFallbackError)}`
    ].join(" | ")
  );
}

export async function collectOpenInterest(source: "manual" | "cron"): Promise<CollectResult> {
  let targetSymbols: string[] = [];
  let priceMap: Record<string, number> = {};

  try {
    targetSymbols = await resolveTargetSymbols();
    await setMonitoredSymbols(targetSymbols);
    priceMap = await fetchAllFuturesPrices();
  } catch (error) {
    return {
      ok: false,
      source,
      collectedAt: Date.now(),
      targetSymbolCount: 0,
      successCount: 0,
      failureCount: 1,
      firstError: formatErrorMessage(error),
      symbols: [
        {
          symbol: "SYSTEM",
          ok: false,
          error: formatErrorMessage(error)
        }
      ]
    };
  }

  const symbols = await mapWithConcurrency(targetSymbols, config.collectConcurrency, async (symbol) => {
    try {
      const point = await fetchOpenInterestPoint(symbol);
      const normalizedPoint = {
        ...point,
        timestamp: Math.floor(point.timestamp / HOUR_MS) * HOUR_MS,
        price: priceMap[symbol] ?? null
      };
      const series = await appendSeriesPoint(symbol, normalizedPoint, config.maxPointsPerSymbol);
      const latest = series[series.length - 1];
      const prev = series[series.length - 2];
      const latestDelta = latest && prev ? latest.openInterest - prev.openInterest : null;

      const evaluation = evaluateAlert(series);
      let alertLevel: AlertLevel | undefined;

      if (evaluation) {
        const alert = buildAlertEvent(evaluation);
        const lastSentTimestamp = await getLastSentTimestamp(alert.symbol, alert.level);

        if (lastSentTimestamp !== alert.endTimestamp) {
          await pushAlert(alert);
          await sendFeishuAlert(alert);
          await setLastSentTimestamp(alert.symbol, alert.level, alert.endTimestamp);
        }

        alertLevel = alert.level;
      }

      return {
        symbol,
        ok: true,
        openInterest: normalizedPoint.openInterest,
        timestamp: normalizedPoint.timestamp,
        latestDelta,
        latestPrice: normalizedPoint.price,
        alertLevel
      };
    } catch (error) {
      return {
        symbol,
        ok: false,
        error: formatErrorMessage(error)
      };
    }
  });

  const snapshots: SymbolSnapshot[] = symbols
    .filter((item) => item.ok)
    .map((item) => ({
      symbol: item.symbol,
      latestOpenInterest: item.openInterest ?? null,
      latestPrice: item.latestPrice ?? null,
      lastUpdated: item.timestamp ?? null,
      latestDelta: item.latestDelta ?? null
    }));
  await setAllSymbolSnapshots(snapshots);
  const successCount = symbols.filter((item) => item.ok).length;
  const failureCount = symbols.length - successCount;
  const firstError = symbols.find((item) => !item.ok)?.error;

  return {
    ok: successCount > 0,
    source,
    collectedAt: Date.now(),
    targetSymbolCount: targetSymbols.length,
    successCount,
    failureCount,
    firstError,
    symbols
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        break;
      }

      results[index] = await mapper(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}
