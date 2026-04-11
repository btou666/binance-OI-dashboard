type SymbolMode = "all" | "manual";

function parseSymbolsConfig(raw?: string): { mode: SymbolMode; symbols: string[] } {
  const normalized = (raw || "").trim();
  if (!normalized || normalized.toUpperCase() === "ALL") {
    return { mode: "all", symbols: [] };
  }

  const symbols = normalized
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (symbols.length === 0) {
    return { mode: "all", symbols: [] };
  }

  return { mode: "manual", symbols };
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

export const config = {
  ...parseSymbolsConfig(process.env.MONITOR_SYMBOLS),
  maxPointsPerSymbol: parsePositiveInt(process.env.MAX_POINTS_PER_SYMBOL, 500),
  collectConcurrency: parsePositiveInt(process.env.COLLECT_CONCURRENCY, 20),
  collectApiToken: process.env.COLLECT_API_TOKEN?.trim() || "",
  feishuWebhookUrl: process.env.FEISHU_WEBHOOK_URL?.trim() || "",
  cronSecret: process.env.CRON_SECRET?.trim() || ""
};
