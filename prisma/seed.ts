import {
  PrismaClient,
  UserRole,
  TransactionType,
  PaymentMethod,
  StockMovementType,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://ankitraj@localhost:5432/shopm?schema=public";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding ShopM master data according to exact business requirements...");

  // 1. Create Default Users (Owner & Employee)
  const passwordHash = await bcrypt.hash("Password@123", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@shopm.com" },
    update: {},
    create: {
      name: "Ankit Raj (Shop Owner)",
      email: "owner@shopm.com",
      phone: "+91 98765 43210",
      passwordHash,
      role: UserRole.OWNER,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: "employee@shopm.com" },
    update: {},
    create: {
      name: "Rahul Verma (Staff)",
      email: "employee@shopm.com",
      phone: "+91 98111 22233",
      passwordHash,
      role: UserRole.EMPLOYEE,
    },
  });

  // 2. Create Locations / Branches
  const locMeerut = await prisma.location.create({
    data: {
      name: "Meerut Shop",
      description: "Main Wholesale & Retail Building Materials Outlet",
      createdById: owner.id,
    },
  });

  const locDelhi = await prisma.location.create({
    data: {
      name: "Delhi Shop",
      description: "Commercial Hardware & Electrical Depot",
      createdById: owner.id,
    },
  });

  const locWarehouse = await prisma.location.create({
    data: {
      name: "Central Warehouse",
      description: "Bulk Cement & Steel Depot",
      createdById: owner.id,
    },
  });

  // 3. Create Customers under Locations
  const cust1 = await prisma.customer.create({
    data: {
      locationId: locMeerut.id,
      name: "Rajesh Sharma (Contractor)",
      phone: "9876543210",
      address: "Plot 42, Civil Lines, Meerut",
      createdById: owner.id,
    },
  });

  const cust2 = await prisma.customer.create({
    data: {
      locationId: locMeerut.id,
      name: "Amit Builders",
      phone: "9812345678",
      address: "Near Metro Plaza, Meerut",
      createdById: employee.id,
    },
  });

  const cust3 = await prisma.customer.create({
    data: {
      locationId: locDelhi.id,
      name: "Sunil Electricals",
      phone: "9899988877",
      address: "Shop 12, Chandni Chowk, Delhi",
      createdById: owner.id,
    },
  });

  // 4. Create Sample Transactions (DEBT & PAYMENTS)
  // Customer 1: Rajesh Sharma
  await prisma.transaction.create({
    data: {
      customerId: cust1.id,
      type: TransactionType.DEBT,
      amount: 5000,
      billNumber: "BILL-102",
      description: "UltraTech Cement 10 Bags",
      createdById: employee.id,
    },
  });

  await prisma.transaction.create({
    data: {
      customerId: cust1.id,
      type: TransactionType.DEBT,
      amount: 2000,
      billNumber: "BILL-103",
      description: "Binding wire & PVC Pipes",
      createdById: employee.id,
    },
  });

  await prisma.transaction.create({
    data: {
      customerId: cust1.id,
      type: TransactionType.DEBT,
      amount: 1500,
      description: "Additional hardware purchase",
      createdById: owner.id,
    },
  });

  await prisma.transaction.create({
    data: {
      customerId: cust1.id,
      type: TransactionType.PAYMENT_RECEIVED,
      amount: 3000,
      paymentMethod: PaymentMethod.CASH,
      description: "Cash paid at counter",
      createdById: employee.id,
    },
  });

  await prisma.transaction.create({
    data: {
      customerId: cust1.id,
      type: TransactionType.PAYMENT_RECEIVED,
      amount: 2000,
      paymentMethod: PaymentMethod.UPI,
      description: "GPay / UPI Payment",
      createdById: employee.id,
    },
  });

  // 5. Create Inventory Categories
  const catCement = await prisma.inventoryCategory.create({
    data: { name: "Cement", description: "OPC & PPC Grade Cement Bags" },
  });

  const catSteel = await prisma.inventoryCategory.create({
    data: { name: "Steel", description: "TMT Rebars and Structural Steel" },
  });

  const catElectrical = await prisma.inventoryCategory.create({
    data: { name: "Electrical", description: "Wires, Switches, and Conduits" },
  });

  const catPlumbing = await prisma.inventoryCategory.create({
    data: { name: "Plumbing", description: "CPVC & UPVC Pipes and Fittings" },
  });

  const catHardware = await prisma.inventoryCategory.create({
    data: { name: "Hardware", description: "Nails, Fasteners, Tools" },
  });

  // 6. Create Inventory Items & Stock Movements
  const itemCement1 = await prisma.inventoryItem.create({
    data: {
      categoryId: catCement.id,
      locationId: locMeerut.id,
      name: "UltraTech Cement 50kg",
      sku: "CEM-ULT-50KG",
      unit: "Bags",
      currentStock: 150,
      minStockThreshold: 20,
      purchasePrice: 340,
      sellingPrice: 380,
      createdById: owner.id,
    },
  });

  await prisma.stockMovement.create({
    data: {
      itemId: itemCement1.id,
      type: StockMovementType.ADD_STOCK,
      quantity: 150,
      previousStock: 0,
      newStock: 150,
      supplier: "UltraTech Distributorship",
      purchasePrice: 340,
      notes: "Opening Stock Delivery",
      createdById: owner.id,
    },
  });

  const itemWire = await prisma.inventoryItem.create({
    data: {
      categoryId: catElectrical.id,
      locationId: locDelhi.id,
      name: "Havells Wire 1.5mm (90m Roll)",
      sku: "ELE-HAV-1.5MM",
      unit: "Rolls",
      currentStock: 4, // Trigger Low Stock!
      minStockThreshold: 10,
      purchasePrice: 1250,
      sellingPrice: 1550,
      createdById: owner.id,
    },
  });

  await prisma.stockMovement.create({
    data: {
      itemId: itemWire.id,
      type: StockMovementType.ADD_STOCK,
      quantity: 4,
      previousStock: 0,
      newStock: 4,
      supplier: "Havells India Ltd",
      purchasePrice: 1250,
      notes: "Initial batch",
      createdById: owner.id,
    },
  });

  console.log("✅ Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
