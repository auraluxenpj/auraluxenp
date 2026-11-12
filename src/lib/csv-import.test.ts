// @ts-nocheck
import { describe, expect, it } from "vitest";
import { mapRows, matchProduct, parseCsv } from "./csv-import";

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

describe("model code", () => {
  const products = [
    { id: "1", sku: "AL-KURTI-001", slug: "a", model_code: "M100" },
    { id: "2", sku: "AL-KURTI-002", slug: "b", model_code: "M100" },
    { id: "3", sku: "AL-PW-678", slug: "c", model_code: null },
    { id: "4", sku: "AL-PW-678", slug: "d", model_code: null },
    { id: "5", sku: "AL-TOP-001", slug: "e", model_code: "M200" },
  ];
  it("reads the Model Code column and trims it", () => {
    const [r] = mapRows(parseCsv("Name,SKU,Model Code,Price\nA,AL-1, M100 ,10"), cats);
    expect(r.data.model_code).toBe("M100");
  });
  it("old sheets without the column still map the same", () => {
    const [r] = mapRows(parseCsv("Name,SKU,Price\nA,AL-1,10"), cats);
    expect("model_code" in r.data).toBe(false);
  });
  it("matches by SKU, ignoring case and spaces", () => {
    expect(matchProduct(products, { sku: " al-top-001 " })).toMatchObject({ kind: "match", by: "sku", product: { id: "5" } });
  });
  it("matches by model code when it is unique", () => {
    expect(matchProduct(products, { model_code: "m200" })).toMatchObject({ kind: "match", by: "model_code", product: { id: "5" } });
  });
  it("skips a model code shared by several products", () => {
    expect(matchProduct(products, { model_code: "M100" })).toEqual({ kind: "ambiguous", by: "model_code", count: 2 });
  });
  it("lets the SKU resolve a shared model code", () => {
    expect(matchProduct(products, { sku: "AL-KURTI-002", model_code: "M100" })).toMatchObject({ kind: "match", product: { id: "2" } });
  });
  it("skips a duplicated SKU instead of guessing", () => {
    expect(matchProduct(products, { sku: "AL-PW-678" })).toEqual({ kind: "ambiguous", by: "sku", count: 2 });
  });
  it("returns none when nothing matches", () => {
    expect(matchProduct(products, { sku: "NOPE", model_code: "ZZZ" })).toEqual({ kind: "none" });
  });
});
