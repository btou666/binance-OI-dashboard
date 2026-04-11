import { NextRequest, NextResponse } from "next/server";

import { collectOpenInterest } from "@/lib/collector";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const preferredRegion = ["hkg1"];

function hasAccess(request: NextRequest): boolean {
  if (!config.collectApiToken) {
    return true;
  }

  const headerToken = request.headers.get("x-collect-token") || "";
  const queryToken = request.nextUrl.searchParams.get("token") || "";
  return headerToken === config.collectApiToken || queryToken === config.collectApiToken;
}

async function runCollect(request: NextRequest) {
  if (!hasAccess(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unauthorized. Please provide x-collect-token or ?token="
      },
      { status: 401 }
    );
  }

  const result = await collectOpenInterest("manual");
  const firstError = result.symbols.find((item) => !item.ok)?.error || "";

  if (firstError.includes("451")) {
    return NextResponse.json(
      {
        ...result,
        error:
          "Binance Futures API returned 451 (region restricted). Please run this function in hkg1/sin1 or another supported region."
      },
      { status: 451 }
    );
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET(request: NextRequest) {
  return runCollect(request);
}

export async function POST(request: NextRequest) {
  return runCollect(request);
}
