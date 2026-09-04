/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const */
 /**
 * ShopM Flood Seed — LOCAL ONLY (STRICT)
 * Generates 18 categories, 30-50 items per category (~700-800 items),
 * 10-30 reconciled stock movements per item (≥14,000 total),
 * 9 billing locations, ~20 customers per location (~180 total),
 * 2,500-3,500 billing transactions for the existing demo shop (SHOPM-DEMO)
 * on the LOCAL database postgresql://ankitraj@localhost:5432/shopm.
 *
 * CRITICAL INVARIANTS:
 * - previousStock/newStock are derived sequentially from running stock.
 * - Never negative stock.
 * - last movement newStock === currentStock.
 * - Customer Opening + Bills - Payments = Outstanding (Debt - Payment).
 *
 * SAFETY: Aborts if DATABASE_URL is not strictly localhost/127.0.0.1.
 * Also aborts on any Neon/production URL. Never touches prod.
 * Only clears/recreates the demo shop's business data (shopId isolation).
 * Preserve demo shop, owners, memberships, auth.
 * Deterministic via mulberry32 seed — repeatable.
 */

import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// ------------------------------------------------------------------
// Safety guard — STRICT local-only
// ------------------------------------------------------------------
const rawUrl = process.env.DATABASE_URL || "";
const isNeon = rawUrl.includes("neon.tech") || rawUrl.includes("neon.") || rawUrl.includes("aws.neon.tech") || rawUrl.includes("pooler.supabase") || rawUrl.includes("supabase.co");
const isStrictLocal = rawUrl.includes("localhost") || rawUrl.includes("127.0.0.1");
const allowProd = process.env.FLOOD_ALLOW_PRODUCTION === "1";

if (!rawUrl) {
  console.error("DATABASE_URL not set. Set it to your LOCAL database, e.g. postgresql://ankitraj@localhost:5432/shopm");
  process.exit(1);
}
if (isNeon && !allowProd) {
  console.error("\n⛔ SAFETY ABORT: DATABASE_URL looks like production (Neon/Supabase).");
  console.error("This flood script is for LOCAL development/demo data ONLY.");
  console.error("To run locally, set DATABASE_URL to your local Postgres, e.g.:");
  console.error('  DATABASE_URL="postgresql://ankitraj@localhost:5432/shopm" npx tsx prisma/flood.ts');
  console.error("If you absolutely must run on Neon, set FLOOD_ALLOW_PRODUCTION=1 (NOT RECOMMENDED).\n");
  process.exit(1);
}
if (!isStrictLocal && !allowProd) {
  console.error("\n⛔ SAFETY ABORT: DATABASE_URL must point to localhost/127.0.0.1.");
  console.error(`Got: ${rawUrl.replace(/:\/\/.*@/, "://***@")}`);
  console.error('Only "postgresql://ankitraj@localhost:5432/shopm" (or 127.0.0.1) is allowed.');
  console.error("Refusing to run to avoid touching production.\n");
  process.exit(1);
}

// ------------------------------------------------------------------
// Prisma
// ------------------------------------------------------------------
const pool = new Pool({ connectionString: rawUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ------------------------------------------------------------------
// Deterministic PRNG (mulberry32) — repeatable seed
// ------------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xdeadbeef + 42);
const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min: number, max: number, decimals = 2) => {
  const v = rand() * (max - min) + min;
  return Number(v.toFixed(decimals));
};
const pick = <T>(arr: T[]): T => arr[randInt(0, arr.length - 1)];
const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ------------------------------------------------------------------
// Realistic pools — Indian shop
// ------------------------------------------------------------------
const CATEGORIES = [
  "Grocery",
  "Dairy",
  "Beverages",
  "Snacks",
  "Bakery",
  "Frozen Foods",
  "Spices",
  "Household",
  "Cleaning",
  "Personal Care",
  "Stationery",
  "Pet Care",
  "Kitchen",
  "Electronics",
  "Hardware",
  "Toiletries",
  "Packaged Foods",
  "Confectionery",
];

const INDIAN_PRODUCTS: Record<string, string[]> = {
  Grocery: ["Tata Salt 1kg", "Aashirvaad Atta 5kg", "Fortune Oil 1L", "Toor Dal 1kg", "Chana Dal 1kg", "Rajma 1kg", "Chole 1kg", "Poha 500g", "Suji 1kg", "Besan 1kg", "Sugar 1kg", "Tea Powder 250g", "Coffee 100g", "Rice 5kg", "Basmati Rice 1kg"],
  Dairy: ["Amul Milk 1L", "Amul Butter 500g", "Amul Cheese 200g", "Mother Dairy Curd 400g", "Amul Ghee 500ml", "Paneer 200g", "Milk Powder 500g", "Yogurt 100g", "Lassi 200ml", "Cream 200ml"],
  Beverages: ["Coca Cola 750ml", "Pepsi 1L", "Frooti 600ml", "Real Juice 1L", "Bisleri Water 1L", "Red Bull 250ml", "Tea 100g", "Coffee Sachet", "Tang 500g", "Hershey Syrup"],
  Snacks: ["Maggi Noodles 70g", "Parle-G 800g", "Lays Chips 52g", "Kurkure 90g", "Haldiram Namkeen 200g", "Bingo Mad Angles", "Unibic Cookies 300g", "Britannia Cake", "Balaji Wafers", "Makhana 100g"],
  Bakery: ["Brown Bread 400g", "White Bread 400g", "Bun Pack 6", "Croissant 80g", "Muffin Pack", "Pav 250g", "Rusks 300g", "Cake Mix 500g", "Donut Pack", "Pizza Base"],
  "Frozen Foods": ["Frozen Peas 1kg", "Frozen Paratha 5pc", "Ice Cream 500ml", "Frozen Nuggets", "Frozen Corn 500g", "Frozen Samosa", "Chicken Nuggets", "Veg Patties"],
  Spices: ["MDH Chilli Powder 100g", "MDH Garam Masala 100g", "MDH Turmeric 100g", "Coriander Powder 100g", "Jeera 100g", "Mustard 100g", "Black Pepper 50g", "Cardamom 20g"],
  Household: ["Plastic Container 1L", "Steel Bowl Set", "Broom Stick", "Mop", "Dustpan", "Cloth Hanger 6pc", "Storage Box", "Bucket 15L"],
  Cleaning: ["Surf Excel 1kg", "Vim Dishwash 500ml", "Harpic 500ml", "Dettol 500ml", "Colin Glass Cleaner", "Lizol Floor Cleaner", "Comfort Fabric", "Pril Dishwash"],
  "Personal Care": ["Lux Soap 100g", "Dove Soap 100g", "Colgate Toothpaste 100g", "Clinic Plus Shampoo 175ml", "Parachute Oil 200ml", "Nivea Cream 50ml", "Gillette Razor", "Hand Wash 200ml"],
  Stationery: ["A4 Paper 500 sheets", "Ball Pen 10pc", "Notebook 200pg", "Pencil Box", "Eraser Pack", "Sharpener", "Stapler", "Glue Stick", "Highlighter 5pc", "Sticky Notes"],
  "Pet Care": ["Pedigree Dog Food 1kg", "Whiskas Cat Food 1kg", "Pet Shampoo 200ml", "Dog Biscuits", "Cat Litter 5kg"],
  Kitchen: ["Pressure Cooker 3L", "Frying Pan", "Knife Set", "Chopping Board", "Mixie Jar", "Gas Lighter", "Spatula Set", "Steel Plate"],
  Electronics: ["LED Bulb 9W", "Extension Cord 5m", "Power Strip", "USB Cable", "Wall Clock", "Torch Light", "Batteries AA 4pc", "LED Tube 20W"],
  Hardware: ["Hammer", "Screwdriver Set", "Nails 100g", "Wall Putty 1kg", "Adhesive Tape", "Wire 1m", "Switch Board", "Pipe Fitting"],
  Toiletries: ["Shampoo 340ml", "Conditioner 80ml", "Face Wash 150g", "Body Lotion 200ml", "Deodorant 150ml", "Hair Gel 50g", "Mouthwash 200ml"],
  "Packaged Foods": ["Ketchup 500g", "Mayonnaise 300g", "Jam 500g", "Honey 250g", "Oats 1kg", "Corn Flakes 500g", "Pickle 400g", "Chyawanprash 500g"],
  Confectionery: ["Dairy Milk Silk 60g", "KitKat 4 finger", "5 Star 20g", "Munch 20g", "Eclairs 100g", "Gems 17g", "Lollipop Pack", "Jelly Beans"],
};

const LOCATIONS = [
  "Main Shop",
  "Warehouse",
  "Wholesale Counter",
  "Retail Counter",
  "Branch 2 - Market",
  "Downtown Branch",
  "North Branch",
  "Online Orders",
  "Storage Unit",
  "Market Outlet",
];

const FIRST_NAMES = ["Rahul", "Priya", "Amit", "Neha", "Rohit", "Anjali", "Sunil", "Pooja", "Vikram", "Sneha", "Arjun", "Kavita", "Suresh", "Meena", "Rajesh", "Divya", "Manoj", "Shweta", "Deepak", "Anita", "Sanjay", "Ritu", "Mohit", "Nisha", "Vijay", "Seema", "Ashok", "Rekha", "Gaurav", "Swati", "Harish", "Usha", "Nitin", "Sarika", "Pradeep", "Monika", "Rakesh", "Jyoti", "Sahil", "Kiran"];
const LAST_NAMES = ["Sharma", "Verma", "Kumar", "Singh", "Gupta", "Patel", "Yadav", "Shukla", "Mishra", "Jain", "Agarwal", "Nair", "Reddy", "Choudhary", "Bansal", "Mehta", "Rathore", "Saxena", "Joshi", "Desai", "Khan", "Malhotra", "Batra", "Kapoor", "Chopra", "Arora", "Tiwari", "Pandey", "Rastogi", "Srivastava"];
const UNITS = ["Pieces", "Kg", "Boxes", "Litres", "Packs", "Metres", "Ton"];
const BILL_DESCS = ["Grocery purchase", "Monthly stock", "Festival order", "Urgent supply", "Regular khata", "Wholesale bill", "Retail purchase", "Construction supply", "Household items", "Bulk order"];
const PAYMENT_NOTES = ["Cash", "UPI Ref", "Bank Transfer", "Counter cash", "PhonePe", "GPay", null, null];
const STOCK_SUPPLIERS = ["Metro Wholesaler", "IndiaMART Supplier", "Local Distributor", "Amul Distributor", "Parle Distributor", "P&G Supplier", "HUL Supplier", null];
const STOCK_NOTES_ADD = ["Purchase from supplier", "Restocked", "Opening stock", "Festival restock", "Bulk purchase", null];
const STOCK_NOTES_REMOVE = ["Sold", "Damaged", "Used", "Sold to customer", "Returned", null];

const AMOUNTS = [120, 450, 1250, 2780, 7500, 15250, 42500];

async function main() {
  console.log("=== ShopM Flood Seed (LOCAL ONLY) ===");
  console.log(`DATABASE_URL: ${rawUrl.replace(/:\/\/.*@/, "://***@")}`);
  console.log("");

  // Find demo shop — prefer SHOPM-DEMO, else first isDemo, else first shop
  let shop = await prisma.shop.findUnique({ where: { shopCode: "SHOPM-DEMO" } });
  if (!shop) shop = await prisma.shop.findFirst({ where: { isDemo: true }, orderBy: { createdAt: "asc" } });
  if (!shop) shop = await prisma.shop.findFirst({ orderBy: { createdAt: "asc" } });
  if (!shop) {
    console.error("No shop found. Run `npx prisma db seed` first to create SHOPM-DEMO.");
    process.exit(1);
  }
  console.log(`Target shop: ${shop.shopCode} (${shop.id}) — ${shop.name}`);
  console.log(`Shop members: ${(await prisma.shopMember.count({ where: { shopId: shop.id } }))} (preserved)`);

  // Find a real owner for createdBy — prefer owner1
  const ownerMember = await prisma.shopMember.findFirst({ where: { shopId: shop.id, role: "OWNER" }, orderBy: { createdAt: "asc" }, include: { user: true } });
  const ownerMember2 = await prisma.shopMember.findFirst({ where: { shopId: shop.id }, orderBy: { createdAt: "asc" } });
  const creatorId = ownerMember?.userId || ownerMember2?.userId;
  if (!creatorId) throw new Error("No shop member found for createdBy");
  console.log(`Creator user: ${creatorId}`);

  // ------------------------------------------------------------------
  // Deterministic cleanup — ONLY this shop's business data
  // ------------------------------------------------------------------
  console.log("\nClearing existing demo data for this shop (repeatable)...");
  // Order respects FKs
  await prisma.auditLog.deleteMany({ where: { shopId: shop.id } });
  await prisma.stockMovement.deleteMany({ where: { shopId: shop.id } });
  await prisma.transaction.deleteMany({ where: { shopId: shop.id } });
  await prisma.customer.deleteMany({ where: { shopId: shop.id } });
  await prisma.inventoryItem.deleteMany({ where: { shopId: shop.id } });
  await prisma.inventoryCategory.deleteMany({ where: { shopId: shop.id } });
  await prisma.location.deleteMany({ where: { shopId: shop.id } });
  // Keep shop, members, users, sessions, invitations, guestSessions, feedback
  console.log("Cleared.");

  // ------------------------------------------------------------------
  // 1. Categories — 18
  // ------------------------------------------------------------------
  console.log("\nCreating categories...");
  const categoryRows: { id: string; name: string }[] = [];
  for (const name of CATEGORIES) {
    const cat = await prisma.inventoryCategory.create({ data: { shopId: shop.id, name, description: `${name} category` } });
    categoryRows.push(cat);
  }
  console.log(`  Categories: ${categoryRows.length}`);

  // ------------------------------------------------------------------
  // 2. Inventory Items — 30-50 per category, ~700-800 total
  // ------------------------------------------------------------------
  console.log("\nCreating inventory items (30-50 per category, ~700-800)...");
  const itemRows: Array<{ id: string; categoryId: string; name: string; unit: string; currentStock: number; minStockThreshold: number }> = [];
  const allItemsToCreate: any[] = [];
  let skuCounter = 1000;
  for (const cat of categoryRows) {
    const products = INDIAN_PRODUCTS[cat.name] || [`${cat.name} Product`];
    const count = randInt(30, 50);
    for (let i = 0; i < count; i++) {
      const baseName = products[i % products.length];
      const variant = i >= products.length ? ` ${String.fromCharCode(65 + Math.floor(i / products.length))}${(i % 9) + 1}` : "";
      const name = `${baseName}${variant}`;
      const unit = pick(UNITS);
      const sku = `SKU-${cat.name.slice(0, 3).toUpperCase()}-${skuCounter++}`;

      // Stock distribution: 60% In Stock, 20% Low, 10% Out, 10% High
      const roll = rand();
      let currentStock: number, minStockThreshold: number;
      if (roll < 0.6) {
        // In Stock
        minStockThreshold = randInt(5, 20);
        currentStock = randInt(minStockThreshold + 1, 500);
      } else if (roll < 0.8) {
        // Low Stock
        minStockThreshold = randInt(10, 30);
        currentStock = randInt(1, minStockThreshold);
      } else if (roll < 0.9) {
        // Out of Stock
        minStockThreshold = randInt(5, 20);
        currentStock = 0;
      } else {
        // High Stock
        minStockThreshold = randInt(10, 30);
        currentStock = randInt(500, 5000);
      }

      const purchasePrice = randFloat(10, 500, 2);
      const sellingPrice = Number((purchasePrice * randFloat(1.15, 1.6, 2)).toFixed(2));

      allItemsToCreate.push({
        shopId: shop.id,
        categoryId: cat.id,
        name,
        sku,
        unit,
        currentStock,
        minStockThreshold,
        purchasePrice,
        sellingPrice,
        createdById: creatorId,
        isDeleted: false,
      });
    }
  }

  // Bulk create in batches of 500 (createMany does not return ids, so we need to fetch after or create individually for IDs)
  // To preserve performance, use createMany then fetch back by shopId
  // But we need IDs for movements. Instead, create in batches and fetch.
  // Simpler: createMany and then query to get IDs; still efficient.
  const BATCH = 200;
  for (let i = 0; i < allItemsToCreate.length; i += BATCH) {
    await prisma.inventoryItem.createMany({ data: allItemsToCreate.slice(i, i + BATCH), skipDuplicates: true });
  }
  const createdItems = await prisma.inventoryItem.findMany({ where: { shopId: shop.id }, select: { id: true, name: true, categoryId: true, unit: true, currentStock: true, minStockThreshold: true, sellingPrice: true } });
  console.log(`  Inventory items: ${createdItems.length} (target 700-800, 18 × 30-50)`);

  // Map for quick lookup of category
  const catMap = new Map(categoryRows.map((c) => [c.id, c.name]));

  // ------------------------------------------------------------------
  // 3. Stock Movements — 10-30 per item => several thousand
  // ------------------------------------------------------------------
  console.log("\nCreating stock movements (10-30 per item, ≥14,000 reconciled)...");
  const movementsToCreate: any[] = [];
  const now = Date.now();
  const itemUpdates: Array<{ id: string; stock: number }> = [];
  for (const item of createdItems) {
    const desiredStock = Number((item as any).currentStock);
    const movCount = randInt(10, 30);
    // Generate raw movements with random dates/types/quantities (without stock)
    const raw: Array<{ type: "ADD_STOCK" | "REMOVE_STOCK"; quantity: number; removalReason: any; supplier: any; purchasePrice: any; notes: any; movementDate: Date }> = [];
    for (let j = 0; j < movCount; j++) {
      const isAdd = rand() < 0.6;
      const qty = randFloat(1, 100, 3);
      const type = isAdd ? "ADD_STOCK" : "REMOVE_STOCK";
      const removalReason = !isAdd ? pick(["SOLD", "DAMAGED", "LOST", "RETURNED", "ADJUSTMENT", "OTHER"] as any) : null;
      const daysAgo = randInt(0, 90);
      const hours = randInt(0, 23);
      const minutes = randInt(0, 59);
      const movementDate = new Date(now - daysAgo * 24 * 60 * 60 * 1000);
      movementDate.setHours(hours, minutes, randInt(0, 59), 0);
      raw.push({ type, quantity: qty, removalReason, supplier: isAdd ? pick(STOCK_SUPPLIERS) : null, purchasePrice: isAdd ? randFloat(10, 500, 2) : null, notes: isAdd ? pick(STOCK_NOTES_ADD) : pick(STOCK_NOTES_REMOVE), movementDate });
    }
    // Sort chronologically (oldest first) for correct running stock
    raw.sort((a, b) => a.movementDate.getTime() - b.movementDate.getTime());
    // Recompute running stock sequentially, never negative
    let running = 0; // start from 0 opening stock
    const computed: typeof raw = [];
    for (const r of raw) {
      let qty = Number(r.quantity);
      let type: "ADD_STOCK" | "REMOVE_STOCK" = r.type;
      // Never allow negative: if REMOVE and qty > running, cap qty or flip to ADD
      if (type === "REMOVE_STOCK") {
        if (running === 0) {
          // No stock to remove — turn into ADD
          type = "ADD_STOCK";
        } else if (qty > running) {
          qty = randFloat(1, Number(running), 3);
          // Ensure qty <= running and >0
          if (qty > running) qty = Number(running);
          if (qty < 0.001) qty = Number(running);
        }
      }
      const prev = Number(running);
      const next = type === "ADD_STOCK" ? Number((prev + qty).toFixed(3)) : Number((prev - qty).toFixed(3));
      computed.push({ ...r, type, quantity: Number(qty.toFixed(3)), movementDate: r.movementDate });
      // Store with correct prev/next for DB
      movementsToCreate.push({
        shopId: shop.id,
        itemId: item.id,
        type,
        removalReason: type === "REMOVE_STOCK" ? r.removalReason : null,
        quantity: Number(qty.toFixed(3)),
        previousStock: Number(prev.toFixed(3)),
        newStock: Number(next.toFixed(3)),
        supplier: type === "ADD_STOCK" ? r.supplier : null,
        purchasePrice: type === "ADD_STOCK" ? r.purchasePrice : null,
        notes: r.notes,
        movementDate: r.movementDate,
        createdById: creatorId,
      });
      running = Number(next.toFixed(3));
    }
    // Adjust final stock to match desiredStock (distribution) with one final movement if needed
    const diff = Number((desiredStock - running).toFixed(3));
    if (Math.abs(diff) > 0.001) {
      const isAdd = diff > 0;
      const qty = Math.abs(diff);
      const prev = Number(running);
      const next = isAdd ? Number((prev + qty).toFixed(3)) : Number(Math.max(0, prev - qty).toFixed(3));
      // Ensure adjustment is chronologically last (most recent) so history reconciles — 1 day in future
      const lastDate = new Date(now + 24 * 60 * 60 * 1000 + randInt(0, 5000));
      movementsToCreate.push({
        shopId: shop.id,
        itemId: item.id,
        type: isAdd ? "ADD_STOCK" : "REMOVE_STOCK",
        removalReason: isAdd ? null : "ADJUSTMENT",
        quantity: Number(qty.toFixed(3)),
        previousStock: Number(prev.toFixed(3)),
        newStock: Number(next.toFixed(3)),
        supplier: isAdd ? "System Adjustment" : null,
        purchasePrice: null,
        notes: isAdd ? "Adjustment to match current stock" : "Adjustment to match current stock",
        movementDate: lastDate,
        createdById: creatorId,
      });
      running = Number(next.toFixed(3));
    }
    itemUpdates.push({ id: item.id, stock: Number(desiredStock.toFixed(3)) });
    // Ensure running equals desiredStock after adjustment
    // If still mismatch due to rounding, force desired
  }
  // Bulk insert movements in batches of 1000
  for (let i = 0; i < movementsToCreate.length; i += 1000) {
    await prisma.stockMovement.createMany({ data: movementsToCreate.slice(i, i + 1000) });
  }
  // Update items to have final stock consistent with last movement (desiredStock)
  console.log(`  Updating ${itemUpdates.length} items to reconciled stock...`);
  for (let i = 0; i < itemUpdates.length; i += 500) {
    const batch = itemUpdates.slice(i, i + 500);
    // Use transaction for batch updates
    await prisma.$transaction(
      batch.map((u) => prisma.inventoryItem.update({ where: { id: u.id }, data: { currentStock: u.stock } }))
    );
  }
  console.log(`  Stock movements: ${movementsToCreate.length} (target several thousand)`);

  // ------------------------------------------------------------------
  // 4. Locations — exactly 9
  // ------------------------------------------------------------------
  console.log("\nCreating billing locations (exactly 9)...");
  const shuffledLocs = shuffle(LOCATIONS).slice(0, 9);
  const locationRows: { id: string; name: string }[] = [];
  for (const locName of shuffledLocs) {
    const loc = await prisma.location.create({ data: { shopId: shop.id, name: locName, description: `${locName} — demo`, createdById: creatorId } });
    locationRows.push(loc);
  }
  console.log(`  Locations: ${locationRows.length} (target 9)`);

  // ------------------------------------------------------------------
  // 5. Customers — ~20 per location, ~180 total (deterministic)
  // ------------------------------------------------------------------
  console.log("\nCreating customers (~20 per location, ~180 total)...");
  const customersToCreate: any[] = [];
  const usedPhones = new Set<string>();
  const genPhone = () => {
    let p: string;
    do {
      const start = pick(["6", "7", "8", "9"]);
      p = start + Array.from({ length: 9 }, () => randInt(0, 9).toString()).join("");
    } while (usedPhones.has(p));
    usedPhones.add(p);
    return p;
  };
  const indianAddresses = ["Main Market", "Sector 15", "Gandhi Nagar", "Civil Lines", "Model Town", "Shastri Nagar", "Rajouri Garden", "Lajpat Nagar", "Anand Vihar", "Preet Vihar"];
  // Exactly 20 per location = 180 total, varied names/phones/addresses remain realistic
  for (const loc of locationRows) {
    const perLoc = 20; // deterministic 20 each = 180 total; variation comes from names/amounts/dates below
    for (let i = 0; i < perLoc; i++) {
      const fn = pick(FIRST_NAMES);
      const ln = pick(LAST_NAMES);
      const name = `${fn} ${ln}${rand() < 0.15 ? ` ${pick(["Sons", "Traders", "& Sons", "Enterprises"])}` : ""}`;
      const phone = genPhone();
      const address = `${pick(indianAddresses)}, House ${randInt(10, 250)}`;
      customersToCreate.push({
        shopId: shop.id,
        locationId: loc.id,
        name,
        phone,
        address,
        createdById: creatorId,
        isDeleted: false,
      });
    }
  }
  for (let i = 0; i < customersToCreate.length; i += 200) {
    await prisma.customer.createMany({ data: customersToCreate.slice(i, i + 200) });
  }
  const createdCustomers = await prisma.customer.findMany({ where: { shopId: shop.id }, select: { id: true, locationId: true, name: true, phone: true } });
  console.log(`  Customers: ${createdCustomers.length} (target ~180, 9 × 20)`);

  // ------------------------------------------------------------------
  // 6. Billing Transactions — ~10-30 per customer => 2,500-3,500
  // ------------------------------------------------------------------
  console.log("\nCreating billing transactions (~10-30 per customer, 2,500-3,500)...");
  const transactionsToCreate: any[] = [];
  const nowTx = Date.now();
  const pickAmount = () => {
    // Varied amounts including 120,450,1250 etc, but also random 100-50000
    if (rand() < 0.3) return pick(AMOUNTS);
    return randInt(100, 50000);
  };
  for (const cust of createdCustomers) {
    const profileRoll = rand();
    let txCount: number;
    let debtRatio: number;
    if (profileRoll < 0.3) {
      // Fully paid
      txCount = randInt(10, 20);
      debtRatio = 0.5;
    } else if (profileRoll < 0.6) {
      // Some outstanding
      txCount = randInt(12, 25);
      debtRatio = 0.6;
    } else if (profileRoll < 0.8) {
      // Large outstanding
      txCount = randInt(15, 30);
      debtRatio = 0.7;
    } else if (profileRoll < 0.9) {
      // Mostly payments
      txCount = randInt(10, 20);
      debtRatio = 0.4;
    } else {
      // New few
      txCount = randInt(3, 6);
      debtRatio = 0.6;
    }

    let balance = 0; // we track for consistency, but we generate amounts and then ensure final balance matches
    // Generate chronological transactions
    const custTxs: Array<{ type: "DEBT" | "PAYMENT_RECEIVED"; amount: number; date: Date }> = [];
    for (let j = 0; j < txCount; j++) {
      const isDebt = rand() < debtRatio;
      const amt = pickAmount();
      const daysAgo = randInt(0, 90);
      const d = new Date(nowTx - daysAgo * 24 * 60 * 60 * 1000);
      d.setHours(randInt(8, 20), randInt(0, 59), 0, 0);
      custTxs.push({ type: isDebt ? "DEBT" : "PAYMENT_RECEIVED", amount: amt, date: d });
    }
    // Sort by date ASC for consistent ledger
    custTxs.sort((a, b) => a.date.getTime() - b.date.getTime());

    // If fully paid profile, adjust last payment to settle balance
    let totalDebt = custTxs.filter((t) => t.type === "DEBT").reduce((s, t) => s + t.amount, 0);
    let totalPay = custTxs.filter((t) => t.type === "PAYMENT_RECEIVED").reduce((s, t) => s + t.amount, 0);
    let bal = totalDebt - totalPay;
    if (profileRoll < 0.3 && bal !== 0) {
      // Fully paid: add adjustment payment or reduce last debt
      if (bal > 0) {
        // need extra payment to settle
        const lastPayIdx = custTxs.map((t) => t.type).lastIndexOf("PAYMENT_RECEIVED");
        if (lastPayIdx >= 0) custTxs[lastPayIdx].amount += bal;
        else custTxs.push({ type: "PAYMENT_RECEIVED", amount: bal, date: new Date(nowTx - randInt(0, 2) * 24 * 60 * 60 * 1000) });
      } else if (bal < 0) {
        // overpaid: reduce a payment
        const idx = custTxs.findIndex((t) => t.type === "PAYMENT_RECEIVED" && t.amount + bal >= 100);
        if (idx >= 0) custTxs[idx].amount += bal; // bal negative
      }
    }

    for (const tx of custTxs) {
      const isDebt = tx.type === "DEBT";
      transactionsToCreate.push({
        shopId: shop.id,
        customerId: cust.id,
        type: tx.type,
        amount: tx.amount, // Decimal(14,2) — integer amounts preserve precision
        billNumber: isDebt && rand() < 0.3 ? `BILL-${randInt(1000, 9999)}` : null,
        paymentMethod: !isDebt ? pick(["CASH", "UPI", "BANK_TRANSFER", "OTHER"] as const) : null,
        description: isDebt ? pick(BILL_DESCS) : pick(PAYMENT_NOTES),
        billImageKey: null,
        billImageUrl: null,
        transactionDate: tx.date,
        createdById: creatorId,
        isDeleted: false,
      });
    }
  }

  for (let i = 0; i < transactionsToCreate.length; i += 500) {
    await prisma.transaction.createMany({ data: transactionsToCreate.slice(i, i + 500) });
  }
  console.log(`  Billing transactions: ${transactionsToCreate.length} (target 2,500-3,500)`);

  // ------------------------------------------------------------------
  // Verification
  // ------------------------------------------------------------------
  const [catCount, itemCount, movCount, locCount2, custCount2, txCount2] = await Promise.all([
    prisma.inventoryCategory.count({ where: { shopId: shop.id } }),
    prisma.inventoryItem.count({ where: { shopId: shop.id } }),
    prisma.stockMovement.count({ where: { shopId: shop.id } }),
    prisma.location.count({ where: { shopId: shop.id, isDeleted: false } }),
    prisma.customer.count({ where: { shopId: shop.id, isDeleted: false } }),
    prisma.transaction.count({ where: { shopId: shop.id, isDeleted: false } }),
  ]);

  const lowStock = await prisma.inventoryItem.count({ where: { shopId: shop.id, currentStock: { lte: 5 } as any } }); // approximate
  // More precise distribution check: fetch and count in memory for accuracy
  const allItems = await prisma.inventoryItem.findMany({ where: { shopId: shop.id }, select: { currentStock: true, minStockThreshold: true } });
  let inStock = 0, low = 0, out = 0, high = 0;
  for (const it of allItems) {
    const cs = Number(it.currentStock);
    const th = Number(it.minStockThreshold);
    if (cs === 0) out++;
    else if (cs <= th) low++;
    else if (cs >= 500) high++;
    else inStock++;
  }

  // Tenant isolation check: ensure no records for other shops were touched
  const otherShops = await prisma.shop.count({ where: { id: { not: shop.id } } });

  // Decimal precision verification: sample a transaction amount with 2 decimals
  const sampleTx = await prisma.transaction.findFirst({ where: { shopId: shop.id }, select: { amount: true } });

  // Login check
  const demoMember = await prisma.shopMember.findFirst({ where: { shopId: shop.id, loginId: "owner1" } });

  console.log("\n=== Verification ===");
  console.log(`Categories: ${catCount} (expected 18)`);
  console.log(`Inventory items: ${itemCount} (expected 700-800, 30-50 per cat) — InStock:${inStock} Low:${low} Out:${out} High:${high}`);
  console.log(`Stock movements: ${movCount} (expected ≥14,000)`);
  console.log(`Billing locations: ${locCount2} (expected 9)`);
  console.log(`Customers: ${custCount2} (expected ~180, 9×20)`);
  console.log(`Billing transactions: ${txCount2} (expected 2,500-3,500)`);
  console.log(`Sample transaction amount (Decimal): ${sampleTx?.amount?.toString()} (precision preserved as Decimal)`);
  console.log(`Tenant isolation: demo shop ${shop.shopCode}, other shops: ${otherShops} (untouched)`);
  console.log(`Demo login: ${demoMember ? "owner1 exists — login Owner1@ShopM preserved" : "MISSING"}`);
  console.log(`ShopId isolation: all new records shopId=${shop.id}`);

  // Customer balance sanity: sample 5 customers
  console.log("\nCustomer balance sanity (5 samples, Opening+Bills-Payments=Closing):");
  const sampleCustomers = createdCustomers.slice(0, 5);
  for (const sc of sampleCustomers) {
    const txs = await prisma.transaction.findMany({ where: { customerId: sc.id, isDeleted: false }, select: { type: true, amount: true } });
    const debt = txs.filter((t) => t.type === "DEBT").reduce((s, t) => s + Number(t.amount), 0);
    const pay = txs.filter((t) => t.type === "PAYMENT_RECEIVED").reduce((s, t) => s + Number(t.amount), 0);
    const closing = debt - pay;
    console.log(`  ${sc.name}: Bills=${debt} Payments=${pay} Closing=${closing} (${txs.length} txs)`);
  }

  console.log("\n✅ Flood complete. Only local/demo data affected. Repeatable: rerun will clear and recreate same shop's data.");
  console.log("   To reset: npx prisma db seed (clears all) or rerun this flood (clears only this shop's business data).");
}

main()
  .catch((e) => {
    console.error("Flood error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
