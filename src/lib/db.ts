import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// O Postgres local do `prisma dev` derruba ligações quando recebe muitas em simultâneo,
// por isso o tamanho do pool é configurável. Sem a variável vale o padrão do driver (10).
const poolMax = Number(process.env.DATABASE_POOL_MAX) || undefined;

// Em desenvolvimento o hot reload recriaria o cliente a cada mudança e esgotaria as conexões.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: poolMax }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
