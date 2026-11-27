import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Product } from "@/lib/data";

export type PublicSeoProduct = Product & {
  categories: { name: string; slug: string } | null;
};

export const getPublicProductSeo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.string().trim().min(1).max(180).parse(input))
  .handler(async ({ data: slug }): Promise<PublicSeoProduct | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await (supabaseAdmin as any)
      .from("products")
      .select(
        "id,name,name_ne,slug,category_id,price,sale_price,stock,sizes,colors,images,fabric,fabric_ne,description,description_ne,is_new,is_featured,is_bestseller,is_published,created_at,updated_at,meta_title,meta_description,sku,size_chart,low_stock_threshold,model_code,categories(name,slug)",
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
      name_ne: data.name_ne,
      slug: data.slug,
      category_id: data.category_id,
      price: data.price,
      sale_price: data.sale_price,
      stock: data.stock,
      sizes: data.sizes ?? [],
      colors: data.colors ?? [],
      images: data.images ?? [],
      fabric: data.fabric,
      fabric_ne: data.fabric_ne,
      description: data.description,
      description_ne: data.description_ne,
      is_new: data.is_new,
      is_featured: data.is_featured,
      is_bestseller: data.is_bestseller,
      is_published: data.is_published,
      created_at: data.created_at,
      updated_at: data.updated_at,
      meta_title: data.meta_title,
      meta_description: data.meta_description,
      sku: data.sku,
      size_chart: data.size_chart,
      low_stock_threshold: data.low_stock_threshold,
      model_code: data.model_code,
      categories: category?.name && category?.slug
        ? { name: category.name, slug: category.slug }
        : null,
    };
  });
