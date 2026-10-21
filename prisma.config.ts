import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
    // Só o `migrate dev` precisa dela; em produção (`migrate deploy`) não existe.
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
});
