import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

// Reuse Prisma client across requests (both dev and production)
const prisma = global.prismaGlobal ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
});

// Cache the client globally to prevent creating new connections
if (!global.prismaGlobal) {
  global.prismaGlobal = prisma;
}

export default prisma;
