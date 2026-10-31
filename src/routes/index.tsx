  const live = banners.filter(bannerIsLive);
  const heroSlides = live.filter((b) => b.placement === "hero");
  const promo = live.filter((b) => b.placement === "promo")[0];

  // Only products that are published AND actually in stock
  const inStock = products.filter((p) => p.is_published && Number(p.stock) > 0);
  const newestFirst = [...inStock].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  // New arrivals: flagged ones first, then topped up with the newest in-stock products
  const newCollection = [
    ...newestFirst.filter((p) => p.is_new),
    ...newestFirst.filter((p) => !p.is_new),
  ].slice(0, 3);
  const trending = inStock.filter((p) => p.is_featured).slice(0, 3);
  const bestSellers = inStock.filter((p) => p.is_bestseller).slice(0, 3);
  const offers = inStock
    .filter((p) => p.sale_price != null && Number(p.sale_price) > 0)
    .slice(0, 3);

  // Hero: admin banners if you have any, otherwise your newest in-stock products
  const productSlides: Banner[] = newestFirst.slice(0, 4).map((p, i) => ({
    ...FALLBACK_HERO,
    id: `product-hero-${p.id}`,
    title: p.name,
    subtitle: "Now in stock — limited pieces, delivered across Nepal.",
    image_url: productImage(p),
    button_text: "Shop now",
    button_link: "/shop",
    sort_order: i,
  }));
  const heroBanners =
    heroSlides.length > 0 ? heroSlides : productSlides.length > 0 ? productSlides : [FALLBACK_HERO];

  const activeCategories = categories.filter((c) => c.is_active).slice(0, 8);
  const categoryImage = (categoryId: string, fallback?: string | null) =>
    fallback ??
    inStock.find((p) => p.category_id === categoryId)?.images?.[0] ??
    null;
