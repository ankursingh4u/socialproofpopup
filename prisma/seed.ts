import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  console.log("Database seed: No seed data needed.");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
