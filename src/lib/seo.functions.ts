import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicSeoProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | string;
  sale_price: number | string | null;
  stock: number;
  sku: string | null;
  images: string[] | null;
  meta_title: string | null;
  meta_description: string | null;
  updated_at: string;
  categories: { name: string; slug: string } | null;
};

export const getPublicProductSeo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.string().trim().min(1).max(180).parse(input))
  .handler(async ({ data: slug }): Promise<PublicSeoProduct | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("products")
      .select(
        "id,name,slug,description,price,sale_price,stock,sku,images,meta_title,meta_description,updated_at,categories(name,slug)",
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();

    if (error) {
      console.error("[seo] Product metadata lookup failed", error);
      throw new Error("Product metadata is temporarily unavailable");
    }

    if (!data) return null;
    const category = Array.isArray(data.categories) ? data.categories[0] : data.categories;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      price: data.price,
      sale_price: data.sale_price,
      stock: data.stock,
      sku: data.sku,
      images: Array.isArray(data.images) ? data.images : [],
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      updated_at: data.updated_at,
      categories: category?.name && category?.slug
        ? { name: category.name, slug: category.slug }
        : null,
    };
  });
