import { NextRequest, NextResponse } from "next/server";

import { collectOpenInterest } from "@/lib/collector";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";

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
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}

export async function GET(request: NextRequest) {
  return runCollect(request);
}

export async function POST(request: NextRequest) {
  return runCollect(request);
}
