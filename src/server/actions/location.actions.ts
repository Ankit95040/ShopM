"use server";

import { db } from "@/server/db";
import { requireAuth } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { AuditAction, Prisma } from "@prisma/client";

export async function createLocationAction({
  name,
  description,
}: {
  name: string;
  description?: string;
}) {
  try {
    const session = await requireAuth();
    if (!name.trim()) return { success: false, error: "Location name is required" };

    const location = await db.location.create({
      data: {
        shopId: session.shopId,
        name: name.trim(),
        description: description?.trim() || null,
        createdById: session.userId,
      },
    });

    revalidatePath("/billing");
    revalidatePath("/");
    return { success: true, location };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to create location" };
  }
}

export async function getLocationsAction(search?: string) {
  try {
    const session = await requireAuth();
    const whereClause: Prisma.LocationWhereInput = {
      shopId: session.shopId,
      isDeleted: false,
    };

    if (search?.trim()) {
      whereClause.name = { contains: search.trim(), mode: "insensitive" };
    }

    const locations = await db.location.findMany({
      where: whereClause,
      include: {
        customers: {
          where: { isDeleted: false },
          include: {
            transactions: {
              where: { isDeleted: false },
              select: { type: true, amount: true },
            },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Compute aggregated balance metrics per location
    const formatted = locations.map((loc) => {
      let totalDebt = 0;
      let totalReceived = 0;

      for (const cust of loc.customers) {
        for (const tx of cust.transactions) {
          const amt = Number(tx.amount);
          if (tx.type === "DEBT") totalDebt += amt;
          else if (tx.type === "PAYMENT_RECEIVED") totalReceived += amt;
        }
      }

      return {
        id: loc.id,
        name: loc.name,
        description: loc.description,
        createdAt: loc.createdAt,
        createdByName: loc.createdBy.name,
        customerCount: loc.customers.length,
        totalDebt,
        totalReceived,
        outstandingBalance: totalDebt - totalReceived,
      };
    });

    return { success: true, locations: formatted };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to fetch locations" };
  }
}

export async function softDeleteLocationAction(locationId: string) {
  try {
    const session = await requireAuth();

    const location = await db.location.findFirst({
      where: { id: locationId, shopId: session.shopId, isDeleted: false },
      select: { id: true, name: true },
    });
    if (!location) return { success: false, error: "Location not found" };

    const activeCustomers = await db.customer.findMany({
      where: { locationId, shopId: session.shopId, isDeleted: false },
      select: { id: true, name: true },
    });

    await db.$transaction(async (prisma) => {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      if (activeCustomers.length > 0) {
        await prisma.customer.updateMany({
          where: { locationId, isDeleted: false },
          data: {
            isDeleted: true,
            deletedAt: new Date(),
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.DELETE,
          entityType: "LOCATION",
          entityId: locationId,
          previousValue: {
            name: location.name,
            customerIds: activeCustomers.map((c) => c.id),
            customerNames: activeCustomers.map((c) => c.name),
          },
          changeReason: `Location deleted with ${activeCustomers.length} associated customer(s) archived`,
        },
      });
    });

    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return {
      success: true,
      locationId,
      archivedCustomerIds: activeCustomers.map((c) => c.id),
    };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to delete location" };
  }
}

export async function restoreLocationAction(locationId: string) {
  try {
    const session = await requireAuth();

    const location = await db.location.findFirst({
      where: { id: locationId, shopId: session.shopId, isDeleted: true },
      select: { id: true, name: true, deletedAt: true },
    });
    if (!location) return { success: false, error: "Location not found or not deleted" };

    const locationDeletedAt = location.deletedAt || new Date();

    const customersToRestore = await db.customer.findMany({
      where: {
        locationId,
        shopId: session.shopId,
        isDeleted: true,
        deletedAt: { gte: locationDeletedAt },
      },
      select: { id: true, name: true },
    });

    await db.$transaction(async (prisma) => {
      await prisma.location.update({
        where: { id: locationId },
        data: {
          isDeleted: false,
          deletedAt: null,
        },
      });

      if (customersToRestore.length > 0) {
        await prisma.customer.updateMany({
          where: {
            id: { in: customersToRestore.map((c) => c.id) },
          },
          data: {
            isDeleted: false,
            deletedAt: null,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          shopId: session.shopId,
          userId: session.userId,
          action: AuditAction.RESTORE,
          entityType: "LOCATION",
          entityId: locationId,
          previousValue: { isDeleted: true },
          newValue: { isDeleted: false },
          changeReason: `Location restored with ${customersToRestore.length} associated customer(s)`,
        },
      });
    });

    revalidatePath("/billing");
    revalidatePath("/");
    revalidatePath("/reports");
    revalidatePath("/audit-logs");
    revalidatePath("/recycle-bin");

    return { success: true, locationId };
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : "Failed to restore location" };
  }
}
