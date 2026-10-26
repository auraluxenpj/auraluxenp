import { describe, expect, it } from "vitest";
import { sanitizeSmartDraft } from "./smart-upload";

const cats = [
  { id: "c1", name: "Kurtis" },
  { id: "c2", name: "Dresses" },
];

describe("sanitizeSmartDraft", () => {
  it("keeps a valid category and garment kind", () => {
    const d = sanitizeSmartDraft(
      {
        description: "A soft cotton kurti.",
        meta_title: "Meera Kurti",
        meta_description: "Soft cotton kurti for everyday wear.",
        fabric: "Cotton",
        category_id: "c1",
        sizes: ["S", "M", "L"],
        colors: ["Maroon"],
        sku_kind: "k",
      },
      cats,
    );
    expect(d).toMatchObject({
      description: "A soft cotton kurti.",
      category_id: "c1",
      sizes: ["S", "M", "L"],
      colors: ["Maroon"],
      sku_kind: "K",
    });
  });

  it("rejects unknown category ids and garment kinds", () => {
    const d = sanitizeSmartDraft({ category_id: "nope", sku_kind: "XX" }, cats);
    expect(d.category_id).toBeNull();
    expect(d.sku_kind).toBe("OTH");
  });

  it("drops non-string values, dedupes lists and clamps lengths", () => {
    const d = sanitizeSmartDraft(
      {
        description: 42,
        sizes: ["S", "s", "M", 7, null],
        colors: ["Red", "RED", "Blue"],
        meta_title: "x".repeat(200),
      },
      cats,
    );
    expect(d.description).toBe("");
    expect(d.sizes).toEqual(["S", "M"]);
    expect(d.colors).toEqual(["Red", "Blue"]);
    expect(d.meta_title.length).toBeLessThanOrEqual(70);
  });
});
