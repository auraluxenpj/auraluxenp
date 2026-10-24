import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { effectivePrice, fetchCategories, fetchProducts } from "@/lib/data";
import { useMoney } from "@/lib/store";

type ShopSearch = {
  category?: string | undefined;
  q?: string | undefined;
  sort?: string | undefined;
  size?: string | undefined;
  color?: string | undefined;
  max?: number | undefined;
  stock?: string | undefined;
};

export const Route = createFileRoute("/shop/")({
  validateSearch: (search: Record<string, unknown>): ShopSearch => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    sort: typeof search["sort"] === "string" ? search["sort"] : undefined,
    size: typeof search["size"] === "string" ? search["size"] : undefined,
    color: typeof search["color"] === "string" ? search["color"] : undefined,
    max: search["max"] != null ? Number(search["max"]) : undefined,
    stock: typeof search["stock"] === "string" ? search["stock"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Shop All — Auraluxe Nepalgunj" },
      {
        name: "description",
        content:
          "Browse every Auraluxe piece: kurtis, co-ord sets, suits, dresses and party wear. Filter by size, colour, price and availability.",
      },
      { property: "og:title", content: "Shop All — Auraluxe Nepalgunj" },
      {
        property: "og:description",
        content: "Kurtis, co-ord sets, suits, dresses and party wear from Auraluxe.",
      },
    ],
  }),
  component: Shop,
});

const PER_PAGE = 9;

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop/" });
  const money = useMoney();
  const [query, setQuery] = useState(search.q ?? "");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const update = (patch: Partial<ShopSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const sizes = useMemo(
    () => Array.from(new Set(products.flatMap((p) => p.sizes ?? []))).sort(),
    [products],
  );
  const colors = useMemo(
    () => Array.from(new Set(products.flatMap((p) => p.colors ?? []))).sort(),
    [products],
  );
  const maxPrice = useMemo(
    () => Math.max(10000, ...products.map((p) => Number(p.price))),
    [products],
  );

  const categoryId = categories.find((c) => c.slug === search.category)?.id;

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.category === "sale") {
      list = list.filter((p) => p.sale_price != null && Number(p.sale_price) > 0);
    } else if (search.category === "new-arrivals") {
      list = list.filter((p) => p.is_new);
    } else if (categoryId) {
      list = list.filter((p) => p.category_id === categoryId);
    }
    if (search.q) {
      const q = search.q.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q) ||
          (p.fabric ?? "").toLowerCase().includes(q),
      );
    }
    if (search.size) list = list.filter((p) => (p.sizes ?? []).includes(search.size!));
    if (search.color) list = list.filter((p) => (p.colors ?? []).includes(search.color!));
    if (search.max) list = list.filter((p) => effectivePrice(p) <= search.max!);
    if (search.stock === "in") list = list.filter((p) => p.stock > 0);

    switch (search.sort) {
      case "price-asc":
        list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
        break;
      case "price-desc":
        list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
        break;
      case "name":
        list.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    }
    return list;
  }, [products, search, categoryId]);

  const [limit, setLimit] = useState(PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset the shown count whenever the search or filters change
  useEffect(() => {
    setLimit(PER_PAGE);
  }, [search]);

  const visible = filtered.slice(0, limit);
  const hasMore = visible.length < filtered.length;

  // Load the next batch automatically as the shopper scrolls
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PER_PAGE);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  const selectClass =
    "glass rounded-full px-4 py-2.5 text-[12px] uppercase tracking-[0.15em] text-foreground/75 outline-none";

  return (
    <SiteLayout>
      <div className="mt-10">
        <p className="eyebrow">The collection</p>
        <h1 className="mt-2 font-display text-5xl">Shop Auraluxe</h1>
      </div>

      {/* Search + filters */}
      <div className="glass mt-6 rounded-3xl p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update({ q: query || undefined });
          }}
          className="flex gap-3"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search kurtis, co-ords, fabrics…"
            className="w-full rounded-full border border-border bg-input px-5 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-[12px] uppercase tracking-[0.15em] text-primary-foreground"
          >
            Search
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => update({ category: undefined })}
            className={`rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.15em] ${!search.category ? "bg-primary text-primary-foreground" : "glass text-foreground/70"}`}
          >
            All
          </button>
          {categories
            .filter((c) => c.is_active)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => update({ category: c.slug })}
                className={`rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.15em] ${search.category === c.slug ? "bg-primary text-primary-foreground" : "glass text-foreground/70"}`}
              >
                {c.name}
              </button>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className={selectClass}
            value={search.sort ?? "newest"}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="newest">Sort: Newest</option>
            <option value="price-asc">Price: Low to high</option>
            <option value="price-desc">Price: High to low</option>
            <option value="name">Name A–Z</option>
          </select>

          <select
            className={selectClass}
            value={search.size ?? ""}
            onChange={(e) => update({ size: e.target.value || undefined })}
          >
            <option value="">All sizes</option>
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={search.color ?? ""}
            onChange={(e) => update({ color: e.target.value || undefined })}
          >
            <option value="">All colours</option>
            {colors.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className={selectClass}
            value={search.stock ?? ""}
            onChange={(e) => update({ stock: e.target.value || undefined })}
          >
            <option value="">Any availability</option>
            <option value="in">In stock only</option>
          </select>

          <label className="glass flex min-w-[220px] items-center gap-3 rounded-full px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Max {money(search.max ?? maxPrice)}
            </span>
            <input
              type="range"
              min={500}
              max={maxPrice}
              step={100}
              value={search.max ?? maxPrice}
              onChange={(e) => update({ max: Number(e.target.value) })}
              className="flex-1 accent-[oklch(0.362_0.063_290)]"
            />
          </label>
        </div>
      </div>

      <p className="mt-6 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
        {isLoading ? "Loading…" : `${filtered.length} pieces`}
      </p>

      <section className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </section>

      {!isLoading && filtered.length === 0 ? (
        <p className="glass mt-6 rounded-3xl p-8 text-sm text-muted-foreground">
          No pieces match these filters yet.
        </p>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="mt-10 flex justify-center" aria-hidden={false}>
          <span className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
            Loading more…
          </span>
        </div>
      ) : filtered.length > PER_PAGE ? (
        <p className="mt-10 text-center text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
          You've seen all {filtered.length} pieces
        </p>
      ) : null}
    </SiteLayout>
  );
}
