import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.rateConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, wash_and_fold: 500, iron_only: 200 },
  });
  console.log("Seeded RateConfig (wash_and_fold=500, iron_only=200).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
