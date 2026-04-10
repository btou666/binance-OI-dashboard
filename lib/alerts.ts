import type { AlertEvent, AlertLevel, OIPoint } from "@/lib/types";

interface AlertEvaluation {
  level: AlertLevel;
  windowHours: number;
  startPoint: OIPoint;
  endPoint: OIPoint;
  ratio: number;
  message: string;
}

const HOUR_MS = 60 * 60 * 1000;

function hasPositiveDeltas(points: OIPoint[], hours: number): { ok: boolean; start: OIPoint; end: OIPoint } | null {
  const needed = hours + 1;
  if (points.length < needed) {
    return null;
  }

  const window = points.slice(-needed);
  for (let i = 1; i < window.length; i += 1) {
    const gap = window[i].timestamp - window[i - 1].timestamp;
    if (gap !== HOUR_MS) {
      return null;
    }

    const delta = window[i].openInterest - window[i - 1].openInterest;
    if (!(delta > 0)) {
      return null;
    }
  }

  return {
    ok: true,
    start: window[0],
    end: window[window.length - 1]
  };
}

export function evaluateAlert(points: OIPoint[]): AlertEvaluation | null {
  if (points.length < 7) {
    return null;
  }

  const sixHour = hasPositiveDeltas(points, 6);
  const twelveHour = hasPositiveDeltas(points, 12);

  if (twelveHour?.ok) {
    const ratio = twelveHour.end.openInterest / twelveHour.start.openInterest;

    if (Number.isFinite(ratio) && ratio >= 5) {
      return {
        level: "red",
        windowHours: 12,
        startPoint: twelveHour.start,
        endPoint: twelveHour.end,
        ratio,
        message: `${twelveHour.end.symbol} 连续12小时OI单方向上升，且最新OI为起点的 ${ratio.toFixed(2)} 倍（>=5）`
      };
    }

    return {
      level: "yellow",
      windowHours: 12,
      startPoint: twelveHour.start,
      endPoint: twelveHour.end,
      ratio,
      message: `${twelveHour.end.symbol} 连续12小时OI单方向上升`
    };
  }

  if (sixHour?.ok) {
    const ratio = sixHour.end.openInterest / sixHour.start.openInterest;

    return {
      level: "green",
      windowHours: 6,
      startPoint: sixHour.start,
      endPoint: sixHour.end,
      ratio,
      message: `${sixHour.end.symbol} 连续6小时OI单方向上升`
    };
  }

  return null;
}

export function buildAlertEvent(evaluation: AlertEvaluation): AlertEvent {
  const id = `${evaluation.endPoint.symbol}-${evaluation.level}-${evaluation.endPoint.timestamp}`;

  return {
    id,
    symbol: evaluation.endPoint.symbol,
    level: evaluation.level,
    message: evaluation.message,
    triggeredAt: evaluation.endPoint.timestamp,
    windowHours: evaluation.windowHours,
    startTimestamp: evaluation.startPoint.timestamp,
    endTimestamp: evaluation.endPoint.timestamp,
    startOI: evaluation.startPoint.openInterest,
    endOI: evaluation.endPoint.openInterest,
    ratio: evaluation.ratio
  };
}
