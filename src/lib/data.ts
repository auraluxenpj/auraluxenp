import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;

// Small, public-facing product shape used by storefront listings. Keep full
// product records for admin and product-detail queries where they are needed.
export type StorefrontProduct = Pick<
  Product,
  | "id"
  | "name"
  | "name_ne"
  | "slug"
  | "category_id"
  | "price"
  | "sale_price"
  | "stock"
  | "sizes"
  | "colors"
  | "images"
  | "fabric"
  | "fabric_ne"
  | "description"
  | "description_ne"
  | "is_new"
  | "is_featured"
  | "is_bestseller"
  | "is_published"
  | "created_at"
>;
export type Category = Tables<"categories">;
export type Banner = Tables<"banners">;
export type Review = Tables<"reviews">;
export type Page = Tables<"pages">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type Coupon = Tables<"coupons">;
export type ProductVariant = Tables<"product_variants">;

export type SettingsMap = Record<string, string>;

export const DEFAULT_SETTINGS: SettingsMap = {
  brand_name: "AURALUXE",
  currency: "NPR",
  shipping_charge: "150",
  free_shipping_threshold: "3500",
  tax_percent: "0",
};

export function isMissingBilingualCatalogueColumn(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error &&
    (error.code === "PGRST204" || error.code === "42703") &&
    ["name_ne", "description_ne", "fabric_ne"].some((field) => error.message?.includes(field));
}

export const BILINGUAL_MIGRATION_REQUIRED =
  "Nepali catalogue fields are not available in the connected database yet. Apply the bilingual catalogue migration before saving Nepali product or category content. Your changes were not saved.";

export async function fetchSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase.from("site_settings").select("key, value");
  if (error) throw error;
  const map: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of data ?? []) map[row.key] = row.value ?? "";
  return map;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProducts(): Promise<StorefrontProduct[]> {
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, name, name_ne, slug, category_id, price, sale_price, stock, sizes, colors, images, fabric, fabric_ne, description, description_ne, is_new, is_featured, is_bestseller, is_published, created_at",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (!error) return data ?? [];

  // Keep the English storefront usable while an older database is waiting for
  // the additive bilingual migration. Do not mask unrelated API or network errors.
  const missingBilingualField =
    (error.code === "PGRST204" || error.code === "42703") &&
    ["name_ne", "description_ne", "fabric_ne"].some((field) => error.message.includes(field));

  if (!missingBilingualField) throw error;

  const legacy = await supabase
    .from("products")
    .select(
      "id, name, slug, category_id, price, sale_price, stock, sizes, colors, images, fabric, description, is_new, is_featured, is_bestseller, is_published, created_at",
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (legacy.error) throw legacy.error;

  return (legacy.data ?? []).map((product) => ({
    ...product,
    name_ne: null,
    description_ne: null,
    fabric_ne: null,
  }));
}

export async function fetchAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProductBySlug(slug: string): Promise<Product | null> {
  const { data, error } = await supabase.from("products").select("*").eq("slug", slug).eq("is_published", true).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchVariantsForProduct(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from("product_variants")
    .select("*")
    .eq("product_id", productId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchBanners(placement?: string): Promise<Banner[]> {
  let q = supabase.from("banners").select("*").order("sort_order", { ascending: true });
  if (placement) q = q.eq("placement", placement);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchTestimonials(): Promise<Review[]> {
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("is_testimonial", true)
    .eq("is_approved", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPage(slug: string): Promise<Page | null> {
  const { data, error } = await supabase.from("pages").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export { effectivePrice, hasDiscount } from "./pricing";

export function bannerIsLive(b: Banner): boolean {
  if (!b.is_active) return false;
  const now = Date.now();
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return false;
  if (b.ends_at && new Date(b.ends_at).getTime() < now) return false;
  return true;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const DEFAULT_PRODUCT_PLACEHOLDER =
  "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=1000&q=82";

export function productImages(p: Pick<Product, "images">): string[] {
  // The Unsplash image above is a temporary catalogue placeholder. If a real
  // product photo is later added to the same product, prefer it even when the
  // old placeholder remains earlier in the images array.
  return (p.images ?? []).filter(
    (image): image is string =>
      Boolean(image?.trim()) && !image.includes("photo-1610030469983"),
  );
}

export function productImage(p: Pick<Product, "images">): string {
  return productImages(p)[0] ?? DEFAULT_PRODUCT_PLACEHOLDER;
}


export type StorefrontCollection = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  products: StorefrontProduct[];
};

type CollectionJoinRow = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  storefront_collection_products?: {
    sort_order: number;
    products: StorefrontProduct | null;
  }[] | null;
};
type CollectionQueryResult = {
  data: CollectionJoinRow[] | null;
  error: { code?: string } | null;
};
type CollectionQuery = {
  select: (columns: string) => CollectionQuery;
  eq: (column: string, value: unknown) => CollectionQuery;
  order: (column: string, options: { ascending: boolean }) => Promise<CollectionQueryResult>;
};

/** Active storefront collections; RLS excludes expired collections and unavailable products. */
export async function fetchStorefrontCollections(): Promise<StorefrontCollection[]> {
  const client = supabase as unknown as { from: (table: string) => CollectionQuery };
  const { data, error } = await client
    .from("storefront_collections")
    .select("id, name, description, sort_order, storefront_collection_products(sort_order, products(id, name, name_ne, slug, category_id, price, sale_price, stock, sizes, colors, images, fabric, fabric_ne, description, description_ne, is_new, is_featured, is_bestseller, is_published, created_at))")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return [];
    throw error;
  }
  return (data ?? []).map((collection) => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    sort_order: collection.sort_order,
    products: (collection.storefront_collection_products ?? [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((entry) => entry.products)
      .filter((product): product is StorefrontProduct => Boolean(product && product.is_published && Number(product.stock) > 0)),
  })).filter((collection) => collection.products.length > 0);
}
