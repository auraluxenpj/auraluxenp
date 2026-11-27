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


export type PublicSeoCollection = {
  category: {
    id: string;
    name: string;
    name_ne: string | null;
    slug: string;
    description: string | null;
    description_ne: string | null;
    image_url: string | null;
    updated_at: string;
  };
  products: import("@/lib/data").StorefrontProduct[];
};

export const getPublicCollectionSeo = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.string().trim().min(1).max(180).regex(/^[a-z0-9-]+$/i).parse(input))
  .handler(async ({ data: slug }): Promise<PublicSeoCollection | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: category, error: categoryError } = await db
      .from("categories")
      .select("id,name,name_ne,slug,description,description_ne,image_url,updated_at,is_active")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (categoryError) {
      console.error("[seo] Collection lookup failed", categoryError);
      throw new Error("Collection metadata is temporarily unavailable");
    }
    if (!category) return null;

    const { data: products, error: productsError } = await db
      .from("products")
      .select("id,name,name_ne,slug,category_id,price,sale_price,stock,sizes,colors,images,fabric,fabric_ne,description,description_ne,is_new,is_featured,is_bestseller,is_published,created_at")
      .eq("category_id", category.id)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(100);

    if (productsError) {
      console.error("[seo] Collection products lookup failed", productsError);
      throw new Error("Collection products are temporarily unavailable");
    }
    if (!products?.length) return null;

    return {
      category: {
        id: category.id,
        name: category.name,
        name_ne: category.name_ne,
        slug: category.slug,
        description: category.description,
        description_ne: category.description_ne,
        image_url: category.image_url,
        updated_at: category.updated_at,
      },
      products: products as import("@/lib/data").StorefrontProduct[],
    };
  });
