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

import type { AlertEvent, DashboardPayload, OIPoint, SymbolSeries } from "@/lib/types";

const POLL_INTERVAL_MS = 60_000;

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", {
    maximumFractionDigits: 4
  });
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

function mapPointsForChart(points: OIPoint[]) {
  return points.map((point) => ({
    t: new Date(point.timestamp).toLocaleString("zh-CN", {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Shanghai"
    }),
    oi: point.openInterest
  }));
}

function SymbolCard({ item }: { item: SymbolSeries }) {
  const chartData = useMemo(() => mapPointsForChart(item.points), [item.points]);
  const latest = item.points[item.points.length - 1];
  const latestRows = item.points.slice(-6).reverse();

  return (
    <article className="card">
      <div className="card-top">
        <div>
          <p className="symbol">{item.symbol}</p>
          <p className="meta">最新 OI: {latest ? formatNumber(latest.openInterest) : "-"}</p>
        </div>
        <p className="meta">
          最近增量: {item.latestDelta === null ? "-" : formatNumber(item.latestDelta)}
        </p>
      </div>

      {chartData.length > 0 ? (
        <div className="chart-wrap">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 11 }} width={80} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="oi"
                stroke="#0b6ef3"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="empty">暂无数据，请先触发一次采集。</p>
      )}

      <table className="table">
        <thead>
          <tr>
            <th>时间</th>
            <th>OI</th>
          </tr>
        </thead>
        <tbody>
          {latestRows.length === 0 ? (
            <tr>
              <td colSpan={2}>-</td>
            </tr>
          ) : (
            latestRows.map((point) => (
              <tr key={`${item.symbol}-${point.timestamp}`}>
                <td>{formatTime(point.timestamp)}</td>
                <td>{formatNumber(point.openInterest)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </article>
  );
}

export default function Dashboard({ initialData }: { initialData: DashboardPayload }) {
  const [data, setData] = useState<DashboardPayload>(initialData);
  const [loading, setLoading] = useState(false);
  const [runningCollect, setRunningCollect] = useState(false);
  const [tip, setTip] = useState<string>("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setTip("");

    try {
      const response = await fetch("/api/series", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`读取数据失败：${response.status}`);
      }

      const payload = (await response.json()) as DashboardPayload;
      setData(payload);
    } catch (error) {
      setTip(error instanceof Error ? error.message : "读取数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const collectNow = useCallback(async () => {
    setRunningCollect(true);
    setTip("");

    try {
      const response = await fetch("/api/collect", {
        method: "POST"
      });

      const payload = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `触发采集失败：${response.status}`);
      }

      setTip("采集成功，正在刷新数据...");
      await refresh();
    } catch (error) {
      setTip(error instanceof Error ? error.message : "触发采集失败");
    } finally {
      setRunningCollect(false);
    }
  }, [refresh]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <main>
      <section className="header">
        <h1>Binance 合约 OI 异常监控</h1>
        <p>每小时自动采集，时区：Asia/Shanghai</p>
        <p>最后刷新：{formatTime(data.updatedAt)}</p>
        {tip ? <p>{tip}</p> : null}
        <div className="actions">
          <button type="button" onClick={() => void refresh()} disabled={loading}>
            {loading ? "刷新中..." : "刷新数据"}
          </button>
          <button type="button" onClick={() => void collectNow()} disabled={runningCollect}>
            {runningCollect ? "采集中..." : "手动采集一次"}
          </button>
        </div>
      </section>

      <h2 className="section-title">合约持仓量折线图</h2>
      <section className="grid">
        {data.series.map((item) => (
          <SymbolCard key={item.symbol} item={item} />
        ))}
      </section>

      <h2 className="section-title">最近报警记录</h2>
      <section className="card">
        {data.alerts.length === 0 ? (
          <p className="empty">暂无报警记录</p>
        ) : (
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
        )}
      </section>
    </main>
  );
}
