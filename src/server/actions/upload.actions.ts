"use server";

import { requireAuth } from "@/server/auth";
import { db } from "@/server/db";
import {
  uploadToR2,
  deleteFromR2,
  getBillImageKey,
  getExtensionFromMimeType,
  validateImageFile,
} from "@/lib/s3";
import { withPerformance } from "@/lib/performance";

export interface UploadResult {
  success: boolean;
  billImageKey?: string;
  error?: string;
}

/**
 * Upload a bill image for a transaction.
 * The transaction must already exist and belong to the authenticated shop.
 */
async function uploadBillImageImpl(
  formData: FormData
): Promise<UploadResult> {
  const session = await requireAuth();

  const transactionId = formData.get("transactionId") as string;
  const customerId = formData.get("customerId") as string;
  const file = formData.get("file") as File | null;

  if (!transactionId || !customerId) {
    return { success: false, error: "Transaction ID and Customer ID are required." };
  }

  if (!file || file.size === 0) {
    return { success: false, error: "No file provided." };
  }

  // Validate file
  const validationError = validateImageFile(file);
  if (validationError) {
    return { success: false, error: validationError };
  }

  // Verify transaction belongs to this shop
  const transaction = await db.transaction.findFirst({
    where: {
      id: transactionId,
      shopId: session.shopId,
      customerId: customerId,
      isDeleted: false,
    },
  });

  if (!transaction) {
    return { success: false, error: "Transaction not found." };
  }

  // If there's an existing bill image, delete it first
  if (transaction.billImageKey) {
    try {
      await deleteFromR2(transaction.billImageKey);
    } catch {
      // Log but don't fail - old image cleanup is best-effort
      console.error("[uploadBillImage] Failed to delete old image:", transaction.billImageKey);
    }
  }

  // Generate the R2 object key
  const extension = getExtensionFromMimeType(file.type);
  const billImageKey = getBillImageKey(
    session.shopId,
    customerId,
    transactionId,
    extension
  );

  // Convert file to buffer and upload
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await uploadToR2({
      key: billImageKey,
      body: buffer,
      contentType: file.type,
    });
  } catch (error) {
    console.error("[uploadBillImage] Upload failed:", error);
    return { success: false, error: "Failed to upload bill image." };
  }

  // Update the transaction record
  try {
    await db.transaction.update({
      where: { id: transactionId },
      data: {
        billImageKey,
        billImagePublicId: billImageKey, // Keep in sync for legacy compatibility
        updatedById: session.userId,
      },
    });
  } catch (error) {
    console.error("[uploadBillImage] DB update failed:", error);
    // Rollback: delete the uploaded image
    try {
      await deleteFromR2(billImageKey);
    } catch {
      console.error("[uploadBillImage] Rollback delete failed:", billImageKey);
    }
    return { success: false, error: "Failed to save bill image reference." };
  }

  return { success: true, billImageKey };
}
export const uploadBillImage = withPerformance("uploadBillImage", "action", uploadBillImageImpl);

/**
 * Remove a bill image from a transaction.
 */
async function removeBillImageImpl(params: {
  transactionId: string;
  customerId: string;
}): Promise<{ success: boolean; error?: string }> {
  const session = await requireAuth();

  const { transactionId, customerId } = params;

  if (!transactionId || !customerId) {
    return { success: false, error: "Transaction ID and Customer ID are required." };
  }

  // Verify transaction belongs to this shop
  const transaction = await db.transaction.findFirst({
    where: {
      id: transactionId,
      shopId: session.shopId,
      customerId: customerId,
      isDeleted: false,
    },
  });

  if (!transaction) {
    return { success: false, error: "Transaction not found." };
  }

  if (!transaction.billImageKey) {
    return { success: false, error: "No bill image to remove." };
  }

  const oldKey = transaction.billImageKey;

  // Update the transaction record first (optimistic)
  try {
    await db.transaction.update({
      where: { id: transactionId },
      data: {
        billImageKey: null,
        billImagePublicId: null,
        updatedById: session.userId,
      },
    });
  } catch (error) {
    console.error("[removeBillImage] DB update failed:", error);
    return { success: false, error: "Failed to remove bill image reference." };
  }

  // Then delete the R2 object (best-effort)
  try {
    await deleteFromR2(oldKey);
  } catch {
    console.error("[removeBillImage] R2 delete failed (best-effort):", oldKey);
  }

  return { success: true };
}
export const removeBillImage = withPerformance("removeBillImage", "action", removeBillImageImpl);

/**
 * Get a signed URL for viewing a bill image.
 * Verifies the transaction belongs to the authenticated shop.
 */
async function getBillImageSignedUrlImpl(params: {
  transactionId: string;
  customerId: string;
}): Promise<{ success: boolean; url?: string; error?: string }> {
  const session = await requireAuth();

  const { transactionId, customerId } = params;

  // Verify transaction belongs to this shop
  const transaction = await db.transaction.findFirst({
    where: {
      id: transactionId,
      shopId: session.shopId,
      customerId: customerId,
    },
    select: { billImageKey: true },
  });

  if (!transaction || !transaction.billImageKey) {
    return { success: false, error: "Bill image not found." };
  }

  try {
    const { getSignedReadUrl } = await import("@/lib/s3");
    const url = await getSignedReadUrl(transaction.billImageKey);
    return { success: true, url };
  } catch (error) {
    console.error("[getBillImageSignedUrl] Failed to generate signed URL:", error);
    return { success: false, error: "Failed to generate image URL." };
  }
}
export const getBillImageSignedUrl = withPerformance("getBillImageSignedUrl", "action", getBillImageSignedUrlImpl);
