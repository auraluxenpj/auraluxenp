import { describe, expect, it } from "vitest";
import { stylistCartItem, stylistCartItems } from "./stylist-cart";
import type { Product } from "./data";

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    slug: "silk-kurti",
    name: "Silk Kurti",
    price: 4500,
    sale_price: 3399,
    stock: 3,
    images: ["https://cdn.example/silk.jpg"],
    sizes: ["M", "L"],
    colors: ["Ivory"],
    ...over,
  }) as Product;

describe("stylist add-to-bag rules", () => {
  it("charges the sale price, not the list price", () => {
    expect(stylistCartItem(product())?.price).toBe(3399);
  });

  it("charges the list price when there is no sale price", () => {
    expect(stylistCartItem(product({ sale_price: null }))?.price).toBe(4500);
    expect(stylistCartItem(product({ sale_price: 0 }))?.price).toBe(4500);
  });

  it("refuses to bag a sold-out piece", () => {
    expect(stylistCartItem(product({ stock: 0 }))).toBeNull();
    expect(stylistCartItem(product({ stock: -2 }))).toBeNull();
  });

  it("skips sold-out picks and keeps the rest", () => {
    const items = stylistCartItems([
      { product: product() },
      { product: product({ id: "p2", slug: "sold-out-dress", name: "Sold Out Dress", stock: 0 }) },
      { product: product({ id: "p3", slug: "linen-set", name: "Linen Set", stock: 1 }) },
    ]);
    expect(items.map((i) => i.productId)).toEqual(["p1", "p3"]);
  });

  it("bags one piece in the first listed size and colour", () => {
    const item = stylistCartItem(product())!;
    expect(item.quantity).toBe(1);
    expect(item.size).toBe("M");
    expect(item.color).toBe("Ivory");
    expect(item.image).toBe("https://cdn.example/silk.jpg");
  });

  it("uses the placeholder photo when a product has no images", () => {
    expect(stylistCartItem(product({ images: [] }))?.image).toBe("/images/placeholder-product.jpg");
  });
});
