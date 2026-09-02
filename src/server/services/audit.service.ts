import { db } from "@/server/db";
import { AuditAction, Prisma } from "@prisma/client";

export class AuditService {
  static async log({
    shopId,
    userId,
    action,
    entityType,
    entityId,
    transactionId,
    previousValue,
    newValue,
    changeReason,
    ipAddress,
  }: {
    shopId: string;
    userId: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    transactionId?: string | null;
    previousValue?: Prisma.InputJsonValue;
    newValue?: Prisma.InputJsonValue;
    changeReason?: string | null;
    ipAddress?: string | null;
  }) {
    try {
      return await db.auditLog.create({
        data: {
          shopId,
          userId,
          action,
          entityType,
          entityId,
          transactionId: transactionId || null,
          previousValue: previousValue || Prisma.JsonNull,
          newValue: newValue || Prisma.JsonNull,
          changeReason: changeReason || null,
          ipAddress: ipAddress || null,
        },
      });
    } catch (error) {
      console.error("[AuditService.log] Failed to write audit log:", error);
    }
  }
}
