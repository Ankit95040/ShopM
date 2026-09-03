"use server";

import { redirect } from "next/navigation";
import {
  authenticateWithPassword,
  createSession,
  destroySession,
  requireAuth,
} from "@/server/auth";
import { db } from "@/server/db";

export interface LoginActionState {
  error?: string;
}

export async function loginAction(
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

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

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

export async function getAccountDetailsAction(): Promise<AccountDetails | null> {
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
