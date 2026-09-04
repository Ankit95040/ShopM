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

  // Resolve entity names for mobile display (without changing schema)
  // Collect ids by type
  const locationIds = [...new Set(logs.filter((l) => l.entityType === "LOCATION").map((l) => l.entityId))];
  const customerIds = [...new Set(logs.filter((l) => l.entityType === "CUSTOMER").map((l) => l.entityId))];
  const transactionIds = [...new Set(logs.filter((l) => l.entityType === "TRANSACTION").map((l) => l.entityId))];
  const inventoryIds = [...new Set(logs.filter((l) => l.entityType === "INVENTORY").map((l) => l.entityId))];
  const userIds = [...new Set(logs.filter((l) => l.entityType === "USER").map((l) => l.entityId))];

  const [locations, customers, transactions, inventoryItems, users] = await Promise.all([
    locationIds.length
      ? db.location.findMany({ where: { id: { in: locationIds }, shopId: session.shopId }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    customerIds.length
      ? db.customer.findMany({ where: { id: { in: customerIds }, shopId: session.shopId }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    transactionIds.length
      ? db.transaction.findMany({
          where: { id: { in: transactionIds }, shopId: session.shopId },
          select: { id: true, billNumber: true, customer: { select: { name: true } } },
        })
      : Promise.resolve([] as Array<{ id: string; billNumber: string | null; customer: { name: string } | null }>),
    inventoryIds.length
      ? db.inventoryItem.findMany({ where: { id: { in: inventoryIds }, shopId: session.shopId }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
    userIds.length
      ? db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : Promise.resolve([] as Array<{ id: string; name: string }>),
  ]);

  const locationMap = new Map(locations.map((l) => [l.id, l.name]));
  const customerMap = new Map(customers.map((c) => [c.id, c.name]));
  const transactionMap = new Map(
    transactions.map((t) => [t.id, t.customer?.name || t.billNumber || t.id.slice(0, 8)]),
  );
  const inventoryMap = new Map(inventoryItems.map((i) => [i.id, i.name]));
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const serializedLogs: AuditLogItem[] = logs.map((log) => {
    let entityName: string | null = null;
    if (log.entityType === "LOCATION") entityName = locationMap.get(log.entityId) || null;
    else if (log.entityType === "CUSTOMER") entityName = customerMap.get(log.entityId) || null;
    else if (log.entityType === "TRANSACTION") entityName = transactionMap.get(log.entityId) || null;
    else if (log.entityType === "INVENTORY") entityName = inventoryMap.get(log.entityId) || null;
    else if (log.entityType === "USER") entityName = userMap.get(log.entityId) || null;

    return {
      id: log.id,
      createdAt: log.createdAt,
      userName: log.user?.name || "System",
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      entityName,
      changeReason: log.changeReason,
      previousValue: log.previousValue,
      newValue: log.newValue,
    };
  });

  return <AuditLogsView logs={serializedLogs} />;
}
