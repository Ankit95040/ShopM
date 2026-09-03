"use server";

import { randomBytes } from "crypto";
import { db } from "@/server/db";
import { requireAuthStrict } from "@/server/auth";
import { UserRole } from "@prisma/client";

const INVITATION_TTL_DAYS = 7;
const CODE_LENGTH_BYTES = 4; // 8 hex chars

function generateCode(): string {
  return randomBytes(CODE_LENGTH_BYTES).toString("hex").toUpperCase();
}

export async function createShopInvitationAction({
  role = "EMPLOYEE",
  maxUses = 1,
}: {
  role?: UserRole;
  maxUses?: number;
}) {
  const session = await requireAuthStrict();
  // Only OWNER/MANAGER can invite
  if (session.role !== "OWNER" && session.role !== "MANAGER") {
    return { success: false, error: "Only owners or managers can invite members." };
  }

  const shopId = session.shopId;
  const code = generateCode();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Ensure code is unique (retry if collision)
  let invitation;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      invitation = await db.shopInvitation.create({
        data: {
          shopId,
          code: attempt === 0 ? code : generateCode(),
          createdById: session.userId,
          role: role as UserRole,
          maxUses,
          expiresAt,
        },
      });
      break;
    } catch (e: unknown) {
      if (e instanceof Error && e.message.includes("Unique constraint")) continue;
      throw e;
    }
  }

  if (!invitation) {
    return { success: false, error: "Failed to create invitation. Please try again." };
  }

  return { success: true, invitation };
}

export async function listShopInvitationsAction() {
  const session = await requireAuthStrict();
  const invitations = await db.shopInvitation.findMany({
    where: { shopId: session.shopId },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true } } },
  });
  return { success: true, invitations };
}

export async function revokeShopInvitationAction(invitationId: string) {
  const session = await requireAuthStrict();
  if (session.role !== "OWNER" && session.role !== "MANAGER") {
    return { success: false, error: "Only owners or managers can revoke invitations." };
  }
  const inv = await db.shopInvitation.findFirst({
    where: { id: invitationId, shopId: session.shopId },
  });
  if (!inv) return { success: false, error: "Invitation not found." };
  await db.shopInvitation.update({
    where: { id: invitationId },
    data: { isActive: false },
  });
  return { success: true };
}

export async function validateInvitationCodeAction(code: string) {
  const trimmed = code.trim().toUpperCase();
  if (!trimmed) return { success: false, error: "Invitation code is required." };
  const invitation = await db.shopInvitation.findFirst({
    where: { code: trimmed },
    include: { shop: { select: { id: true, shopCode: true, name: true, isActive: true } } },
  });
  if (!invitation || !invitation.isActive) {
    return { success: false, error: "Invalid or revoked invitation code." };
  }
  if (invitation.expiresAt <= new Date()) {
    return { success: false, error: "Invitation has expired." };
  }
  if (invitation.usedCount >= invitation.maxUses) {
    return { success: false, error: "Invitation has already been used." };
  }
  if (!invitation.shop.isActive) {
    return { success: false, error: "Shop is no longer active." };
  }
  return {
    success: true,
    invitation: {
      id: invitation.id,
      shopId: invitation.shopId,
      shopCode: invitation.shop.shopCode,
      shopName: invitation.shop.name,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    },
  };
}
