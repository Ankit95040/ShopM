"use server";

import { redirect } from "next/navigation";
import {
  authenticateWithPassword,
  createSession,
  destroySession,
} from "@/server/auth";

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
