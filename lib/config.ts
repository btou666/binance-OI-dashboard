const DEFAULT_SYMBOLS = ["BTCUSDT", "ETHUSDT"];

function parseSymbols(raw?: string): string[] {
  if (!raw) {
    return DEFAULT_SYMBOLS;
  }

  const symbols = raw
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  return symbols.length > 0 ? symbols : DEFAULT_SYMBOLS;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

export const config = {
  symbols: parseSymbols(process.env.MONITOR_SYMBOLS),
  maxPointsPerSymbol: parsePositiveInt(process.env.MAX_POINTS_PER_SYMBOL, 500),
  collectApiToken: process.env.COLLECT_API_TOKEN?.trim() || "",
  feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL?.trim() || "",
  cronSecret: process.env.CRON_SECRET?.trim() || ""
};
