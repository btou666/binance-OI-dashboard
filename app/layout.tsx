import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Binance 合约 OI 监控",
  description: "每小时采集币安合约持仓量并进行异常报警"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
