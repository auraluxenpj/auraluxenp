import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name").max(100),
  slug: z.string().trim().min(1, "Enter a URL name").max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  description: z.string().trim().max(2000),
  is_active: z.boolean(),
});

export function moveCategory(ids: string[], id: string, direction: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return ids;
  const next = [...ids];
  const other = next[to];
  if (other === undefined) return ids;
  next[from] = other;
  next[to] = id;
  return next;
}

export function categoryCanDelete(productCount: number, couponCount: number): boolean {
  return productCount === 0 && couponCount === 0;
}