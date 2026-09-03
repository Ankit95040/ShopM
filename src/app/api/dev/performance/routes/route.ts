import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  return NextResponse.json({
    note: "Use /api/dev/performance for action metrics. Use curl timing for route navigation times.",
  });
}
