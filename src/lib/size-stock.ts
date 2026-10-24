import type { Product } from "./data";

export type VariantStockRow = { size: string | null; color: string | null; stock: number };

export type SizeStock = { size: string; stock: number | null };

/**
 * Total stock held for a size, summed over every colour variant. When a
 * colour is given, only variants carrying that colour are counted, so the
 * result is the stock of that exact size + colour combination.
 */
export function stockForSize(
  variants: VariantStockRow[],
  size: string,
  color?: string | null,
): number {
  const target = size.trim().toLowerCase();
  const colorTarget = color ? color.trim().toLowerCase() : null;
  return variants.reduce((sum, v) => {
    if (!v.size || v.size.trim().toLowerCase() !== target) return sum;
    // Rows without a colour hold colour-agnostic stock, so they count toward
    // any colour the shopper picks.
    if (colorTarget && v.color && v.color.trim().toLowerCase() !== colorTarget) return sum;
    return sum + (Number(v.stock) || 0);
  }, 0);
}

/**
 * Per-size stock for a product's listed sizes, or null when the shop should
 * fall back to the product-level stock figure (no variants tracked, or no
 * variant row carries a size). A listed size with no variant rows is sold out.
 */
export function sizeStocks(
  product: Pick<Product, "sizes" | "stock">,
  variants: VariantStockRow[],
): SizeStock[] | null {
  const sizes = product.sizes ?? [];
  if (!variants.length || !sizes.length) return null;
  if (!variants.some((v) => v.size && v.size.trim())) return null;
  return sizes.map((s) => ({ size: s, stock: stockForSize(variants, s) }));
}

export function sizeStockLabel(entry: SizeStock): string {
  if (entry.stock == null) return "";
  if (entry.stock <= 0) return "Sold out";
  return `${entry.stock} left`;
}
