import { describe, expect, it } from "vitest";
import { effectivePrice, hasDiscount } from "./pricing";

describe("storefront pricing", () => {
  it("recognizes a real reduction", () => {
    const product = { price: 599, sale_price: 499 };
    expect(hasDiscount(product)).toBe(true);
    expect(effectivePrice(product)).toBe(499);
  });

  it("does not advertise an unchanged price as a sale", () => {
    const product = { price: 599, sale_price: 599 };
    expect(hasDiscount(product)).toBe(false);
    expect(effectivePrice(product)).toBe(599);
  });

  it("does not treat a higher sale price as a discount", () => {
    const product = { price: 599, sale_price: 699 };
    expect(hasDiscount(product)).toBe(false);
    expect(effectivePrice(product)).toBe(599);
  });

  it("ignores null, zero and invalid sale prices", () => {
    expect(hasDiscount({ price: 599, sale_price: null })).toBe(false);
    expect(hasDiscount({ price: 599, sale_price: 0 })).toBe(false);
    expect(hasDiscount({ price: 599, sale_price: "invalid" })).toBe(false);
  });
});
