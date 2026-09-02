import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";

const SESSION_COOKIE = "shopm_session";
const SESSION_TTL_DAYS = 7;

export interface AuthContext {
  userId: string;
  shopId: string;
  shopMemberId: string;
  loginId: string;
  role: string;
  userName: string;
  shopName: string;
  shopCode: string;
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function constantTimeEqual(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function createSession({
  userId,
  shopId,
  shopMemberId,
}: {
  userId: string;
  shopId: string;
  shopMemberId: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.authSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      shopId,
      shopMemberId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await db.authSession.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function authenticateWithPassword({
  shopCode,
  loginId,
  password,
}: {
  shopCode: string;
  loginId: string;
  password: string;
}) {
  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      isActive: true,
      shop: {
        shopCode,
        isActive: true,
      },
      user: {
        isActive: true,
      },
    },
    include: {
      user: true,
      shop: true,
    },
  });

  if (!member) return null;

  const passwordMatches = await bcrypt.compare(password, member.user.passwordHash);
  if (!passwordMatches) return null;

  return member;
}

export const getCurrentSession = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const session = await db.authSession.findUnique({
    where: { tokenHash },
    include: {
      user: true,
      shop: true,
      shopMember: true,
    },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await db.authSession.delete({ where: { id: session.id } }).catch(() => undefined);
    }
    return null;
  }

  if (!constantTimeEqual(session.tokenHash, tokenHash)) return null;
  if (!session.user.isActive || !session.shop.isActive || !session.shopMember.isActive) {
    return null;
  }

  return {
    userId: session.userId,
    shopId: session.shopId,
    shopMemberId: session.shopMemberId,
    loginId: session.shopMember.loginId,
    role: session.shopMember.role,
    userName: session.user.name,
    shopName: session.shop.name,
    shopCode: session.shop.shopCode,
  };
});

export async function requireAuth() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");
  return session;
}
