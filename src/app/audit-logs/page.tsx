import { db } from "@/server/db";
import { AuditLogsView, AuditLogItem } from "@/components/audit/AuditLogsView";

export const dynamic = "force-dynamic";

export default async function AuditLogsPage() {
  let logs: any[] = [];

  try {
    logs = await db.auditLog.findMany({
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
