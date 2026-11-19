import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Migrations need a direct connection; the app itself uses the pooled one
  // (DATABASE_URL). On Neon, DIRECT_URL is the connection string without
  // "-pooler"; locally it's unset and DATABASE_URL is used for both.
  datasource: {
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
