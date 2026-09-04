"use server";

import { withPerformance } from "@/lib/performance";
import { redirect } from "next/navigation";
import {
  authenticateWithPassword,
  createSession,
  destroySession,
  getCurrentSession,
  getEffectiveSession,
  requireAuth,
} from "@/server/auth";
import { db } from "@/server/db";
import { cookies } from "next/headers";

export interface LoginActionState {
  error?: string;
}

async function loginActionImpl(
  _state: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const password = String(formData.get("password") || "");

  if (!shopCode || !loginId || !password) {
    return { error: "Shop ID, User ID, and password are required." };
  }

  const member = await authenticateWithPassword({
    shopCode,
    loginId,
    password,
  });

  if (!member) {
    return { error: "Invalid Shop ID, User ID, or password." };
  }

  await createSession({
    userId: member.userId,
    shopId: member.shopId,
    shopMemberId: member.id,
  });

  redirect("/");
}
export const loginAction = withPerformance("loginAction", "action", loginActionImpl);

async function logoutActionImpl() {
  await destroySession();
  redirect("/login");
}
export const logoutAction = withPerformance("logoutAction", "action", logoutActionImpl);

export interface AccountDetails {
  shopName: string;
  shopCode: string;
  userName: string;
  loginId: string;
  role: string;
  email: string | null;
  phone: string | null;
  isGuest: boolean;
}

async function getAccountDetailsActionImpl(): Promise<AccountDetails | null> {
  const session = await requireAuth();
  if (!session) return null;

  const shop = await db.shop.findUnique({
    where: { id: session.shopId },
    select: { name: true, shopCode: true },
  });
  if (!shop) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) return null;

  return {
    shopName: shop.name,
    shopCode: shop.shopCode,
    userName: user.name,
    loginId: session.loginId,
    role: session.role,
    email: user.email,
    phone: user.phone,
    isGuest: session.isGuest ?? false,
  };
}
export const getAccountDetailsAction = withPerformance("getAccountDetailsAction", "action", getAccountDetailsActionImpl);

async function deleteMyAccountActionImpl(): Promise<{ success: boolean; error?: string }> {
  // Always resolve from server-side session — never trust client userId
  const session = await getCurrentSession();
  if (!session) {
    // Fall back to effective session to detect guest
    const effective = await getEffectiveSession();
    if (effective?.isGuest) {
      return { success: false, error: "Guest accounts cannot delete a user account. Please register or log in." };
    }
    return { success: false, error: "Not authenticated." };
  }

  // Guest sessions must never be able to delete a real user account
  const effective = await getEffectiveSession();
  if (effective?.isGuest) {
    return { success: false, error: "Guest accounts cannot delete a user account." };
  }

  const userId = session.userId;
  const shopId = session.shopId;

  // Verify the membership exists and is active
  const membership = await db.shopMember.findFirst({
    where: { shopId, userId, isActive: true },
    select: { id: true, role: true },
  });
  if (!membership) {
    return { success: false, error: "Membership not found or already inactive." };
  }

  // Owner edge case — do NOT delete shop
  if (membership.role === "OWNER") {
    const ownerCount = await db.shopMember.count({
      where: { shopId, role: "OWNER", isActive: true },
    });
    if (ownerCount <= 1) {
      return {
        success: false,
        error:
          "You are the only owner of this shop. Assign another owner before deleting your account to keep the shop accessible to others.",
      };
    }
  }

  // Deactivate ONLY the user account — never the shop or shared data
  // User.isActive = false preserves FK integrity for createdBy/updatedBy/audit logs
  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
      // Deactivate all memberships of this user (user may belong to multiple shops)
      await tx.shopMember.updateMany({
        where: { userId },
        data: { isActive: false },
      });
      // Invalidate all sessions for this user
      await tx.authSession.deleteMany({
        where: { userId },
      });
      // Clean up OTP tokens
      await tx.otpToken.deleteMany({
        where: { userId },
      });
      // Audit log for traceability — optional but fits existing model
      await tx.auditLog.create({
        data: {
          shopId,
          userId,
          action: "DELETE",
          entityType: "USER",
          entityId: userId,
          changeReason: "User deleted own account",
        },
      });
    });
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Failed to delete account." };
  }

  // Clear auth cookie server-side
  try {
    const cookieStore = await cookies();
    cookieStore.delete("shopm_session");
  } catch {
    // ignore
  }

  return { success: true };
}
export const deleteMyAccountAction = withPerformance("deleteMyAccountAction", "action", deleteMyAccountActionImpl);
