import { NextResponse } from "next/server";
import { getPerformanceSnapshot } from "@/lib/performance";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  const snapshot = getPerformanceSnapshot();
  return NextResponse.json(snapshot);
}
