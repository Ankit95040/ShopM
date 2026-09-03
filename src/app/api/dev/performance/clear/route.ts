import { NextResponse } from "next/server";
import { clearPerformanceData } from "@/lib/performance";

export const dynamic = "force-dynamic";

export async function POST() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  clearPerformanceData();
  return NextResponse.json({ success: true });
}
