import { describe, expect, it } from "vitest";
import { sizeStockLabel, sizeStocks, stockForSize } from "./size-stock";

const variants = [
  { size: "S", color: "Red", stock: 2 },
  { size: "S", color: "Blue", stock: 1 },
  { size: "M", color: "Red", stock: 0 },
  { size: "M", color: "Blue", stock: 3 },
  { size: null, color: "Red", stock: 9 },
];

describe("stockForSize", () => {
  it("sums stock across colours for a size", () => {
    expect(stockForSize(variants, "S")).toBe(3);
    expect(stockForSize(variants, "M")).toBe(3);
  });

  it("matches sizes case-insensitively", () => {
    expect(stockForSize(variants, "s")).toBe(3);
    expect(stockForSize(variants, " m ")).toBe(3);
  });

  it("returns the exact size + colour stock when a colour is given", () => {
    expect(stockForSize(variants, "S", "blue")).toBe(1);
    expect(stockForSize(variants, "M", "red")).toBe(0);
  });

  it("does not count colour-less variants toward a colour-specific pick", () => {
    expect(stockForSize(variants, "M", "green")).toBe(0);
  });

  it("returns 0 for unknown sizes", () => {
    expect(stockForSize(variants, "XL")).toBe(0);
  });
});

describe("sizeStocks", () => {
  it("maps every listed size to its summed stock", () => {
    expect(sizeStocks({ sizes: ["S", "M", "L"], stock: 5 }, variants)).toEqual([
      { size: "S", stock: 3 },
      { size: "M", stock: 3 },
      { size: "L", stock: 0 },
    ]);
  });

  it("falls back to product-level stock when no variants exist", () => {
    expect(sizeStocks({ sizes: ["S", "M"], stock: 5 }, [])).toBeNull();
  });

  it("falls back when no variant row carries a size", () => {
    expect(
      sizeStocks({ sizes: ["S", "M"], stock: 5 }, [{ size: null, color: "Red", stock: 9 }]),
    ).toBeNull();
  });

  it("falls back when the product lists no sizes", () => {
    expect(sizeStocks({ sizes: [], stock: 5 }, variants)).toBeNull();
  });
});

describe("sizeStockLabel", () => {
  it("labels sold-out, low and unknown stock", () => {
    expect(sizeStockLabel({ size: "M", stock: 0 })).toBe("Sold out");
    expect(sizeStockLabel({ size: "M", stock: 2 })).toBe("2 left");
    expect(sizeStockLabel({ size: "M", stock: null })).toBe("");
  });
});
