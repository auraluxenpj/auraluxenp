// Turns AI stylist picks into bag items. Kept free of database imports so the
// rules stay unit-testable.
import type { Product } from "./data";

export type StylistPickLike = { product: Product };

export type StylistCartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
  size: string | null;
  color: string | null;
  quantity: number;
};

// Shopper-chosen options per product id (used by "Add all to bag").
export type StylistSelections = Record<string, { size?: string | null; color?: string | null }>;

const PLACEHOLDER = "/images/placeholder-product.jpg";

// Sale price wins whenever it is a real discount.
export function stylistCartPrice(p: Pick<Product, "price" | "sale_price">): number {
  return p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price);
}

// A chosen option only counts when the product actually offers it; otherwise
// fall back to the first listed option so a stale selection cannot sneak in.
function pickOption(list: string[] | null | undefined, chosen?: string | null): string | null {
  const options = (list ?? []).filter(Boolean);
  if (!options.length) return null;
  return chosen && options.includes(chosen) ? chosen : (options[0] ?? null);
}

export function stylistCartItem(
  p: Product,
  opts?: { size?: string | null; color?: string | null },
): StylistCartItem | null {
  if (!Number.isFinite(p.stock) || p.stock <= 0) return null; // never bag a piece we cannot sell
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0] ?? PLACEHOLDER,
    price: stylistCartPrice(p),
    size: pickOption(p.sizes, opts?.size),
    color: pickOption(p.colors, opts?.color),
    quantity: 1,
  };
}

export function stylistCartItems(picks: StylistPickLike[], selections?: StylistSelections): StylistCartItem[] {
  const items: StylistCartItem[] = [];
  for (const { product } of picks) {
    const item = stylistCartItem(product, selections?.[product.id]);
    if (item) items.push(item);
  }
  return items;
}
