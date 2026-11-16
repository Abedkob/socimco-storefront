import { checkSeedIntegrity, RAW_SEED, Seed } from "../src/core/mock-backend/seed";

const parsed = Seed.safeParse(structuredClone(RAW_SEED));

if (!parsed.success) {
  console.error("Seed data does not match the contract schemas:");
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}

const issues = checkSeedIntegrity(parsed.data);
if (issues.length > 0) {
  console.error("Seed data failed integrity checks:");
  for (const issue of issues) console.error(`  ${issue}`);
  process.exit(1);
}

const s = parsed.data;
console.log(
  `Seed OK: ${s.users.length} users, ${s.categories.length} categories, ${s.products.length} products, ` +
    `${s.negotiations.length} negotiations, ${s.orders.length} orders.`,
);
