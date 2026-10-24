import { describe, expect, it } from "vitest";
import { buildProductSku, isProductSku, splitProductSku, skuTypeForProduct } from "./product-information";

describe("AURALUXE SKU rules", () => {
  it("starts with AL, includes the garment type and retains the admin identifier", () => {
    expect(buildProductSku("KURTI", "007")).toBe("AL-KURTI-007");
  });
  it("requires the admin to fill the final identifier", () => {
    expect(() => buildProductSku("DRESS", "")).toThrow();
  });
  it("preserves the last part of a legacy SKU for editing", () => {
    expect(splitProductSku("AL-PW-660", "Silk Palazzo Set")).toEqual({ kind: "PALAZZO-SET", suffix: "660" });
  });
  it("round trips a multi-word garment type", () => {
    expect(splitProductSku("AL-CO-ORD-SET-A12", "")).toEqual({ kind: "CO-ORD-SET", suffix: "A12" });
  });
  it("rejects identifiers without the garment type or admin suffix", () => {
    expect(isProductSku("AL-1")).toBe(false);
    expect(isProductSku("AL-DRESS-")).toBe(false);
    expect(isProductSku("AL-DRESS-123")).toBe(true);
  });
  it("uses the garment rather than a merchandising category", () => {
    expect(skuTypeForProduct("Blue Silk Saree", "New Arrivals")).toBe("SAREE");
  });
});