import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const isDev = process.env.NODE_ENV !== "production";

// O Postgres local do `prisma dev` derruba ligações quando recebe muitas em simultâneo,
// por isso o tamanho do pool é configurável. Sem a variável vale o padrão do driver (10).
const poolMax = Number(process.env.DATABASE_POOL_MAX) || undefined;

// O `prisma dev` também fecha as ligações abertas quando outro processo (seed, migrate, studio)
// se liga a ele. Em desenvolvimento, uma leitura que apanhe uma ligação morta repete-se uma vez,
// já com uma ligação nova. Escritas nunca se repetem: podiam ficar gravadas duas vezes.
const READS = new Set(["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"]);

function isDroppedConnection(error: unknown) {
  const text = `${(error as { code?: string })?.code ?? ""} ${error instanceof Error ? error.message : ""}`;
  return /P1017|Connection terminated|closed the connection|ConnectionClosed/.test(text);
}

function createClient() {
  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: poolMax }),
  });
  if (!isDev) return client;
  return client.$extends({
    query: {
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!READS.has(operation) || !isDroppedConnection(error)) throw error;
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Em desenvolvimento o hot reload recriaria o cliente a cada mudança e esgotaria as conexões.
export const prisma = globalForPrisma.prisma ?? createClient();

if (isDev) globalForPrisma.prisma = prisma;
