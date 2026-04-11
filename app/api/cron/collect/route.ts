import { NextRequest, NextResponse } from "next/server";

import { collectOpenInterest } from "@/lib/collector";
import { config } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  return NextResponse.json(result, { status: result.ok ? 200 : 207 });
}
