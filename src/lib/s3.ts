import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getS3Config() {
  return {
    endpoint: process.env.S3_ENDPOINT || "",
    region: "auto" as const,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
  };
}

function getBucketName(): string {
  return process.env.S3_BUCKET_NAME || "";
}

function getPublicDomain(): string {
  return process.env.S3_PUBLIC_DOMAIN || "";
}

function getS3Client(): S3Client {
  if (!process.env.S3_ENDPOINT || !process.env.S3_ACCESS_KEY_ID) {
    throw new Error("S3 credentials not configured. Set S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY in .env.local (use dotenvx run if values are encrypted)");
  }
  return new S3Client(getS3Config());
}

/**
 * Allowed image MIME types for bill images.
 */
export const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

/**
 * Maximum file size for bill images (5MB).
 */
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Generate an R2 object key for a bill image.
 * Structure: transactions/{shopId}/{customerId}/{transactionId}.{ext}
 */
export function getBillImageKey(
  shopId: string,
  customerId: string,
  transactionId: string,
  extension: string
): string {
  const ext = extension.toLowerCase().replace(".", "");
  return `transactions/${shopId}/${customerId}/${transactionId}.${ext}`;
}

/**
 * Get the extension from a MIME type.
 */
export function getExtensionFromMimeType(mimeType: string): string {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Upload a file to R2.
 * Returns the object key on success.
 */
export async function uploadToR2(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const { key, body, contentType } = params;
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    Body: body,
    ContentType: contentType,
    // Do not make the bucket publicly writable - use signed URLs for reading
  });

  await client.send(command);
  return key;
}

/**
 * Delete a file from R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!key) return;
  const client = getS3Client();

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  await client.send(command);
}

/**
 * Generate a short-lived signed URL for reading a private object.
 * Expires in 15 minutes by default.
 */
export async function getSignedReadUrl(
  key: string,
  expiresIn: number = 900
): Promise<string> {
  if (!key) return "";
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Get the public URL for a bill image (if S3_PUBLIC_DOMAIN is configured).
 * Falls back to signed URL if public domain is not set.
 */
export async function getBillImageUrl(key: string): Promise<string> {
  if (!key) return "";
  const publicDomain = getPublicDomain();
  if (publicDomain) {
    return `${publicDomain}/${key}`;
  }
  return getSignedReadUrl(key);
}

/**
 * Validate an uploaded file.
 * Returns null if valid, or an error message if invalid.
 */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return "Invalid file type. Only JPEG, PNG, and WebP images are allowed.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image is too large. Please select an image smaller than 5 MB.";
  }
  return null;
}
