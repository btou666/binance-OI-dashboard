import { NextRequest, NextResponse } from "next/server";

import { collectOpenInterest } from "@/lib/collector";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["hkg1"];

function authorizedForCron(request: NextRequest): boolean {
  if (!config.cronSecret) {
    return true;
  }

  const authHeader = request.headers.get("authorization") || "";
  return authHeader === `Bearer ${config.cronSecret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizedForCron(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized cron call" }, { status: 401 });
  }

  const result = await collectOpenInterest("cron");
  const firstError = result.firstError || result.symbols.find((item) => !item.ok)?.error || "";

  if (firstError.includes("451")) {
    return NextResponse.json(
      {
        ...result,
        error:
          `Binance Futures API returned 451 (region restricted). Please run this function in hkg1/sin1 or another supported region. detail: ${firstError}`
      },
      { status: 451 }
    );
  }

  if (!result.ok) {
    return NextResponse.json(
      {
        ...result,
        error: firstError || "Collect failed: no successful symbol data in this run."
      },
      { status: 207 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
