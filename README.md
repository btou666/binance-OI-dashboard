# Binance 合约异常监控（基础版）

这个项目提供：
- 每小时采集币安 USDT 合约持仓量（Open Interest）
- 前端折线图可视化（便于校验）
- 飞书报警（绿色/黄色/红色）
- Vercel Cron 定时任务

## 报警规则
- 绿色：连续 6 小时单方向（向上）增量持仓量增加
- 黄色：连续 12 小时单方向（向上）增量持仓量增加
- 红色：连续 12 小时单方向（向上）增量持仓量增加，且最新 OI 超过 12 小时窗口起点 OI 的 5 倍

## 快速开始
1. 安装依赖
   ```bash
   npm install
   ```
2. 配置环境变量
   ```bash
   cp .env.example .env.local
   ```
3. 本地运行
   ```bash
   npm run dev
   ```
4. 访问 `http://localhost:3000`

## Vercel 部署要点
1. 在 Vercel 项目中配置环境变量（至少 `MONITOR_SYMBOLS`，建议配置 KV 与 `FEISHU_WEBHOOK_URL`）
2. `vercel.json` 中已配置每小时调用 `/api/cron/collect`
3. 首次部署后可手动调用 `/api/collect` 初始化数据
4. 如果设置了 `CRON_SECRET`，Vercel Cron 也需要同步配置同名变量，平台会自动带 `Authorization: Bearer <CRON_SECRET>`

## 环境变量说明
- `MONITOR_SYMBOLS`：监控交易对列表（如 `BTCUSDT,ETHUSDT`）
- `MAX_POINTS_PER_SYMBOL`：每个交易对保留的数据点数量
- `FEISHU_WEBHOOK_URL`：飞书机器人 webhook 地址
- `COLLECT_API_TOKEN`：手动采集接口的访问口令（可选）
- `CRON_SECRET`：Cron 鉴权口令（可选）
- `KV_REST_API_URL` / `KV_REST_API_TOKEN`：Vercel KV 凭证（生产推荐）

## 接口
- `GET /api/series`：读取图表和报警数据
- `POST /api/collect`：手动触发采集（可选 Token 校验）
- `GET /api/cron/collect`：供 Vercel Cron 调用

如果启用了 `COLLECT_API_TOKEN`，手动触发示例：
```bash
curl -X POST "https://你的域名/api/collect?token=你的token"
```
