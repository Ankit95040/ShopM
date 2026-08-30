import { z } from "zod";

export const CustomerSchema = z.object({
  name: z.string().min(1, "Customer name is required").max(100),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  taxNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  creditLimit: z.coerce.number().min(0).default(0),
});

export type CustomerFormValues = z.infer<typeof CustomerSchema>;

export const SupplierSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(150),
  contactPerson: z.string().optional().nullable(),
  phone: z.string().min(10, "Phone number must be at least 10 digits").max(15),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  taxNumber: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
});

export type SupplierFormValues = z.infer<typeof SupplierSchema>;
