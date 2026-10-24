import { describe, expect, it } from "vitest";
import { categoryCanDelete, categorySchema, moveCategory } from "./category-management";

describe("category management", () => {
  it("moves a category up without losing other categories", () => {
    expect(moveCategory(["kurtis", "suits", "dresses"], "suits", -1)).toEqual(["suits", "kurtis", "dresses"]);
  });
  it("moves a category down", () => {
    expect(moveCategory(["kurtis", "suits", "dresses"], "suits", 1)).toEqual(["kurtis", "dresses", "suits"]);
  });
  it("keeps boundary and unknown moves unchanged", () => {
    expect(moveCategory(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveCategory(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveCategory(["a", "b"], "missing", 1)).toEqual(["a", "b"]);
  });
  it("does not delete a category used by products", () => {
    expect(categoryCanDelete(1, 0)).toBe(false);
  });
  it("does not delete a category used by coupons", () => {
    expect(categoryCanDelete(0, 1)).toBe(false);
  });
  it("allows deleting an unused category", () => {
    expect(categoryCanDelete(0, 0)).toBe(true);
  });
  it("rejects blank category names and invalid URL names", () => {
    expect(categorySchema.safeParse({ name: " ", slug: "kurtis", description: "", is_active: true }).success).toBe(false);
    expect(categorySchema.safeParse({ name: "Kurtis", slug: "../Kurtis", description: "", is_active: true }).success).toBe(false);
  });
});