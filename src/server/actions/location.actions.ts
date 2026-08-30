"use server";

import { db } from "@/server/db";
import { revalidatePath } from "next/cache";

export async function createLocationAction({
  name,
  description,
  createdById,
}: {
  name: string;
  description?: string;
  createdById: string;
}) {
  try {
    if (!name.trim()) return { success: false, error: "Location name is required" };

    const location = await db.location.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        createdById,
      },
    });

    revalidatePath("/billing");
    revalidatePath("/");
    return { success: true, location };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to create location" };
  }
}

export async function getLocationsAction(search?: string) {
  try {
    const whereClause: any = {
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
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to fetch locations" };
  }
}

export async function softDeleteLocationAction(locationId: string) {
  try {
    await db.location.update({
      where: { id: locationId },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
    });

    revalidatePath("/billing");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to delete location" };
  }
}
