import { createFileRoute } from "@tanstack/react-router";

const SITE_ORIGIN = "https://www.auraluxe.com.np";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validLastmod(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const db = supabaseAdmin as any;
          const [{ data: products, error: productsError }, { data: categories, error: categoriesError }] =
            await Promise.all([
              db.from("products")
                .select("slug,category_id,updated_at")
                .eq("is_published", true)
                .not("slug", "is", null)
                .order("updated_at", { ascending: false })
                .limit(5000),
              db.from("categories")
                .select("slug,id,updated_at")
                .eq("is_active", true)
                .not("slug", "is", null)
                .order("updated_at", { ascending: false })
                .limit(500),
            ]);

          if (productsError || categoriesError) {
            console.error("[sitemap] Supabase query failed", productsError ?? categoriesError);
            return new Response("Sitemap temporarily unavailable", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
            });
          }

          const entries = new Map<string, string | null>();
          for (const path of ["/", "/shop", "/about", "/contact", "/stylist"]) entries.set(path, null);

          const categoryProductCounts = new Map<string, number>();
          const categoryLastmod = new Map<string, string>();
          for (const product of products ?? []) {
            if (typeof product.slug !== "string" || !/^[a-zA-Z0-9-]+$/.test(product.slug)) continue;
            entries.set(`/shop/product/${encodeURIComponent(product.slug)}`, validLastmod(product.updated_at));
            if (product.category_id) {
              categoryProductCounts.set(product.category_id, (categoryProductCounts.get(product.category_id) ?? 0) + 1);
              if (!categoryLastmod.has(product.category_id) && validLastmod(product.updated_at)) {
                categoryLastmod.set(product.category_id, validLastmod(product.updated_at)!);
              }
            }
          }

          for (const category of categories ?? []) {
            if (
              typeof category.slug !== "string" ||
              !/^[a-zA-Z0-9-]+$/.test(category.slug) ||
              (categoryProductCounts.get(category.id) ?? 0) === 0
            ) continue;
            entries.set(
              `/collections/${encodeURIComponent(category.slug)}`,
              categoryLastmod.get(category.id) ?? validLastmod(category.updated_at),
            );
          }

          const urls = [...entries.entries()].map(([path, lastmod]) => {
            const loc = xmlEscape(new URL(path, SITE_ORIGIN).toString());
            return `  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`;
          });

          const body = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            ...urls,
            "</urlset>",
          ].join("\n");

          return new Response(body, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
              "X-Content-Type-Options": "nosniff",
            },
          });
        } catch (error) {
          console.error("[sitemap] Generation failed", error);
          return new Response("Sitemap temporarily unavailable", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
