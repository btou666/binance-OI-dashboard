export type AlertLevel = "green" | "yellow" | "red";

export interface OIPoint {
  symbol: string;
  timestamp: number;
  openInterest: number;
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

export interface SymbolSeries {
  symbol: string;
  points: OIPoint[];
  latestDelta: number | null;
}

export interface DashboardPayload {
  updatedAt: number;
  series: SymbolSeries[];
  alerts: AlertEvent[];
}
