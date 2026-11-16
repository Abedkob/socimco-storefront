import { describe, expect, it } from "vitest";
import { checkSeedIntegrity, loadSeed } from "./seed";

describe("seed data", () => {
  it("passes schema and integrity checks", () => {
    expect(checkSeedIntegrity(loadSeed())).toEqual([]);
  });

  it("reports broken references, wrong totals and fixture drift", () => {
    const seed = loadSeed();
    seed.products[0].categoryId = "cat_missing";
    seed.products[0].priceCents = 9999;
    seed.orders[0].totalCents += 1;
    seed.orders[1].negotiationId = "neg_missing";
    seed.categories.push({ ...seed.categories[0] });

    const issues = checkSeedIntegrity(seed);
    expect(issues).toEqual(
      expect.arrayContaining([
        "Product prd_drill_18v has unknown category cat_missing",
        "Reference product prd_drill_18v doesn't match the reference scenario",
        "Order ord_1001 totalCents is 37001, expected 37000",
        "Order ord_1002 references unknown negotiation neg_missing",
        "Duplicate category id: cat_power",
      ]),
    );
  });
});
