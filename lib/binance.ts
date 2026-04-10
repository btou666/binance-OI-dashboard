import type { OIPoint } from "@/lib/types";

const BINANCE_FAPI_BASE = "https://fapi.binance.com";

interface BinanceOpenInterestResponse {
  symbol: string;
  openInterest: string;
  time: number;
}

export async function fetchOpenInterestPoint(symbol: string): Promise<OIPoint> {
  const url = `${BINANCE_FAPI_BASE}/fapi/v1/openInterest?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as BinanceOpenInterestResponse;
  const openInterest = Number(payload.openInterest);

  if (!Number.isFinite(openInterest)) {
    throw new Error(`Invalid open interest for ${symbol}`);
  }

  return {
    symbol,
    timestamp: payload.time || Date.now(),
    openInterest
  };
}
