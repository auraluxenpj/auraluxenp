import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/seo")({
  head: () => ({
    meta: [
      { title: "Google Visibility — Auraluxe Admin" },
      { name: "description", content: "Review Auraluxe product SEO coverage and indexable collections." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SeoDashboard,
});

function SeoDashboard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "seo-readiness"],
    queryFn: async () => {
      const [products, categories, storeDetails] = await Promise.all([
        supabase.from("products")
          .select("id,name,slug,category_id,meta_title,meta_description,images,is_published")
          .eq("is_published", true)
          .order("name"),
        supabase.from("categories")
          .select("id,name,slug,description,is_active")
          .eq("is_active", true)
          .order("sort_order"),
        supabase.from("site_settings")
          .select("key,value")
          .in("key", ["address", "phone", "email", "store_hours", "instagram", "facebook", "tiktok"]),
      ]);
      if (products.error) throw products.error;
      if (categories.error) throw categories.error;
      if (storeDetails.error) throw storeDetails.error;
      const rows = products.data ?? [];
      const categoryRows = categories.data ?? [];
      const counts = new Map<string, number>();
      for (const product of rows) {
        if (product.category_id) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
      }
      return {
        products: rows,
        categories: categoryRows.map((category) => ({ ...category, productCount: counts.get(category.id) ?? 0 })),
        storeDetails: Object.fromEntries((storeDetails.data ?? []).map((row) => [row.key, row.value])),
      };
    },
  });

  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const storeDetails = data?.storeDetails ?? {};
  const directionsUrl = storeDetails["address"]
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(storeDetails["address"])}`
    : null;
  const withTitle = products.filter((product) => Boolean(product.meta_title?.trim())).length;
  const withDescription = products.filter((product) => Boolean(product.meta_description?.trim())).length;
  const withImage = products.filter((product) => (product.images ?? []).some((image) => Boolean(image?.trim()))).length;
  const liveCollections = categories.filter((category) => category.productCount > 0);
  const pct = (value: number) => products.length ? Math.round((value / products.length) * 100) : 0;

  const stats = [
    { label: "Published products", value: products.length },
    { label: "SEO titles", value: `${withTitle} / ${products.length}`, detail: `${pct(withTitle)}% coverage` },
    { label: "Meta descriptions", value: `${withDescription} / ${products.length}`, detail: `${pct(withDescription)}% coverage` },
    { label: "Product images", value: `${withImage} / ${products.length}`, detail: `${pct(withImage)}% coverage` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-muted-foreground">Search optimisation</p>
          <h1 className="mt-2 font-display text-3xl">Google Visibility</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">A live check of published catalogue SEO fields and indexable collection pages.</p>
        </div>
        <a href="https://search.google.com/search-console" target="_blank" rel="noreferrer" className="rounded-full bg-primary px-5 py-3 text-xs uppercase tracking-[.14em] text-primary-foreground">
          Open Google Search Console ↗
        </a>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Checking published catalogue…</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">Could not load SEO coverage. Please refresh or check admin access.</p> : null}

      {!isLoading && !error ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-border bg-card p-5">
                <p className="text-xs uppercase tracking-[.15em] text-muted-foreground">{stat.label}</p>
                <p className="mt-3 font-display text-3xl">{stat.value}</p>
                {"detail" in stat ? <p className="mt-1 text-xs text-muted-foreground">{stat.detail}</p> : null}
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Local business information</h2>
                <p className="mt-1 text-sm text-muted-foreground">Public store details used by the website and local business structured data.</p>
              </div>
              {directionsUrl ? <a href={directionsUrl} target="_blank" rel="noreferrer" className="text-xs uppercase tracking-[.14em] text-primary underline underline-offset-4">Check map pin</a> : null}
            </div>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              {[
                ["Store address", storeDetails["address"]],
                ["Phone", storeDetails["phone"]],
                ["Email", storeDetails["email"]],
                ["Opening hours", storeDetails["store_hours"]],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-[.12em] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-medium">{value || "Missing — update site settings"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Social profiles: {["instagram", "facebook", "tiktok"].filter((key) => Boolean(storeDetails[key])).length} of 3 configured
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl">Indexable collection pages</h2>
                <p className="mt-1 text-sm text-muted-foreground">{liveCollections.length} active collections with published products</p>
              </div>
              <Link to="/sitemap.xml" target="_blank" className="text-xs uppercase tracking-[.14em] text-primary underline underline-offset-4">View XML sitemap</Link>
            </div>
            <ul className="mt-4 divide-y divide-border">
              {liveCollections.map((category) => (
                <li key={category.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">{category.productCount} published products · {category.description?.trim() ? "Description added" : "Fallback description used"}</p>
                  </div>
                  <div className="flex gap-4">
                    <Link to="/collections/$slug" params={{ slug: category.slug }} target="_blank" className="text-primary underline underline-offset-4">View page</Link>
                  </div>
                </li>
              ))}
              {liveCollections.length === 0 ? <li className="py-3 text-sm text-muted-foreground">No active collections have published products.</li> : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="font-display text-xl">Products needing SEO attention</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add a concise, accurate title and description to help Google understand each product.</p>
            <ul className="mt-4 divide-y divide-border">
              {products.filter((product) => !product.meta_title?.trim() || !product.meta_description?.trim()).slice(0, 20).map((product) => (
                <li key={product.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <span className="font-medium">{product.name}</span>
                  <span className="flex gap-3 text-xs text-muted-foreground">
                    {!product.meta_title?.trim() ? <span>Missing title</span> : null}
                    {!product.meta_description?.trim() ? <span>Missing description</span> : null}
                    <Link to="/admin/products/$id" params={{ id: product.id }} className="text-primary underline underline-offset-4">Edit</Link>
                  </span>
                </li>
              ))}
              {products.every((product) => product.meta_title?.trim() && product.meta_description?.trim()) ? (
                <li className="py-3 text-sm text-muted-foreground">All published products have both SEO fields populated.</li>
              ) : null}
            </ul>
          </section>

          <section className="rounded-2xl border border-amber-300/50 bg-amber-50/60 p-5 text-sm text-amber-950">
            <h2 className="font-semibold">Search performance data is not connected yet</h2>
            <p className="mt-2 leading-6">This dashboard reports live catalogue SEO coverage. Google Search clicks, impressions, average position and indexing status must come from the verified Auraluxe Search Console property. The Google account/API authorisation is not configured in this project, so those metrics are not fabricated or displayed as estimates.</p>
            <p className="mt-2 leading-6">Use the Search Console link above to review actual Google performance. API-based reporting can be enabled after an owner-authorised Google connection is provided.</p>
          </section>
        </>
      ) : null}
    </div>
  );
}
