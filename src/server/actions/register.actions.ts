"use server";

import { createHash, randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/server/db";
import { createSession } from "@/server/auth";
import { getEmailProvider } from "@/lib/email/provider";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 3;
const SHOP_CODE_MIN = 3;
const SHOP_CODE_MAX = 20;
const SHOP_CODE_REGEX = /^[A-Z0-9-]+$/i;
const LOGIN_ID_MIN = 3;
const LOGIN_ID_MAX = 30;
const LOGIN_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const PASSWORD_MIN = 6;

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

export interface RegisterActionState {
  step: "shop" | "owner" | "otp" | "success";
  error?: string;
  shopCode?: string;
  shopName?: string;
  loginId?: string;
  userName?: string;
  email?: string;
  maskedEmail?: string;
  invitationCode?: string;
}

const INVITATION_CODE_REGEX = /^[A-Z0-9]{6,20}$/i;

export async function registerValidateShopAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const shopName = String(formData.get("shopName") || "").trim();

  if (!shopName || shopName.length < 2) {
    return { step: "shop", shopCode, shopName, error: "Shop name must be at least 2 characters." };
  }

  if (shopName.length > 100) {
    return { step: "shop", shopCode, shopName, error: "Shop name must be 100 characters or fewer." };
  }

  if (!shopCode) {
    return { step: "shop", shopCode, shopName, error: "Shop ID is required." };
  }

  if (shopCode.length < SHOP_CODE_MIN || shopCode.length > SHOP_CODE_MAX) {
    return {
      step: "shop",
      shopCode,
      shopName,
      error: `Shop ID must be ${SHOP_CODE_MIN}-${SHOP_CODE_MAX} characters.`,
    };
  }

  if (!SHOP_CODE_REGEX.test(shopCode)) {
    return {
      step: "shop",
      shopCode,
      shopName,
      error: "Shop ID can only contain letters, numbers, and hyphens.",
    };
  }

  const existing = await db.shop.findFirst({
    where: { shopCode },
    select: { id: true },
  });

  if (existing) {
    return {
      step: "shop",
      shopCode,
      shopName,
      error: "This Shop ID is already taken. Please choose a different one.",
    };
  }

  return { step: "owner", shopCode, shopName };
}

export async function registerValidateJoinAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const invitationCode = String(formData.get("invitationCode") || "").trim().toUpperCase();

  if (!shopCode) {
    return { step: "shop", shopCode, invitationCode, error: "Shop ID is required." };
  }
  if (!invitationCode) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation code is required." };
  }
  if (!INVITATION_CODE_REGEX.test(invitationCode)) {
    return { step: "shop", shopCode, invitationCode, error: "Invalid invitation code format." };
  }

  const shop = await db.shop.findFirst({
    where: { shopCode, isActive: true },
    select: { id: true, name: true, isDemo: true },
  });
  if (!shop) {
    return { step: "shop", shopCode, invitationCode, error: "Shop not found or not active." };
  }
  if (shop.isDemo) {
    return { step: "shop", shopCode, invitationCode, error: "Cannot join a demo shop." };
  }

  const invitation = await db.shopInvitation.findFirst({
    where: { code: invitationCode, isActive: true },
    select: { id: true, shopId: true, expiresAt: true, usedCount: true, maxUses: true, isActive: true, role: true },
  });
  if (!invitation || !invitation.isActive) {
    return { step: "shop", shopCode, invitationCode, error: "Invalid or revoked invitation code." };
  }
  if (invitation.shopId !== shop.id) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation code does not belong to this Shop ID." };
  }
  if (invitation.expiresAt <= new Date()) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation has expired." };
  }
  if (invitation.usedCount >= invitation.maxUses) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation has already been used." };
  }

  return { step: "owner", shopCode, shopName: shop.name, invitationCode };
}

export async function registerCreateOwnerAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const shopName = String(formData.get("shopName") || "").trim();
  const userName = String(formData.get("userName") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!userName || userName.length < 2) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: "Full name must be at least 2 characters.",
    };
  }

  if (!loginId) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: "User ID is required.",
    };
  }

  if (loginId.length < LOGIN_ID_MIN || loginId.length > LOGIN_ID_MAX) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: `User ID must be ${LOGIN_ID_MIN}-${LOGIN_ID_MAX} characters.`,
    };
  }

  if (!LOGIN_ID_REGEX.test(loginId)) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: "User ID can only contain letters, numbers, underscores, and hyphens.",
    };
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: "Please enter a valid email address.",
    };
  }

  if (!password || password.length < PASSWORD_MIN) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: `Password must be at least ${PASSWORD_MIN} characters.`,
    };
  }

  if (password !== confirmPassword) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: "Passwords do not match.",
    };
  }

  // Check for duplicate email (global) — distinguish active vs pending
  const existingUser = await db.user.findFirst({
    where: { email },
    select: { id: true, isActive: true, emailVerified: true },
  });

  if (existingUser) {
    const isPending = !existingUser.isActive && !existingUser.emailVerified;
    if (!isPending) {
      return {
        step: "owner",
        shopCode,
        shopName,
        userName,
        loginId,
        email,
        error: "This email is already registered. Please use a different email.",
      };
    }
    // Pending abandoned registration — clean up so it can be retried.
    // Safe to delete: isActive=false, emailVerified=null, no verified data.
    const pendingMembers = await db.shopMember.findMany({
      where: { userId: existingUser.id },
      select: { shopId: true },
    });
    const pendingShopIds = pendingMembers.map((m) => m.shopId);
    await db.$transaction(async (tx) => {
      if (pendingShopIds.length) {
        await tx.shop.deleteMany({ where: { id: { in: pendingShopIds } } });
      }
      await tx.user.delete({ where: { id: existingUser.id } });
    });
  }

  // Re-verify shop code uniqueness (race condition protection)
  const existingShop = await db.shop.findFirst({
    where: { shopCode },
    select: { id: true },
  });

  if (existingShop) {
    return {
      step: "shop",
      shopCode,
      shopName,
      error: "This Shop ID was just taken. Please choose a different one.",
    };
  }

  // Atomic creation: Shop + User + ShopMember
  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.$transaction(async (tx) => {
    const shop = await tx.shop.create({
      data: {
        shopCode,
        name: shopName,
        isActive: false,
      },
    });

    const user = await tx.user.create({
      data: {
        name: userName,
        email,
        passwordHash,
        isActive: false,
      },
    });

    const member = await tx.shopMember.create({
      data: {
        shopId: shop.id,
        userId: user.id,
        loginId,
        role: "OWNER",
      },
    });

    return { shop, user, member };
  });

  // Generate and store OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  // Invalidate any existing unused registration OTPs for this email
  await db.otpToken.updateMany({
    where: {
      userId: result.user.id,
      purpose: "registration",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  await db.otpToken.create({
    data: {
      userId: result.user.id,
      email,
      otpHash,
      purpose: "registration",
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });

  // Send verification email
  const emailProvider = getEmailProvider();
  const sendResult = await emailProvider.sendOtpEmail({
    to: email,
    otp,
    userName,
  });

  if (!sendResult.success) {
    return {
      step: "owner",
      shopCode,
      shopName,
      userName,
      loginId,
      email,
      error: sendResult.error || "Failed to send verification email. Please try again.",
    };
  }

  return {
    step: "otp",
    shopCode,
    shopName,
    loginId,
    userName,
    email,
    maskedEmail: maskEmail(email),
  };
}

export async function registerCreateJoinMemberAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const invitationCode = String(formData.get("invitationCode") || "").trim().toUpperCase();
  const shopName = String(formData.get("shopName") || "").trim();
  const userName = String(formData.get("userName") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (!shopCode || !invitationCode) {
    return { step: "shop", shopCode, invitationCode, error: "Shop ID and invitation code are required." };
  }

  if (!userName || userName.length < 2) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: "Full name must be at least 2 characters." };
  }
  if (!loginId) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: "User ID is required." };
  }
  if (loginId.length < LOGIN_ID_MIN || loginId.length > LOGIN_ID_MAX) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: `User ID must be ${LOGIN_ID_MIN}-${LOGIN_ID_MAX} characters.` };
  }
  if (!LOGIN_ID_REGEX.test(loginId)) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: "User ID can only contain letters, numbers, underscores, and hyphens." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: "Please enter a valid email address." };
  }
  if (!password || password.length < PASSWORD_MIN) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: `Password must be at least ${PASSWORD_MIN} characters.` };
  }
  if (password !== confirmPassword) {
    return { step: "owner", shopCode, shopName, invitationCode, userName, loginId, email, error: "Passwords do not match." };
  }

  // Verify shop and invitation again
  const shop = await db.shop.findFirst({ where: { shopCode, isActive: true }, select: { id: true, name: true, isDemo: true } });
  if (!shop) {
    return { step: "shop", shopCode, invitationCode, error: "Shop not found or not active." };
  }
  if (shop.isDemo) {
    return { step: "shop", shopCode, invitationCode, error: "Cannot join a demo shop." };
  }
  const invitation = await db.shopInvitation.findFirst({
    where: { code: invitationCode },
    select: { id: true, shopId: true, expiresAt: true, usedCount: true, maxUses: true, isActive: true, role: true },
  });
  if (!invitation || !invitation.isActive) {
    return { step: "shop", shopCode, invitationCode, error: "Invalid or revoked invitation code." };
  }
  if (invitation.shopId !== shop.id) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation does not belong to this Shop ID." };
  }
  if (invitation.expiresAt <= new Date()) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation has expired." };
  }
  if (invitation.usedCount >= invitation.maxUses) {
    return { step: "shop", shopCode, invitationCode, error: "Invitation has already been used." };
  }

  // Check duplicate email (global) — same pending logic as create
  const existingUser = await db.user.findFirst({ where: { email }, select: { id: true, isActive: true, emailVerified: true } });
  if (existingUser) {
    const isPending = !existingUser.isActive && !existingUser.emailVerified;
    if (!isPending) {
      return { step: "owner", shopCode, shopName: shop.name, invitationCode, userName, loginId, email, error: "This email is already registered. Please use a different email." };
    }
    const pendingMembers = await db.shopMember.findMany({ where: { userId: existingUser.id }, select: { shopId: true } });
    const pendingShopIds = pendingMembers.map((m) => m.shopId);
    await db.$transaction(async (tx) => {
      if (pendingShopIds.length) {
        await tx.shop.deleteMany({ where: { id: { in: pendingShopIds } } });
      }
      await tx.user.delete({ where: { id: existingUser.id } });
    });
  }

  // Check duplicate loginId within this shop
  const existingLogin = await db.shopMember.findFirst({ where: { shopId: shop.id, loginId }, select: { id: true } });
  if (existingLogin) {
    return { step: "owner", shopCode, shopName: shop.name, invitationCode, userName, loginId, email, error: "This User ID is already taken in this shop. Choose another." };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: userName, email, passwordHash, isActive: false },
    });
    const member = await tx.shopMember.create({
      data: { shopId: shop.id, userId: user.id, loginId, role: invitation.role },
    });
    return { user, member, shop };
  });

  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await db.otpToken.updateMany({
    where: { userId: result.user.id, purpose: "registration", usedAt: null },
    data: { usedAt: new Date() },
  });
  await db.otpToken.create({
    data: { userId: result.user.id, email, otpHash, purpose: "registration", expiresAt, maxAttempts: OTP_MAX_ATTEMPTS },
  });

  const emailProvider = getEmailProvider();
  const sendResult = await emailProvider.sendOtpEmail({ to: email, otp, userName });
  if (!sendResult.success) {
    return {
      step: "owner",
      shopCode,
      shopName: shop.name,
      invitationCode,
      userName,
      loginId,
      email,
      error: sendResult.error || "Failed to send verification email. Please try again.",
    };
  }

  return {
    step: "otp",
    shopCode,
    shopName: shop.name,
    invitationCode,
    loginId,
    userName,
    email,
    maskedEmail: maskEmail(email),
  };
}

export async function verifyRegistrationOtpAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const otp = String(formData.get("otp") || "").trim();
  const invitationCode = String(formData.get("invitationCode") || "").trim().toUpperCase();

  if (!otp || otp.length !== OTP_LENGTH) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: `Please enter a ${OTP_LENGTH}-digit verification code.`,
    };
  }

  // Find the user by email
  const user = await db.user.findFirst({
    where: { email },
    select: { id: true },
  });

  if (!user) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: "Account not found. Please start over.",
    };
  }

  // Find the latest valid registration OTP
  const otpRecord = await db.otpToken.findFirst({
    where: {
      userId: user.id,
      email,
      purpose: "registration",
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
      invitationCode: invitationCode || undefined,
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
      invitationCode: invitationCode || undefined,
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
      invitationCode: invitationCode || undefined,
      error: `Incorrect code. ${otpRecord.maxAttempts - otpRecord.attempts - 1} attempts remaining.`,
    };
  }

  // Mark OTP as used
  await db.otpToken.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  });

  // Activate User + Shop, set emailVerified
  const member = await db.shopMember.findFirst({
    where: {
      loginId,
      user: { email },
      shop: { shopCode },
    },
    select: { id: true, shopId: true, userId: true },
  });

  if (!member) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: "Account not found. Please start over.",
    };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: member.userId },
      data: {
        isActive: true,
        emailVerified: new Date(),
      },
    });

    await tx.shop.update({
      where: { id: member.shopId },
      data: { isActive: true },
    });

    if (invitationCode) {
      const inv = await tx.shopInvitation.findFirst({
        where: { code: invitationCode, shopId: member.shopId },
        select: { id: true, usedCount: true, maxUses: true },
      });
      if (inv && inv.usedCount < inv.maxUses) {
        await tx.shopInvitation.update({
          where: { id: inv.id },
          data: { usedCount: { increment: 1 } },
        });
        if (inv.usedCount + 1 >= inv.maxUses) {
          await tx.shopInvitation.update({
            where: { id: inv.id },
            data: { isActive: false },
          });
        }
      }
    }
  });

  // Create authenticated session
  await createSession({
    userId: member.userId,
    shopId: member.shopId,
    shopMemberId: member.id,
  });

  return { step: "success" };
}

export async function resendRegistrationOtpAction(
  _state: RegisterActionState,
  formData: FormData
): Promise<RegisterActionState> {
  const shopCode = String(formData.get("shopCode") || "").trim();
  const loginId = String(formData.get("loginId") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const invitationCode = String(formData.get("invitationCode") || "").trim().toUpperCase();

  if (!email) {
    return {
      step: "otp",
      shopCode,
      loginId,
      invitationCode: invitationCode || undefined,
      error: "Email is required.",
    };
  }

  const user = await db.user.findFirst({
    where: { email },
    select: { id: true, name: true },
  });

  if (!user) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: "Account not found. Please start over.",
    };
  }

  // Rate limit check
  const recentOtps = await db.otpToken.findMany({
    where: {
      userId: user.id,
      purpose: "registration",
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });

  if (recentOtps.length >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: "Too many requests. Please wait a minute before trying again.",
    };
  }

  // Invalidate existing unused registration OTPs
  await db.otpToken.updateMany({
    where: {
      userId: user.id,
      purpose: "registration",
      usedAt: null,
    },
    data: { usedAt: new Date() },
  });

  // Generate new OTP
  const otp = generateOtp();
  const otpHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60_000);

  await db.otpToken.create({
    data: {
      userId: user.id,
      email,
      otpHash,
      purpose: "registration",
      expiresAt,
      maxAttempts: OTP_MAX_ATTEMPTS,
    },
  });

  // Send email
  const emailProvider = getEmailProvider();
  const sendResult = await emailProvider.sendOtpEmail({
    to: email,
    otp,
    userName: user.name,
  });

  if (!sendResult.success) {
    return {
      step: "otp",
      shopCode,
      loginId,
      email,
      maskedEmail: maskEmail(email),
      invitationCode: invitationCode || undefined,
      error: sendResult.error || "Failed to send verification email. Please try again.",
    };
  }

  return {
    step: "otp",
    shopCode,
    loginId,
    email,
    maskedEmail: maskEmail(email),
    invitationCode: invitationCode || undefined,
  };
}
