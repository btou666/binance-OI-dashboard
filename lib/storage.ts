import { kv } from "@vercel/kv";

import type { AlertEvent, AlertLevel, OIPoint } from "@/lib/types";

const SERIES_KEY_PREFIX = "oi:series:";
const ALERTS_KEY = "oi:alerts";
const SENT_KEY_PREFIX = "oi:sent:";

const useKV = Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

interface MemoryStore {
  series: Record<string, OIPoint[]>;
  alerts: AlertEvent[];
  sent: Record<string, number>;
}

declare global {
  // eslint-disable-next-line no-var
  var __OI_MONITOR_MEMORY__: MemoryStore | undefined;
}

function getMemoryStore(): MemoryStore {
  if (!globalThis.__OI_MONITOR_MEMORY__) {
    globalThis.__OI_MONITOR_MEMORY__ = {
      series: {},
      alerts: [],
      sent: {}
    };
  }

  return globalThis.__OI_MONITOR_MEMORY__;
}

function getSeriesKey(symbol: string): string {
  return `${SERIES_KEY_PREFIX}${symbol}`;
}

function getSentKey(symbol: string, level: AlertLevel): string {
  return `${SENT_KEY_PREFIX}${symbol}:${level}`;
}

export async function getSeries(symbol: string): Promise<OIPoint[]> {
  if (useKV) {
    const saved = await kv.get<OIPoint[]>(getSeriesKey(symbol));
    return Array.isArray(saved) ? saved : [];
  }

  const store = getMemoryStore();
  return store.series[symbol] || [];
}

export async function appendSeriesPoint(
  symbol: string,
  point: OIPoint,
  maxPoints: number
): Promise<OIPoint[]> {
  const current = await getSeries(symbol);
  const withoutSameTimestamp = current.filter((item) => item.timestamp !== point.timestamp);
  const next = [...withoutSameTimestamp, point]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-maxPoints);

  if (useKV) {
    await kv.set(getSeriesKey(symbol), next);
    return next;
  }

  const store = getMemoryStore();
  store.series[symbol] = next;
  return next;
}

export async function getAllSeries(symbols: string[]): Promise<Record<string, OIPoint[]>> {
  const entries = await Promise.all(
    symbols.map(async (symbol) => {
      const points = await getSeries(symbol);
      return [symbol, points.sort((a, b) => a.timestamp - b.timestamp)] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function listAlerts(limit = 100): Promise<AlertEvent[]> {
  if (useKV) {
    const saved = await kv.get<AlertEvent[]>(ALERTS_KEY);
    const all = Array.isArray(saved) ? saved : [];
    return all.sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, limit);
  }

  const store = getMemoryStore();
  return [...store.alerts].sort((a, b) => b.triggeredAt - a.triggeredAt).slice(0, limit);
}

export async function pushAlert(alert: AlertEvent, maxAlerts = 300): Promise<void> {
  if (useKV) {
    const current = await kv.get<AlertEvent[]>(ALERTS_KEY);
    const all = Array.isArray(current) ? current : [];
    const next = [alert, ...all].slice(0, maxAlerts);
    await kv.set(ALERTS_KEY, next);
    return;
  }

  const store = getMemoryStore();
  store.alerts = [alert, ...store.alerts].slice(0, maxAlerts);
}

export async function getLastSentTimestamp(symbol: string, level: AlertLevel): Promise<number | null> {
  const key = getSentKey(symbol, level);

  if (useKV) {
    const saved = await kv.get<number>(key);
    return typeof saved === "number" ? saved : null;
  }

  const store = getMemoryStore();
  const saved = store.sent[key];
  return typeof saved === "number" ? saved : null;
}

export async function setLastSentTimestamp(
  symbol: string,
  level: AlertLevel,
  timestamp: number
): Promise<void> {
  const key = getSentKey(symbol, level);

  if (useKV) {
    await kv.set(key, timestamp);
    return;
  }

  const store = getMemoryStore();
  store.sent[key] = timestamp;
}
