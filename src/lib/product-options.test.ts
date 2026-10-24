import { describe, expect, it } from "vitest";
import { requiredOptionLabels } from "./product-options";
import type { Product } from "./data";

const product = (over: Partial<Product> = {}): Product =>
  ({
    id: "p1",
    slug: "silk-kurti",
    name: "Silk Kurti",
    price: 4500,
    sale_price: null,
    stock: 3,
    images: [],
    sizes: ["S", "M", "L"],
    colors: ["Ivory", "Purple"],
    ...over,
  }) as Product;

describe("cart option requirements", () => {
  it("blocks add-to-bag until a size is chosen when several exist", () => {
    expect(requiredOptionLabels(product({ colors: ["Ivory"] }), null, "Ivory")).toEqual(["size"]);
  });

  it("blocks add-to-bag until a colour is chosen when several exist", () => {
    expect(requiredOptionLabels(product({ sizes: ["M"] }), "M", null)).toEqual(["colour"]);
  });

  it("asks for neither when the product has one size and one colour", () => {
    const single = product({ sizes: ["M"], colors: ["Ivory"] });
    expect(requiredOptionLabels(single, null, null)).toEqual([]);
  });

  it("asks for nothing once every option is selected", () => {
    expect(requiredOptionLabels(product(), "M", "Purple")).toEqual([]);
  });

  it("returns both labels when nothing has been chosen", () => {
    expect(requiredOptionLabels(product(), null, null)).toEqual(["size", "colour"]);
  });
});
