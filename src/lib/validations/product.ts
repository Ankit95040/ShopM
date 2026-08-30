import { z } from "zod";

export const ProductSchema = z.object({
  name: z.string().min(1, "Product name is required").max(200),
  sku: z.string().min(1, "SKU is required").max(50),
  barcode: z.string().optional().nullable(),
  hsnSacCode: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  unit: z.string().default("PCS"),
  description: z.string().optional().nullable(),
  costPrice: z.coerce.number().min(0, "Cost price must be positive"),
  sellingPrice: z.coerce.number().min(0, "Selling price must be positive"),
  mrp: z.coerce.number().min(0).optional().nullable(),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  isTaxInclusive: z.boolean().default(false),
  minStockAlert: z.coerce.number().int().min(0).default(5),
  trackInventory: z.boolean().default(true),
  initialStock: z.coerce.number().min(0).default(0).optional(),
});

export type ProductFormValues = z.infer<typeof ProductSchema>;
