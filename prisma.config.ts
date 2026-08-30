import { defineConfig } from "@prisma/config";
import "dotenv/config";

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "npx tsx ./prisma/seed.ts",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://ankitraj@localhost:5432/shopm?schema=public",
  },
});
