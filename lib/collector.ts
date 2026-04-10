import { evaluateAlert, buildAlertEvent } from "@/lib/alerts";
import { fetchOpenInterestPoint } from "@/lib/binance";
import { config } from "@/lib/config";
import { sendFeishuAlert } from "@/lib/feishu";
import {
  appendSeriesPoint,
  getLastSentTimestamp,
  pushAlert,
  setLastSentTimestamp
} from "@/lib/storage";
import type { AlertLevel } from "@/lib/types";

const HOUR_MS = 60 * 60 * 1000;

interface SymbolCollectResult {
  symbol: string;
  ok: boolean;
  openInterest?: number;
  timestamp?: number;
  alertLevel?: AlertLevel;
  error?: string;
}

export interface CollectResult {
  ok: boolean;
  source: "manual" | "cron";
  collectedAt: number;
  symbols: SymbolCollectResult[];
}

export async function collectOpenInterest(source: "manual" | "cron"): Promise<CollectResult> {
  const tasks = config.symbols.map(async (symbol): Promise<SymbolCollectResult> => {
    try {
      const point = await fetchOpenInterestPoint(symbol);
      const normalizedPoint = {
        ...point,
        timestamp: Math.floor(point.timestamp / HOUR_MS) * HOUR_MS
      };
      const series = await appendSeriesPoint(symbol, normalizedPoint, config.maxPointsPerSymbol);

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
        alertLevel
      };
    } catch (error) {
      return {
        symbol,
        ok: false,
        error: error instanceof Error ? error.message : "Unknown collect error"
      };
    }
  });

  const symbols = await Promise.all(tasks);

  return {
    ok: symbols.every((item) => item.ok),
    source,
    collectedAt: Date.now(),
    symbols
  };
}
