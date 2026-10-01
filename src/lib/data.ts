import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Product = Tables<"products">;
export type Category = Tables<"categories">;
export type Banner = Tables<"banners">;
export type Review = Tables<"reviews">;
export type Page = Tables<"pages">;
export type Order = Tables<"orders">;
export type OrderItem = Tables<"order_items">;
export type Coupon = Tables<"coupons">;

export type SettingsMap = Record<string, string>;

export const DEFAULT_SETTINGS: SettingsMap = {
  brand_name: "AURALUXE",
  currency: "Rs.",
  shipping_charge: "150",
  free_shipping_threshold: "3500",
  tax_percent: "0",
};

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

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
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
  const { data, error } = await supabase.from("products").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
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

export function effectivePrice(p: Pick<Product, "price" | "sale_price">): number {
  return p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price);
}

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

export function productImage(p: Pick<Product, "images">): string {
  return p.images?.[0] ?? "/images/placeholder-product.jpg";
}
