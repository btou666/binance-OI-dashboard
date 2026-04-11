export type AlertLevel = "green" | "yellow" | "red";

export interface OIPoint {
  symbol: string;
  timestamp: number;
  openInterest: number;
  price: number | null;
}

export interface AlertEvent {
  id: string;
  symbol: string;
  level: AlertLevel;
  message: string;
  triggeredAt: number;
  windowHours: number;
  startTimestamp: number;
  endTimestamp: number;
  startOI: number;
  endOI: number;
  ratio: number;
}

export interface SymbolSnapshot {
  symbol: string;
  latestOpenInterest: number | null;
  latestPrice: number | null;
  lastUpdated: number | null;
  latestDelta: number | null;
}

export interface DashboardPayload {
  updatedAt: number;
  selectedSymbol: string | null;
  chartSeries: OIPoint[];
  symbols: SymbolSnapshot[];
  alerts: AlertEvent[];
}
