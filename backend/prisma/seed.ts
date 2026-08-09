import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.rateConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, wash_and_fold: 500, iron_only: 200 },
  });
  console.log("Seeded RateConfig (wash_and_fold=500, iron_only=200).");

  // Business contact number defaults to the BUSINESS_PHONE env var. `update: {}`
  // never overwrites a value the operator already saved from the Settings screen.
  await prisma.setting.upsert({
    where: { key: "business_phone" },
    update: {},
    create: { key: "business_phone", value: process.env.BUSINESS_PHONE ?? "" },
  });
  console.log("Seeded Setting business_phone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
