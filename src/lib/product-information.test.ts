import { describe, expect, it } from "vitest";
import { buildProductSku, isProductSku, splitProductSku, skuTypeForProduct } from "./product-information";

describe("AURALUXE SKU rules", () => {
  it("starts with AL, includes the garment letter and retains the admin identifier", () => {
    expect(buildProductSku("K", "007")).toBe("AL-K-007");
  });
  it("requires the admin to fill the final identifier", () => {
    expect(() => buildProductSku("D", "")).toThrow();
  });
  it("keeps the garment letter already used in the catalogue", () => {
    expect(splitProductSku("AL-PW-660", "Silk Palazzo Set")).toEqual({ kind: "PW", suffix: "660" });
  });
  it("round trips a short garment letter", () => {
    expect(splitProductSku("AL-CO-A12", "")).toEqual({ kind: "CO", suffix: "A12" });
  });
  it("repairs a code typed with a stray space instead of losing the number", () => {
    expect(splitProductSku("AL- CO-665", "Modern Brown French Crepe Co Ord Set")).toEqual({ kind: "CO", suffix: "665" });
  });
  it("rejects identifiers without the garment letter or admin suffix", () => {
    expect(isProductSku("AL-1")).toBe(false);
    expect(isProductSku("AL-D-")).toBe(false);
    expect(isProductSku("AL-D-123")).toBe(true);
  });
  it("accepts every code already in the catalogue", () => {
    for (const sku of ["AL-PW-660", "AL-CO-662", "AL-S-696"]) expect(isProductSku(sku)).toBe(true);
  });
  it("uses the garment rather than a merchandising category", () => {
    expect(skuTypeForProduct("Blue Silk Saree", "New Arrivals")).toBe("S");
  });
});
