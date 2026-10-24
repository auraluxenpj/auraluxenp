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

const PLACEHOLDER = "/images/placeholder-product.jpg";

// Sale price wins whenever it is a real discount.
export function stylistCartPrice(p: Pick<Product, "price" | "sale_price">): number {
  return p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price);
}

export function stylistCartItem(p: Product): StylistCartItem | null {
  if (!Number.isFinite(p.stock) || p.stock <= 0) return null; // never bag a piece we cannot sell
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images?.[0] ?? PLACEHOLDER,
    price: stylistCartPrice(p),
    size: p.sizes?.[0] ?? null,
    color: p.colors?.[0] ?? null,
    quantity: 1,
  };
}

export function stylistCartItems(picks: StylistPickLike[]): StylistCartItem[] {
  const items: StylistCartItem[] = [];
  for (const { product } of picks) {
    const item = stylistCartItem(product);
    if (item) items.push(item);
  }
  return items;
}
