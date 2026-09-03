import { db } from "@/server/db";
import { AuditLogsView, AuditLogItem } from "@/components/audit/AuditLogsView";
import { Prisma } from "@prisma/client";
import { getEffectiveSession } from "@/server/auth";

export const dynamic = "force-dynamic";

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { select: { name: true; email: true } } };
}>;

export default async function AuditLogsPage() {
  const session = await getEffectiveSession();
  if (!session) return null;
  let logs: AuditLogWithUser[] = [];

  try {
    logs = await db.auditLog.findMany({
      where: { shopId: session.shopId },
      include: {
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
  }

  const serializedLogs: AuditLogItem[] = logs.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    userName: log.user?.name || "System",
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    changeReason: log.changeReason,
    previousValue: log.previousValue,
    newValue: log.newValue,
  }));

  return <AuditLogsView logs={serializedLogs} />;
}
