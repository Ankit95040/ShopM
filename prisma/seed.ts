import {
  PrismaClient,
  UserRole,
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

async function createOwner({
  name,
  email,
  phone,
  password,
}: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(password, 12);

  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      phone,
      passwordHash,
      isActive: true,
    },
    create: {
      name,
      email,
      phone,
      passwordHash,
      isActive: true,
    },
  });
}

async function main() {
  console.log("=== ShopM Database Reset & Auth Setup ===");
  console.log("");

  // Step 1: Delete ALL business data (order matters for foreign keys)
  console.log("Clearing all business data...");

  await prisma.authSession.deleteMany();
  await prisma.otpToken.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.inventoryCategory.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.location.deleteMany();
  await prisma.shopMember.deleteMany();

  console.log("Business data cleared.");
  console.log("");

  // Step 2: Ensure shop exists (upsert - won't delete if already exists)
  const shop = await prisma.shop.upsert({
    where: { shopCode: "SHOPM-DEMO" },
    update: {
      name: "ShopM Demo Building Materials",
      description: "Demo business account shared by three shop owners",
      isActive: true,
    },
    create: {
      shopCode: "SHOPM-DEMO",
      name: "ShopM Demo Building Materials",
      description: "Demo business account shared by three shop owners",
      isActive: true,
    },
  });

  // Step 3: Ensure owner accounts exist (upsert - won't delete if already exists)
  const owner1 = await createOwner({
    name: "Ankit Raj (Owner 1)",
    email: "owner1@shopm.com",
    phone: "+91 98765 43210",
    password: "Owner1@ShopM",
  });

  const owner2 = await createOwner({
    name: "Priya Raj (Owner 2)",
    email: "owner2@shopm.com",
    phone: "+91 98111 22233",
    password: "Owner2@ShopM",
  });

  const owner3 = await createOwner({
    name: "Rahul Raj (Owner 3)",
    email: "owner3@shopm.com",
    phone: "+91 98999 88877",
    password: "Owner3@ShopM",
  });

  // Step 4: Ensure shop members exist (upsert - won't delete if already exists)
  await prisma.shopMember.createMany({
    data: [
      { shopId: shop.id, userId: owner1.id, loginId: "owner1", role: UserRole.OWNER },
      { shopId: shop.id, userId: owner2.id, loginId: "owner2", role: UserRole.OWNER },
      { shopId: shop.id, userId: owner3.id, loginId: "owner3", role: UserRole.OWNER },
    ],
    skipDuplicates: true,
  });

  // Step 5: Verify zero business data
  const counts = await Promise.all([
    prisma.location.count(),
    prisma.customer.count(),
    prisma.transaction.count(),
    prisma.inventoryCategory.count(),
    prisma.inventoryItem.count(),
    prisma.stockMovement.count(),
    prisma.auditLog.count(),
  ]);

  const [
    locationCount,
    customerCount,
    transactionCount,
    categoryCount,
    itemCount,
    movementCount,
    auditCount,
  ] = counts;

  console.log("Authentication structure preserved:");
  console.log("  Shop: SHOPM-DEMO");
  console.log("  Owner 1: owner1 / Owner1@ShopM");
  console.log("  Owner 2: owner2 / Owner2@ShopM");
  console.log("  Owner 3: owner3 / Owner3@ShopM");
  console.log("");
  console.log("Business data verified (all must be 0):");
  console.log(`  Locations: ${locationCount}`);
  console.log(`  Customers: ${customerCount}`);
  console.log(`  Transactions: ${transactionCount}`);
  console.log(`  Inventory Categories: ${categoryCount}`);
  console.log(`  Inventory Items: ${itemCount}`);
  console.log(`  Stock Movements: ${movementCount}`);
  console.log(`  Audit Logs: ${auditCount}`);
  console.log("");
  console.log("Database reset complete. You can now create fresh test data.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
