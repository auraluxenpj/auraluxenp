import { describe, expect, it } from "vitest";
import { mapRows, parseCsv } from "./csv-import";

const cats = [{ id: "c1", name: "Kurtis", slug: "kurtis" }];

describe("csv import", () => {
  it("parses quoted cells", () => {
    expect(parseCsv('a,b\n"x, y","say ""hi"""')).toEqual([["a", "b"], ["x, y", 'say "hi"']]);
  });
  it("maps exported columns and category by name", () => {
    const [r] = mapRows(parseCsv("Name,SKU,Price,Stock,Sizes,Category,Featured\nMeera,AL-1,2500,4,S | M,Kurtis,Yes"), cats);
    expect(r.data).toMatchObject({ name: "Meera", sku: "AL-1", price: 2500, stock: 4, sizes: ["S", "M"], category_id: "c1", is_featured: true, slug: "meera" });
  });
  it("rejects negative stock and unknown category", () => {
    const rows = mapRows(parseCsv("Name,Stock,Category\nA,-1,\nB,2,Hats"), cats);
    expect(rows[0].error).toMatch(/stock/);
    expect(rows[1].error).toMatch(/Hats/);
  });
});
