import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { effectivePrice, fetchCategories, fetchProducts, hasDiscount } from "@/lib/data";
import { useMoney } from "@/lib/store";
import { categoryLabel, useLanguage } from "@/lib/i18n";

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
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const { t, language } = useLanguage();
  const [query, setQuery] = useState(search.q ?? "");

  // Keep the visible search field in sync with browser back/forward navigation.
  useEffect(() => {
    setQuery(search.q ?? "");
  }, [search.q]);

  const {
    data: products = [],
    isLoading,
    isError: productsError,
    refetch: retryProducts,
  } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
  });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const publishedProducts = useMemo(() => products.filter((product) => product.is_published), [products]);

  const update = (patch: Partial<ShopSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const sizes = useMemo(
    () => Array.from(new Set(publishedProducts.flatMap((p) => p.sizes ?? []))).sort(),
    [publishedProducts],
  );
  const colors = useMemo(
    () => Array.from(new Set(publishedProducts.flatMap((p) => p.colors ?? []))).sort(),
    [publishedProducts],
  );
  const fabrics = useMemo(
    () => Array.from(new Set(publishedProducts.map((p) => p.fabric).filter((v): v is string => Boolean(v)))).sort(),
    [publishedProducts],
  );
  const maxPrice = useMemo(
    () => Math.max(10000, ...publishedProducts.map((p) => Number(p.price))),
    [publishedProducts],
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
    // Never expose admin drafts or unpublished catalogue records on the public storefront.
    let list = [...publishedProducts];
    if (search.category === "sale") {
      list = list.filter(hasDiscount);
    } else if (search.category === "new-arrivals") {
      list = list.filter((p) => p.is_new);
    } else if (categoryId) {
      list = list.filter((p) => p.category_id === categoryId);
    }
    if (search.q) {
      const q = search.q.trim().toLowerCase();
      list = list.filter(
        (p) =>
          (p.model_code ?? "").toLowerCase().includes(q) ||
          (p.sku ?? "").toLowerCase().includes(q),
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
  }, [publishedProducts, search, categoryId]);

  const [limit, setLimit] = useState(PER_PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset the shown count whenever the search or filters change
  useEffect(() => {
    setLimit(PER_PAGE);
  }, [search]);

  const visible = filtered.slice(0, limit);

  // After the shopper has explored the first 12 pieces, surface a small set of
  // same-catalogue alternatives. Those pieces are removed from the remaining
  // stream so a product never appears twice as the shopper keeps scrolling.
  const similarRecommendations = useMemo(() => {
    if (visible.length < 16) return [];
    const anchor = visible[11];
    if (!anchor) return [];
    const candidates = filtered.slice(12).filter((product) => product.id !== anchor.id && product.stock > 0);
    return [...candidates]
      .sort((a, b) => {
        const score = (product: typeof a) =>
          Number(product.category_id === anchor.category_id) * 5 +
          Number(Boolean(product.fabric && product.fabric === anchor.fabric)) * 2 +
          Number((product.colors ?? []).some((color) => (anchor.colors ?? []).includes(color))) +
          Number(product.stock > 0);
        return score(b) - score(a);
      })
      .slice(0, 4);
  }, [visible, filtered]);

  const similarIds = useMemo(
    () => new Set(similarRecommendations.map((product) => product.id)),
    [similarRecommendations],
  );
  const catalogueVisible = visible.filter((product, index) => index < 12 || !similarIds.has(product.id));
  const hasMore = visible.length < filtered.length;

  // Complementary categories are deliberately separate from clothing
  // alternatives and only appear when the current catalogue is exhausted.
  const complementaryRecommendations = useMemo(() => {
    const complementaryCategoryIds = new Set(
      activeCategories
        .filter((category) => /bag|jutt|accessor/i.test(`${category.slug} ${category.name}`))
        .map((category) => category.id),
    );
    const alreadyShown = new Set(filtered.map((product) => product.id));
    return publishedProducts
      .filter((product) =>
        complementaryCategoryIds.has(product.category_id ?? "") &&
        !alreadyShown.has(product.id) &&
        product.stock > 0,
      )
      .slice(0, 4);
  }, [activeCategories, filtered, publishedProducts]);

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
        <p className="auraluxe-kicker">{t("auraluxeEdit")}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-[#422d2a] sm:text-6xl">
          {search.category ? categories.find((c) => c.slug === search.category) ? categoryLabel(search.category, categories.find((c) => c.slug === search.category)!.name, language, categories.find((c) => c.slug === search.category)!.name_ne) : (language === "ne" ? "सङ्ग्रह" : "The Collection") : t("discoverStyle")}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 sm:text-base">
          {t("collectionDescription")}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-[10px] uppercase tracking-[.16em] text-stone-500">
          <span>{t("home")}</span><span>/</span><span className="text-[#762b3b]">{t("shop")}</span>
          {search.category ? <><span>/</span><span className="text-[#762b3b]">{categoryLabel(search.category, categories.find((c) => c.slug === search.category)?.name ?? "सङ्ग्रह", language, categories.find((c) => c.slug === search.category)?.name_ne)}</span></> : null}
        </div>
      </div>

      {/* Visual category discovery — temporary editorial imagery until the catalogue is fully photographed. */}
      {!search.category && categories.some((c) => c.is_active) ? (
        <section className="mt-8" aria-label={t("shopCategory")}>
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="auraluxe-kicker">{t("exploreEdit")}</p>
              <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">{t("shopCategory")}</h2>
            </div>
            <span className="text-[10px] uppercase tracking-[.16em] text-stone-500">{t("findLook")}</span>
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
                  alt={categoryLabel(c.slug, c.name, language, c.name_ne)}
                  loading="lazy"
                  width={720}
                  height={900}
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#241713]/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-3 sm:p-4">
                  <span className="font-display text-lg text-white sm:text-xl">{categoryLabel(c.slug, c.name, language, c.name_ne)}</span>
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
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-full border border-border bg-input px-5 py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-primary px-6 py-3 text-[12px] uppercase tracking-[0.15em] text-primary-foreground"
          >
            {t("search")}
          </button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: t("all"), value: undefined },
            { label: t("newArrivals"), value: "new-arrivals" },
            { label: t("sale"), value: "sale" },
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
                {categoryLabel(c.slug, c.name, language, c.name_ne)}
              </button>
            ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            className={selectClass}
            value={search.sort ?? "newest"}
            onChange={(e) => update({ sort: e.target.value })}
          >
            <option value="newest">{t("sortNew")}</option>
            <option value="bestsellers">{t("bestSellers")}</option>
            <option value="popular">{t("featured")}</option>
            <option value="discount">{t("biggestDiscount")}</option>
            <option value="price-asc">{t("priceLowHigh")}</option>
            <option value="price-desc">{t("priceHighLow")}</option>
            <option value="name">{t("nameAZ")}</option>
          </select>

          <select
            className={selectClass}
            value={search.size ?? ""}
            onChange={(e) => update({ size: e.target.value || undefined })}
          >
            <option value="">{t("allSizes")}</option>
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
            <option value="">{t("allColours")}</option>
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
            <option value="">{t("allFabrics")}</option>
            {fabrics.map((fabric) => <option key={fabric} value={fabric}>{fabric}</option>)}
          </select>

          <select
            className={selectClass}
            value={search.stock ?? ""}
            onChange={(e) => update({ stock: e.target.value || undefined })}
          >
            <option value="">{t("anyAvailability")}</option>
            <option value="in">{t("inStockOnly")}</option>
          </select>

          <label className="glass flex min-w-[220px] items-center gap-3 rounded-full px-4 py-2">
            <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {t("maxPrice")} {money(search.max ?? maxPrice)}
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
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {t("activeFilters")} — {filtered.length} {t("matchingPieces")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {search.q ? <button type="button" onClick={() => { setQuery(""); update({ q: undefined }); }} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("search")}: {search.q} ×</button> : null}
                {search.category ? <button type="button" onClick={() => update({ category: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{search.category === "sale" ? t("sale") : search.category === "new-arrivals" ? t("newArrivals") : categoryLabel(search.category, categories.find((c) => c.slug === search.category)?.name ?? (language === "ne" ? "सङ्ग्रह" : "Collection"), language, categories.find((c) => c.slug === search.category)?.name_ne)} ×</button> : null}
                {search.size ? <button type="button" onClick={() => update({ size: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("allSizes")}: {search.size} ×</button> : null}
                {search.color ? <button type="button" onClick={() => update({ color: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("allColours")}: {search.color} ×</button> : null}
                {search.fabric ? <button type="button" onClick={() => update({ fabric: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("allFabrics")}: {search.fabric} ×</button> : null}
                {search.max ? <button type="button" onClick={() => update({ max: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("maxPrice")}: {money(search.max)} ×</button> : null}
                {search.stock === "in" ? <button type="button" onClick={() => update({ stock: undefined })} className="rounded-full border border-[#e5d8cd] bg-white px-3 py-1.5 text-[10px] text-stone-700">{t("inStockOnly")} ×</button> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                navigate({ search: {} });
              }}
              className="rounded-full border border-brand/30 px-4 py-2 text-[11px] uppercase tracking-[0.15em] text-primary transition hover:bg-secondary"
            >
              {t("clearAllFilters")}
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3 border-b border-[#e8ded5] pb-4">
        <div>
          <p className="auraluxe-kicker">{t("curatedForYou")}</p>
          <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">{t("collection")}</h2>
        </div>
        <p className="text-[11px] uppercase tracking-[.15em] text-stone-500" aria-live="polite">
          {isLoading
            ? t("loadingCollection")
            : productsError
              ? language === "ne" ? "सङ्ग्रह लोड हुन सकेन" : "Collection unavailable"
              : String(filtered.length) + " " + t("pieces")}
        </p>
      </div>

      <section className="auraluxe-product-grid mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 2xl:grid-cols-4">
        {catalogueVisible.slice(0, 12).map((p) => (
          <ProductCard key={p.id} product={p} {...(categoryFallbackImage ? { fallbackImage: categoryFallbackImage } : {})} />
        ))}
      </section>

      {similarRecommendations.length > 0 ? (
        <section className="mt-12" aria-label={language === "ne" ? "यस्तै डिजाइनहरू" : "Similar pieces"}>
          <div className="mb-4 border-b border-[#e8ded5] pb-3">
            <p className="auraluxe-kicker">{language === "ne" ? "तपाईंको छनोटअनुसार" : "Picked from this collection"}</p>
            <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">
              {language === "ne" ? "यस्तै डिजाइनहरू" : "You May Also Like"}
            </h2>
          </div>
          <div className="auraluxe-product-grid grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {similarRecommendations.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      {catalogueVisible.length > 12 ? (
        <section className="auraluxe-product-grid mt-5 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 2xl:grid-cols-4">
          {catalogueVisible.slice(12).map((p) => (
            <ProductCard key={p.id} product={p} {...(categoryFallbackImage ? { fallbackImage: categoryFallbackImage } : {})} />
          ))}
        </section>
      ) : null}

      {productsError ? (
        <div
          role="alert"
          className="glass mt-6 flex flex-col items-start gap-3 rounded-3xl border border-[#e5c9c3] p-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            {language === "ne"
              ? "अहिले उत्पादनहरू लोड गर्न सकिएन। कृपया फेरि प्रयास गर्नुहोस्।"
              : "We couldn’t load the collection right now. Please check your connection and try again."}
          </p>
          <button
            type="button"
            onClick={() => void retryProducts()}
            className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-[11px] uppercase tracking-[0.15em] text-primary-foreground transition hover:opacity-90"
          >
            {language === "ne" ? "फेरि प्रयास गर्नुहोस्" : "Try again"}
          </button>
        </div>
      ) : null}

      {!isLoading && !productsError && filtered.length === 0 ? (
        <p className="glass mt-6 rounded-3xl p-8 text-sm text-muted-foreground">
          {t("noPieces")}
        </p>
      ) : null}

      {!hasMore && complementaryRecommendations.length > 0 ? (
        <section className="mt-14" aria-label={language === "ne" ? "मिल्दोजुल्दो सामानहरू" : "Complete the look"}>
          <div className="mb-4 border-b border-[#e8ded5] pb-3">
            <p className="auraluxe-kicker">{language === "ne" ? "लुक पूरा गर्नुहोस्" : "Complete the look"}</p>
            <h2 className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">
              {language === "ne" ? "मिल्दोजुल्दो ब्याग र जुत्ती" : "Bags, Juttis & Accessories"}
            </h2>
          </div>
          <div className="auraluxe-product-grid grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {complementaryRecommendations.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </section>
      ) : null}

      {hasMore ? (
        <div ref={sentinelRef} className="mt-10 flex justify-center" aria-hidden={false}>
          <span className="text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("loadingMore")}
          </span>
        </div>
      ) : filtered.length > PER_PAGE ? (
        <p className="mt-10 text-center text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("seenAll")} {filtered.length} {t("pieces")}
        </p>
      ) : null}
    </SiteLayout>
  );
}
