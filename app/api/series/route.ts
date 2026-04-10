import { NextResponse } from "next/server";

import { getDashboardData } from "@/lib/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getDashboardData();
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Failed to load dashboard data"
      },
      { status: 500 }
    );
  }
}
