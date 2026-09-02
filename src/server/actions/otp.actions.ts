"use server";

import { createHash, randomInt } from "crypto";
import { db } from "@/server/db";
import { getEmailProvider } from "@/lib/email/provider";
import bcrypt from "bcryptjs";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(100_000, 999_999));
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${"*".repeat(Math.min(local.length - 2, 5))}${local[local.length - 1]}@${domain}`;
}

export interface OtpActionState {
  step: "shop" | "loginId" | "email" | "otp" | "password" | "success";
  error?: string;
  email?: string;
  maskedEmail?: string;
  shopCode?: string;
  loginId?: string;
}

export async function forgotPasswordStep1(
  _state: OtpActionState,
  formData: FormData
): Promise<OtpActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  if (!shopCode) {
    return { step: "shop", error: "Shop code is required." };
  }

  const shop = await db.shop.findFirst({
    where: { shopCode, isActive: true },
    select: { id: true },
  });

  if (!shop) {
    return { step: "shop", error: "Shop not found. Please check your Shop ID." };
  }

  return { step: "loginId", shopCode };
}

export async function forgotPasswordStep2(
  _state: OtpActionState,
  formData: FormData
): Promise<OtpActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();

  if (!loginId) {
    return { step: "loginId", shopCode, error: "Login ID is required." };
  }

  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      isActive: true,
      shop: { shopCode, isActive: true },
      user: { isActive: true },
    },
    include: { user: { select: { email: true } } },
  });

  if (!member) {
    return { step: "loginId", shopCode, error: "Login ID not found in this shop." };
  }

  if (!member.user.email) {
    return {
      step: "loginId",
      shopCode,
      error: "No email address registered for this account. Please contact support.",
    };
  }

  const maskedEmail = maskEmail(member.user.email);
  return { step: "email", shopCode, loginId, email: member.user.email, maskedEmail };
}

export async function sendOtpAction(
  _state: OtpActionState,
  formData: FormData
): Promise<OtpActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();

  if (!shopCode || !loginId || !email) {
    return { step: "email", shopCode, loginId, error: "Missing required information." };
  }

  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      isActive: true,
      shop: { shopCode, isActive: true },
      user: { isActive: true, email },
    },
    select: { userId: true, user: { select: { email: true, name: true } } },
  });

  if (!member) {
    return { step: "email", shopCode, loginId, error: "Verification failed. Please try again." };
  }

  // Rate limit: check recent OTP requests
  const recentOtps = await db.otpToken.findMany({
    where: {
      userId: member.userId,
      purpose: "forgot-password",
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentOtps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      step: "email",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: "Too many requests. Please wait a minute before trying again.",
    };
  }

  // Invalidate any existing unused OTPs for this user
  await db.otpToken.updateMany({
    where: {
      userId: member.userId,
      purpose: "forgot-password",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  // Generate and store OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await db.otpToken.create({
    data: {
      userId: member.userId,
      email,
      otpHash,
      purpose: "forgot-password",
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });

  // Send email
  const emailProvider = getEmailProvider();
  const sendResult = await emailProvider.sendOtpEmail({
    to: email,
    otp,
    userName: member.user.name || "User",
  });

  if (!sendResult.success) {
    return {
      step: "email",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: sendResult.error || "Failed to send OTP. Please try again.",
    };
  }

  return {
    step: "otp",
    shopCode,
    loginId,
    email,
    maskedEmail: maskEmail(email),
  };
}

export async function verifyOtpAction(
  _state: OtpActionState,
  formData: FormData
): Promise<OtpActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const otp = String(formData.get("otp") || "").trim();

  if (!otp || otp.length !== OTP_LENGTH) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: `Please enter a ${OTP_LENGTH}-digit verification code.`,
    };
  }

  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      isActive: true,
      shop: { shopCode, isActive: true },
      user: { isActive: true, email },
    },
    select: { userId: true },
  });

  if (!member) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: "Verification failed. Please start over.",
    };
  }

  // Find the latest valid OTP
  const otpRecord = await db.otpToken.findFirst({
    where: {
      userId: member.userId,
      email,
      purpose: "forgot-password",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: "OTP has expired or was not found. Please request a new one.",
    };
  }

  // Check attempts
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    await db.otpToken.update({
      where: { id: otpRecord.id },
      data: { usedAt: new Date() },
    });
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: "Too many failed attempts. Please request a new OTP.",
    };
  }

  // Verify OTP
  const inputHash = hashOtp(otp);
  if (inputHash !== otpRecord.otpHash) {
    await db.otpToken.update({
      where: { id: otpRecord.id },
      data: { attempts: { increment: 1 } },
    });
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      error: `Incorrect code. ${otpRecord.maxAttempts - otpRecord.attempts - 1} attempts remaining.`,
    };
  }

  // Mark OTP as used
  await db.otpToken.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

  return { step: "password", shopCode, loginId, email };
}

export async function resetPasswordAction(
  _state: OtpActionState,
  formData: FormData
): Promise<OtpActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!newPassword || newPassword.length < 6) {
    return {
      step: "password",
      shopCode,
      loginId,
      email,
      error: "Password must be at least 6 characters.",
    };
  }

  if (newPassword !== confirmPassword) {
    return {
      step: "password",
      shopCode,
      loginId,
      email,
      error: "Passwords do not match.",
    };
  }

  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      isActive: true,
      shop: { shopCode, isActive: true },
      user: { isActive: true, email },
    },
    select: { userId: true },
  });

  if (!member) {
    return {
      step: "password",
      shopCode,
      loginId,
      email,
      error: "Verification failed. Please start over.",
    };
  }

  // Verify a valid OTP was used (check for recently used OTP)
  const recentUsedOtp = await db.otpToken.findFirst({
    where: {
      userId: member.userId,
      email,
      purpose: "forgot-password",
      usedAt: { not: null },
      createdAt: { gte: new Date(Date.now() - OTP_EXPIRY_MINUTES * 60_000) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!recentUsedOtp) {
    return {
      step: "password",
      shopCode,
      loginId,
      email,
      error: "OTP verification expired. Please start over.",
    };
  }

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // Update password and invalidate all sessions
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: member.userId },
      data: { passwordHash },
    });

    // Invalidate all existing sessions for this user
    await tx.authSession.deleteMany({
      where: { userId: member.userId },
    });

    // Invalidate all remaining OTPs for this user
    await tx.otpToken.updateMany({
      where: {
        userId: member.userId,
        purpose: "forgot-password",
        usedAt: null,
      },
      data: { usedAt: new Date() },
    });
  });

  // Audit log (without sensitive data)
  const shopMember = await db.shopMember.findFirst({
    where: { userId: member.userId, shop: { shopCode } },
    select: { id: true, shopId: true },
  });

  if (shopMember) {
    await db.auditLog.create({
      data: {
        shopId: shopMember.shopId,
        userId: member.userId,
        action: "UPDATE",
        entityType: "USER",
        entityId: member.userId,
        changeReason: "Password reset via OTP",
      },
    });
  }

  return { step: "success" };
}
