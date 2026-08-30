import { z } from "zod";

export const BillItemInputSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  productName: z.string().min(1),
  productSku: z.string().min(1),
  unit: z.string().default("PCS"),
  hsnSacCode: z.string().optional().nullable(),
  unitCostPrice: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
  mrp: z.coerce.number().optional().nullable(),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  totalAmount: z.coerce.number().min(0),
});

export const PaymentInputSchema = z.object({
  paymentMode: z.enum([
    "CASH",
    "UPI",
    "CARD",
    "CREDIT_UDHAAR",
    "NET_BANKING",
    "CHEQUE",
  ]),
  amount: z.coerce.number().positive("Payment amount must be greater than 0"),
  referenceNo: z.string().optional().nullable(),
});

export const CreateBillSchema = z.object({
  storeId: z.string().min(1, "Store ID is required"),
  counterId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  items: z.array(BillItemInputSchema).min(1, "At least one item is required in the bill"),
  subtotalAmount: z.coerce.number().min(0),
  discountAmount: z.coerce.number().min(0).default(0),
  taxAmount: z.coerce.number().min(0).default(0),
  roundOff: z.coerce.number().default(0),
  totalAmount: z.coerce.number().min(0),
  payments: z.array(PaymentInputSchema),
  notes: z.string().optional().nullable(),
});

export type CreateBillInput = z.infer<typeof CreateBillSchema>;
