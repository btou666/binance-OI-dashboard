import type { OIPoint } from "@/lib/types";

const BINANCE_FAPI_BASE = "https://fapi.binance.com";

interface BinanceOpenInterestResponse {
  symbol: string;
  openInterest: string;
  time: number;
}

interface BinanceExchangeInfoResponse {
  symbols: Array<{
    symbol: string;
    status: string;
    contractType: string;
    quoteAsset: string;
  }>;
}

interface BinanceTickerPriceResponseItem {
  symbol: string;
  price: string;
}

function normalizeUsdtPerpSymbols(rawSymbols: string[]): string[] {
  return [...new Set(rawSymbols)]
    .filter((symbol) => symbol.endsWith("USDT") && !symbol.includes("_"))
    .sort((a, b) => a.localeCompare(b));
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
    openInterest,
    price: null
  };
}

export async function fetchAllTradableFuturesSymbols(): Promise<string[]> {
  const url = `${BINANCE_FAPI_BASE}/fapi/v1/exchangeInfo`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Binance exchangeInfo error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as BinanceExchangeInfoResponse;
  const symbols = payload.symbols
    .filter((item) => {
      return item.status === "TRADING" && item.contractType === "PERPETUAL" && item.quoteAsset === "USDT";
    })
    .map((item) => item.symbol)
    .sort((a, b) => a.localeCompare(b));

  if (symbols.length === 0) {
    throw new Error("No tradable USDT perpetual futures symbols returned by Binance");
  }

  return symbols;
}

export async function fetchAllFuturesPrices(): Promise<Record<string, number>> {
  const url = `${BINANCE_FAPI_BASE}/fapi/v1/ticker/price`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Binance ticker price error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as BinanceTickerPriceResponseItem[];
  const map: Record<string, number> = {};
  for (const item of payload) {
    const price = Number(item.price);
    if (Number.isFinite(price)) {
      map[item.symbol] = price;
    }
  }

  return map;
}

export async function fetchUsdtPerpSymbolsFromTicker(): Promise<string[]> {
  const url = `${BINANCE_FAPI_BASE}/fapi/v1/ticker/price`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Binance ticker price error: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as BinanceTickerPriceResponseItem[];
  const symbols = normalizeUsdtPerpSymbols(payload.map((item) => item.symbol));

  if (symbols.length === 0) {
    throw new Error("No USDT perpetual symbols found from ticker/price fallback");
  }

  return symbols;
}
