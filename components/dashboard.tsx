"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { AlertEvent, DashboardPayload, OIPoint } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
}

function formatPrice(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: value >= 100 ? 2 : 6
  });
}

function formatOI(value: number | null): string {
  if (value === null) {
    return "-";
  }

  return value.toLocaleString("en-US", {
    maximumFractionDigits: 2
  });
}

function formatPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatDelta(value: number | null): string {
  if (value === null) {
    return "-";
  }
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function levelLabel(level: AlertEvent["level"]): string {
  if (level === "green") {
    return "绿色";
  }
  if (level === "yellow") {
    return "黄色";
  }
  return "红色";
}

type ChartPoint = {
  timestamp: number;
  time: string;
  openInterest: number;
  price: number | null;
  oiPct: number;
  pricePct: number | null;
};

function mapChartPoints(points: OIPoint[]): ChartPoint[] {
  if (points.length === 0) {
    return [];
  }

  const baseOI = points[0].openInterest;
  const basePrice =
    points
      .map((item) => (typeof item.price === "number" ? item.price : null))
      .find((price) => price !== null) ?? null;

  return points.map((item) => {
    const price = typeof item.price === "number" ? item.price : null;
    const oiPct = baseOI > 0 ? ((item.openInterest - baseOI) / baseOI) * 100 : 0;
    const pricePct =
      basePrice !== null && price !== null && basePrice > 0
        ? ((price - basePrice) / basePrice) * 100
        : null;

    return {
      timestamp: item.timestamp,
      time: new Date(item.timestamp).toLocaleString("zh-CN", {
        hour12: false,
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Shanghai"
      }),
      openInterest: item.openInterest,
      price,
      oiPct,
      pricePct
    };
  });
}

function CustomTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{ payload: ChartPoint }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const row = payload[0].payload;

  return (
    <div className="tooltip-box">
      <p className="tooltip-title">{formatTime(row.timestamp)}</p>
      <p className="tooltip-row">
        <span className="dot dot-yellow" />
        Price: {formatPrice(row.price)} {formatPct(row.pricePct)}
      </p>
      <p className="tooltip-row">
        <span className="dot dot-blue" />
        OI: {formatOI(row.openInterest)} {formatPct(row.oiPct)}
      </p>
    </div>
  );
}

export default function Dashboard({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(initialData.selectedSymbol);
  const [loading, setLoading] = useState(false);
  const [runningCollect, setRunningCollect] = useState(false);
  const [tip, setTip] = useState("");
  const [search, setSearch] = useState("");

  const refresh = useCallback(
    async (symbol?: string | null) => {
      const targetSymbol = symbol ?? selectedSymbol;
      setLoading(true);
      setTip("");

      try {
        const query = targetSymbol ? `?symbol=${encodeURIComponent(targetSymbol)}` : "";
        const response = await fetch(`/api/series${query}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`读取数据失败：${response.status}`);
        }

        const payload = (await response.json()) as DashboardPayload;
        setData(payload);
        setSelectedSymbol(payload.selectedSymbol);
      } catch (error) {
        setTip(error instanceof Error ? error.message : "读取数据失败");
      } finally {
        setLoading(false);
      }
    },
    [selectedSymbol]
  );

  const collectNow = useCallback(async () => {
    setRunningCollect(true);
    setTip("");

    try {
      const response = await fetch("/api/collect", {
        method: "POST"
      });
      const payload = (await response.json()) as { ok: boolean; error?: string; targetSymbolCount?: number };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `触发采集失败：${response.status}`);
      }

      setTip(`采集成功，目标币对数：${payload.targetSymbolCount ?? "-"}`);
      await refresh(selectedSymbol);
    } catch (error) {
      setTip(error instanceof Error ? error.message : "触发采集失败");
    } finally {
      setRunningCollect(false);
    }
  }, [refresh, selectedSymbol]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh(selectedSymbol);
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [refresh, selectedSymbol]);

  const chartData = useMemo(() => mapChartPoints(data.chartSeries), [data.chartSeries]);
  const filteredSymbols = useMemo(() => {
    const keyword = search.trim().toUpperCase();
    if (!keyword) {
      return data.symbols;
    }
    return data.symbols.filter((item) => item.symbol.includes(keyword));
  }, [data.symbols, search]);

  return (
    <main>
      <section className="panel hero">
        <h1>Binance USDT-M Perpetual 全量监控</h1>
        <p>展示时间点、合约持仓量与实时价格，列表按最新 OI 降序排列。</p>
        <p>
          最后刷新：{formatTime(data.updatedAt)} | 当前图表：{data.selectedSymbol ?? "-"} | 币对数：
          {data.symbols.length}
        </p>
        {tip ? <p className="tip">{tip}</p> : null}
        <div className="actions">
          <button type="button" onClick={() => void refresh(selectedSymbol)} disabled={loading}>
            {loading ? "刷新中..." : "刷新数据"}
          </button>
          <button type="button" onClick={() => void collectNow()} disabled={runningCollect}>
            {runningCollect ? "采集中..." : "手动采集一次"}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>{data.selectedSymbol ?? "-"} 价格与持仓变化（相对首点）</h2>
        <p className="sub">
          黄色：Price 变化率 | 蓝色：Open Interest 变化率。Tooltip 同时显示时间、实时价格与持仓量。
        </p>
        {chartData.length > 1 ? (
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3247" />
                <XAxis dataKey="time" tick={{ fill: "#8b95ab", fontSize: 12 }} minTickGap={24} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fill: "#8b95ab", fontSize: 12 }} width={76} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="pricePct"
                  stroke="#f5c542"
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="oiPct"
                  stroke="#61a5ff"
                  strokeWidth={2.4}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="empty">该币对数据点不足，请先等待采集累积。</p>
        )}
      </section>

      <section className="panel">
        <div className="list-header">
          <h2>全量币对实时列表（按 OI 降序）</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索 Symbol，例如 BTCUSDT"
          />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Symbol</th>
                <th>实时价格</th>
                <th>最新 OI</th>
                <th>1h OI 增量</th>
                <th>更新时间</th>
              </tr>
            </thead>
            <tbody>
              {filteredSymbols.map((item, idx) => (
                <tr
                  key={item.symbol}
                  className={item.symbol === selectedSymbol ? "active-row" : ""}
                  onClick={() => {
                    setSelectedSymbol(item.symbol);
                    void refresh(item.symbol);
                  }}
                >
                  <td>{idx + 1}</td>
                  <td>{item.symbol}</td>
                  <td>{formatPrice(item.latestPrice)}</td>
                  <td>{formatOI(item.latestOpenInterest)}</td>
                  <td className={item.latestDelta !== null && item.latestDelta >= 0 ? "up" : "down"}>
                    {formatDelta(item.latestDelta)}
                  </td>
                  <td>{item.lastUpdated ? formatTime(item.lastUpdated) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <h2>最近报警记录</h2>
        {data.alerts.length === 0 ? (
          <p className="empty">暂无报警记录</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>Symbol</th>
                  <th>级别</th>
                  <th>说明</th>
                  <th>倍数</th>
                </tr>
              </thead>
              <tbody>
                {data.alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{formatTime(alert.triggeredAt)}</td>
                    <td>{alert.symbol}</td>
                    <td>
                      <span className={`tag ${alert.level}`}>{levelLabel(alert.level)}</span>
                    </td>
                    <td>{alert.message}</td>
                    <td>{alert.ratio.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
