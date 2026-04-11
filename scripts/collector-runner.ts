import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

import { collectOpenInterest } from "@/lib/collector";

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;

function hasKVConfig(): boolean {
  return Boolean(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
      (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  );
}

function getIntervalMs(): number {
  const value = Number(process.env.COLLECT_INTERVAL_MS);
  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_INTERVAL_MS;
  }
  return Math.floor(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

function summarize(result: Awaited<ReturnType<typeof collectOpenInterest>>): string {
  return JSON.stringify(
    {
      ok: result.ok,
      collectedAt: result.collectedAt,
      targetSymbolCount: result.targetSymbolCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
      firstError: result.firstError || null
    },
    null,
    2
  );
}

async function runOnce(): Promise<number> {
  const result = await collectOpenInterest("cron");
  console.log(`[${nowIso()}] collect result:\n${summarize(result)}`);
  return result.ok ? 0 : 1;
}

async function runLoop(): Promise<void> {
  const intervalMs = getIntervalMs();
  console.log(
    `[${nowIso()}] collector loop started. intervalMs=${intervalMs}, mode=${process.env.MONITOR_SYMBOLS || "ALL"}`
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await runOnce();
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(`[${nowIso()}] collect loop error: ${message}`);
    }

    await sleep(intervalMs);
  }
}

async function main(): Promise<void> {
  if (!hasKVConfig()) {
    console.error(
      "Missing KV_REST_API_URL / KV_REST_API_TOKEN. Server-side collector must write to Vercel KV so dashboard can read OI."
    );
    process.exit(1);
  }

  const mode = (process.argv[2] || "once").trim().toLowerCase();
  if (mode === "loop") {
    await runLoop();
    return;
  }

  const code = await runOnce();
  process.exit(code);
}

void main();
