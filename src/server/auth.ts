import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { getAuthFromContext, setAuthInContext } from "@/server/auth-context";

const SESSION_COOKIE = "shopm_session";
const GUEST_COOKIE = "shopm_guest";
const SESSION_TTL_DAYS = 7;
const GUEST_TTL_DAYS = 1;

export interface AuthContext {
  userId: string;
  shopId: string;
  shopMemberId: string;
  loginId: string;
  role: string;
  userName: string;
  shopName: string;
  shopCode: string;
  isGuest?: boolean;
  isDemo?: boolean;
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

// Guest/demo session helpers — isolated per-browser demo shop
// Creates guest DB records only — does NOT set cookies.
// Use setGuestSessionCookie() separately in a Route Handler or Server Action.
export async function createGuestSessionData(): Promise<{
  token: string;
  expiresAt: Date;
  context: AuthContext;
}> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + GUEST_TTL_DAYS * 24 * 60 * 60 * 1000);
  const shopCode = `DEMO-${randomBytes(3).toString("hex").toUpperCase()}`;
  const shopName = "Guest Shop";
  const guestUserName = "Guest User";
  const guestLoginId = `guest_${randomBytes(4).toString("hex")}`;
  const passwordHash = await bcrypt.hash(randomBytes(16).toString("hex"), 12);

  const shop = await db.shop.create({
    data: {
      shopCode,
      name: shopName,
      isActive: true,
      isDemo: true,
      demoExpiresAt: expiresAt,
    },
  });

  const user = await db.user.create({
    data: {
      name: guestUserName,
      passwordHash,
      isActive: true,
    },
  });

  const member = await db.shopMember.create({
    data: {
      shopId: shop.id,
      userId: user.id,
      loginId: guestLoginId,
      role: "OWNER",
    },
  });

  await db.guestSession.create({
    data: {
      tokenHash: hashSessionToken(token),
      shopId: shop.id,
      expiresAt,
    },
  });

  return {
    token,
    expiresAt,
    context: {
      userId: user.id,
      shopId: shop.id,
      shopMemberId: member.id,
      loginId: member.loginId,
      role: member.role,
      userName: user.name,
      shopName: shop.name,
      shopCode: shop.shopCode,
      isGuest: true,
      isDemo: true,
    },
  };
}

// Sets the guest session cookie. Must be called from a Server Action or Route Handler.
export async function setGuestSessionCookie(
  token: string,
  expiresAt: Date,
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GUEST_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

// Convenience: create DB records + set cookie. Only call from Server Actions or Route Handlers.
export async function createGuestSession(): Promise<AuthContext> {
  const { token, expiresAt, context } = await createGuestSessionData();
  await setGuestSessionCookie(token, expiresAt);
  return context;
}

export const getGuestSession = cache(async (): Promise<AuthContext | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashSessionToken(token);
  const guest = await db.guestSession.findUnique({
    where: { tokenHash },
    include: { shop: true },
  });

  if (!guest || guest.expiresAt <= new Date()) {
    if (guest) {
      await db.guestSession.delete({ where: { id: guest.id } }).catch(() => undefined);
      // Cleanup expired demo shop (cascade deletes members, locations, etc.)
      if (guest.shop.isDemo) {
        await db.shop.delete({ where: { id: guest.shopId } }).catch(() => undefined);
      }
    }
    return null;
  }

  if (!constantTimeEqual(guest.tokenHash, tokenHash)) return null;
  if (!guest.shop.isActive || !guest.shop.isDemo) return null;
  if (guest.shop.demoExpiresAt && guest.shop.demoExpiresAt <= new Date()) {
    await db.guestSession.delete({ where: { id: guest.id } }).catch(() => undefined);
    await db.shop.delete({ where: { id: guest.shopId } }).catch(() => undefined);
    return null;
  }

  // Fetch the demo member/user for this shop (first OWNER member)
  const member = await db.shopMember.findFirst({
    where: { shopId: guest.shopId },
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });
  if (!member || !member.user.isActive) return null;

  return {
    userId: member.userId,
    shopId: guest.shopId,
    shopMemberId: member.id,
    loginId: member.loginId,
    role: member.role,
    userName: member.user.name,
    shopName: guest.shop.name,
    shopCode: guest.shop.shopCode,
    isGuest: true,
    isDemo: true,
  };
});

export async function ensureGuestSession(): Promise<AuthContext> {
  const existing = await getGuestSession();
  if (existing) return existing;
  return createGuestSession();
}

export async function destroyGuestSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(GUEST_COOKIE)?.value;
  if (token) {
    const tokenHash = hashSessionToken(token);
    const guest = await db.guestSession.findUnique({ where: { tokenHash } });
    if (guest) {
      await db.guestSession.delete({ where: { id: guest.id } }).catch(() => undefined);
      const shop = await db.shop.findUnique({ where: { id: guest.shopId } });
      if (shop?.isDemo) {
        await db.shop.delete({ where: { id: guest.shopId } }).catch(() => undefined);
      }
    }
  }
  cookieStore.delete(GUEST_COOKIE);
}

export async function getEffectiveSession(): Promise<AuthContext | null> {
  // Check request-scoped ALS cache first — avoids redundant DB lookups
  const cached = getAuthFromContext();
  if (cached) return cached;

  const auth = await getCurrentSession();
  if (auth) {
    const session = { ...auth, isGuest: false, isDemo: false };
    setAuthInContext(session);
    return session;
  }
  const guest = await getGuestSession();
  if (guest) {
    setAuthInContext(guest);
    return guest;
  }
  return null;
}

export async function requireEffectiveAuth() {
  const session = await getEffectiveSession();
  if (!session) {
    // No auth and no guest — redirect to the Route Handler that creates the guest session.
    // Cannot call cookies().set() from a Server Component, so this must go through a Route Handler.
    redirect("/api/guest/create");
  }
  return session;
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
  const session = await getEffectiveSession();
  if (!session) {
    // No auth and no guest — create a demo guest session on-demand
    return ensureGuestSession();
  }
  return session;
}

export async function requireAuthStrict() {
  // Check ALS cache first — if layout already resolved auth, reuse it
  const cached = getAuthFromContext();
  if (cached && !cached.isGuest) return cached;

  const session = await getCurrentSession();
  if (!session) redirect("/login");
  setAuthInContext(session);
  return session;
}

/**
 * Resolve the session for server actions.
 * Checks ALS cache first (set by layout), then falls back to standard auth resolution.
 * This allows requireAuthBasic() in action files to reuse the layout's auth result.
 */
export async function resolveSession(): Promise<AuthContext> {
  const cached = getAuthFromContext();
  if (cached) return cached;

  const session = await getEffectiveSession();
  if (session) return session;

  // No session found — create a guest session (same as requireAuth behavior)
  return ensureGuestSession();
}
