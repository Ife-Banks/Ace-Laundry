import { createApp } from "./app.js";
import { env } from "./lib/env.js";
import { prisma } from "./lib/db.js";
import { startReconciliation } from "./jobs/reconcilePayments.js";

async function main() {
  try {
    await prisma.$connect();
    console.log("Connected to database.");
  } catch (err) {
    console.error("Failed to connect to database.");
    console.error("Set a valid DATABASE_URL in backend/.env and run `npm run db:migrate` first.");
    process.exit(1);
  }

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`Ace Laundry API listening on http://localhost:${env.port}`);
  });

  startReconciliation();
  console.log("Payment reconciliation sweep started.");
}

main();
