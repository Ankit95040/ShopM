import { NextResponse } from "next/server";
import {
  getCurrentSession,
  getGuestSession,
  createGuestSessionData,
} from "@/server/auth";

export async function GET() {
  // If already authenticated, redirect to app
  const authSession = await getCurrentSession();
  if (authSession) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  // If guest session already exists, redirect to app
  const existingGuest = await getGuestSession();
  if (existingGuest) {
    return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  }

  // Create guest DB records + set cookie (valid context: Route Handler)
  const { token, expiresAt } = await createGuestSessionData();
  const response = NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
  response.cookies.set("shopm_guest", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });

  return response;
}
