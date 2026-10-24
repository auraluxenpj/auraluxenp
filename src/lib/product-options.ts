import type { Product } from "./data";

/**
 * Returns the option labels the shopper still has to choose before an item
 * may go into the bag. Products with a single size or colour never require
 * that choice — it is applied automatically.
 */
export function requiredOptionLabels(
  product: Product,
  size: string | null,
  color: string | null,
): string[] {
  const missing: string[] = [];
  if ((product.sizes?.length ?? 0) > 1 && !size) missing.push("size");
  if ((product.colors?.length ?? 0) > 1 && !color) missing.push("colour");
  return missing;
}
