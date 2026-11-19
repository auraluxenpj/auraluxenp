import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { effectivePrice, fetchCategories, fetchProducts, hasDiscount } from "@/lib/data";
import { useMoney } from "@/lib/store";

type ShopSearch = {
  category?: string | undefined;
  q?: string | undefined;
  sort?: string | undefined;
  size?: string | undefined;
  color?: string | undefined;
  fabric?: string | undefined;
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
    fabric: typeof search["fabric"] === "string" ? search["fabric"] : undefined,
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

const DUMMY_CATEGORY_IMAGES = [
  "https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1583391733956-6c78276477e3?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1609357605129-26f69add5d6e?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1612336307429-8a898d10e223?auto=format&fit=crop&w=720&q=82",
  "https://images.unsplash.com/photo-1617019114583-affb34d1b3cd?auto=format&fit=crop&w=720&q=82",
];

function Shop() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/shop/" });
  const money = useMoney();
  const [query, setQuery] = useState(search.q ?? "");

  // Keep the visible search field in sync with browser back/forward navigation.
  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

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
  const fabrics = useMemo(
    () => Array.from(new Set(products.map((p) => p.fabric).filter((v): v is string => Boolean(v)))).sort(),
    [products],
  );
  const maxPrice = useMemo(
    () => Math.max(10000, ...products.map((p) => Number(p.price))),
    [products],
  );

  const activeCategories = categories.filter((c) => c.is_active);
  const categoryId = categories.find((c) => c.slug === search.category)?.id;
  const categoryFallbackImage = search.category
    ? (() => {
        const index = activeCategories.findIndex((c) => c.slug === search.category);
        const category = activeCategories[index];
        return category?.image_url || DUMMY_CATEGORY_IMAGES[(index >= 0 ? index : 0) % DUMMY_CATEGORY_IMAGES.length];
      })()
    : undefined;

  const filtered = useMemo(() => {
    let list = [...products];
    if (search.category === "sale") {
      list = list.filter(hasDiscount);
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
    if (search.fabric) list = list.filter((p) => p.fabric === search.fabric);
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
      case "bestsellers":
        list.sort((a, b) => Number(b.is_bestseller) - Number(a.is_bestseller));
        break;
      case "popular":
        list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured));
        break;
      case "discount":
        list.sort((a, b) => {
          const discountA = Number(a.price) > 0 ? 1 - effectivePrice(a) / Number(a.price) : 0;
          const discountB = Number(b.price) > 0 ? 1 - effectivePrice(b) / Number(b.price) : 0;
          return discountB - discountA;
        });
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
      <div className="auraluxe-collection-intro mt-8 sm:mt-12">
        <p className="auraluxe-kicker">The Auraluxe edit</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-[#422d2a] sm:text-6xl">
          {search.category ? categories.find((c) => c.slug === search.category)?.name ?? "The Collection" : "Discover your style"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          Thoughtfully chosen ethnic wear for everyday moments, celebrations and everything in between.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] uppercase tracking-[.16em] text-stone-500">
          <span>Home</span><span>/</span><span className="text-[#762b3b]">Shop</span>
          {search.category ? <><span>/</span><span className="text-[#762b3b]">{categories.find((c) => c.slug === search.category)?.name}</span></> : null}
        </div>
      </div>

      {/* Visual category discovery — temporary editorial imagery until the catalogue is fully photographed. */}
      {categories.some((c) => c.is_active) ? (
        <section className="mt-8" aria-label="Shop by category">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="auraluxe-kicker">Explore the edit</p>
              <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">Shop by category</h2>
            </div>
            <span className="text-[10px] uppercase tracking-[.16em] text-stone-500">Find your look</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categories.filter((c) => c.is_active).map((c, i) => (
              <Link
                key={c.id}
                to="/shop"
                search={{ category: c.slug }}
                className="group relative aspect-[4/5] overflow-hidden rounded-sm bg-[#eee5dc]"
              >
                <img
                  src={c.image_url || DUMMY_CATEGORY_IMAGES[i % DUMMY_CATEGORY_IMAGES.length]}
                  alt={c.name}
                  loading="lazy"
                  width={720}
                  height={900}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#241713]/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-4">
                  <span className="font-display text-lg text-white sm:text-xl">{c.name}</span>
                  <span className="text-sm text-white/90">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Search + filters */}
      <div className="auraluxe-filter-panel mt-7 rounded-sm border border-[#e9dfd5] bg-[#fffdf9] p-4 shadow-sm sm:p-6">
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
          {[
            { label: "All", value: undefined },
            { label: "New arrivals", value: "new-arrivals" },
            { label: "Sale", value: "sale" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => update({ category: item.value })}
              aria-pressed={(search.category ?? undefined) === item.value}
              className={`rounded-full px-4 py-2 text-[12px] uppercase tracking-[0.15em] ${(search.category ?? undefined) === item.value ? "bg-primary text-primary-foreground" : "glass text-foreground/70"}`}
            >
              {item.label}
            </button>
          ))}
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
            <option value="newest">Sort: New arrivals</option>
            <option value="bestsellers">Bestsellers</option>
            <option value="popular">Featured</option>
            <option value="discount">Biggest discount</option>
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
            value={search.fabric ?? ""}
            onChange={(e) => update({ fabric: e.target.value || undefined })}
          >
            <option value="">All fabrics</option>
            {fabrics.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
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
        {(search.q || search.category || search.size || search.color || search.fabric || search.max || search.stock) ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Filters are active — {filtered.length} matching pieces
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                navigate({ search: {} });
              }}
              className="rounded-full border border-brand/30 px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-primary transition hover:bg-secondary"
            >
              Clear all filters
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-[#e8ded5] pb-4">
        <div>
          <p className="auraluxe-kicker">Curated for you</p>
          <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">The collection</h2>
        </div>
        <p className="text-[11px] uppercase tracking-[.15em] text-stone-500" aria-live="polite">
          {isLoading ? "Loading collection…" : String(filtered.length) + " pieces"}
        </p>
      </div>

      <section className="auraluxe-product-grid mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 2xl:grid-cols-5">
        {visible.map((p) => (
          <ProductCard key={p.id} product={p} fallbackImage={categoryFallbackImage} />
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
