import { config } from "@/lib/config";
import type { AlertEvent } from "@/lib/types";

const levelTextMap: Record<AlertEvent["level"], string> = {
  green: "绿色警报",
  yellow: "黄色警报",
  red: "红色警报"
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString("zh-CN", {
    hour12: false,
    timeZone: "Asia/Shanghai"
  });
}

function buildText(alert: AlertEvent): string {
  return [
    `【${levelTextMap[alert.level]}】${alert.symbol}`,
    alert.message,
    `窗口：${alert.windowHours}h`,
    `起点：${formatTime(alert.startTimestamp)} | OI=${alert.startOI.toFixed(4)}`,
    `终点：${formatTime(alert.endTimestamp)} | OI=${alert.endOI.toFixed(4)}`,
    `倍数：${alert.ratio.toFixed(2)}x`
  ].join("\n");
}

export async function sendFeishuAlert(alert: AlertEvent): Promise<{ sent: boolean; error?: string }> {
  if (!config.feishuWebhookUrl) {
    return { sent: false, error: "FEISHU_WEBHOOK_URL not configured" };
  }

  const body = {
    msg_type: "text",
    content: {
      text: buildText(alert)
    }
  };

  try {
    const response = await fetch(config.feishuWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      return {
        sent: false,
        error: `Feishu webhook failed: ${response.status} ${response.statusText}`
      };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Unknown feishu send error"
    };
  }
}
