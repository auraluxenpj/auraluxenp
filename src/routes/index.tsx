import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  bannerIsLive,
  fetchBanners,
  fetchCategories,
  fetchProducts,
  fetchTestimonials,
  productImage,
  productImages,
  type Banner,
  type StorefrontProduct,
} from "@/lib/data";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { useCart, useSettings, whatsappLink, whatsappProductMessage } from "@/lib/store";
import { categoryLabel, localizedContent, useLanguage } from "@/lib/i18n";
import { GoogleReviews } from "@/components/site/GoogleReviews";
import { getPublicLocalBusinessSeo } from "@/lib/seo.functions";

export const Route = createFileRoute("/")({
  // Fetch the data the hero needs BEFORE the page renders (on the server), so the
  // hero photo is in the first HTML and starts downloading immediately.
  // If any fetch fails we fall back to the normal client-side loading.
  loader: async () => {
    const safe = <T,>(p: Promise<T>) => p.catch(() => undefined);
    const [products, categories, banners, business] = await Promise.all([
      safe(fetchProducts()),
      safe(fetchCategories()),
      safe(fetchBanners()),
      safe(getPublicLocalBusinessSeo()),
    ]);
    return { products, categories, banners, business };
  },
  staleTime: 60_000,
  head: ({ loaderData }) => ({
    meta: [
      { title: "Auraluxe — Redefine your beauty" },
      {
        name: "description",
        content:
          "Shop hand-finished kurtis, co-ord sets, suits, dresses and party wear from Auraluxe, Nepalgunj. Secure QR or bank transfer payment across Nepal.",
      },
      { property: "og:title", content: "Auraluxe — Premium Ladies' Fashion in Nepalgunj" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.auraluxe.com.np/" },
      { property: "og:image", content: "https://www.auraluxe.com.np/images/hero-auraluxe.jpg" },
      { property: "og:image:alt", content: "Auraluxe — premium ladies' fashion from Nepalgunj" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://www.auraluxe.com.np/images/hero-auraluxe.jpg" },
      {
        property: "og:description",
        content: "Hand-finished kurtis, co-ord sets and party wear, designed in Nepalgunj.",
      },
    ],
    links: (() => {
      const img = heroImageFor(loaderData);
      return [
        { rel: "canonical", href: "https://www.auraluxe.com.np/" },
        ...(img ? [{ rel: "preload", as: "image", href: img }] : []),
      ];
    })(),
    scripts: (() => {
      const business = loaderData?.business;
      if (!business?.address || !business.phone) return [];
      const hours = business.storeHours?.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
      const sameAs = [business.instagram, business.facebook, business.tiktok].filter(
        (value): value is string => Boolean(value),
      );
      const schema = {
        "@context": "https://schema.org",
        "@type": "ClothingStore",
        "@id": "https://www.auraluxe.com.np/#store",
        name: "Auraluxe",
        url: "https://www.auraluxe.com.np/",
        description: "Women's fashion and traditional clothing store in Nepalgunj, Nepal.",
        telephone: business.phone,
        ...(business.email ? { email: business.email } : {}),
        address: {
          "@type": "PostalAddress",
          streetAddress: business.address,
          addressLocality: "Nepalgunj",
          addressRegion: "Lumbini Province",
          addressCountry: "NP",
        },
        areaServed: [
          { "@type": "City", name: "Nepalgunj" },
          { "@type": "Country", name: "Nepal" },
        ],
        ...(hours ? { openingHours: [`Mo-Su ${hours[1]}-${hours[2]}`] } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      };
      return [{
        type: "application/ld+json",
        children: JSON.stringify(schema).replace(/</g, "\\u003c"),
      }];
    })(),
  }),
  component: Home,
});

// The image that will be the first hero slide (same rules the page uses below)
function heroImageFor(data?: { products?: StorefrontProduct[] | undefined; banners?: Banner[] | undefined }): string | null {
  const heroBanner = (data?.banners ?? []).filter(bannerIsLive).find((b) => b.placement === "hero");
  if (heroBanner) return heroBanner.image_url ?? null;
  const newest = (data?.products ?? [])
    .filter((p) => p.is_published && Number(p.stock) > 0)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  return newest ? productImage(newest) : null;
}

const FALLBACK_HERO: Banner = {
  id: "default-hero",
  title: "The season's silhouette, cut for comfort.",
  subtitle:
    "Hand-finished kurtis, co-ord sets and party wear in breathable georgette and cotton — designed in Nepalgunj, delivered to your door.",
  image_url: "https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=2200&q=88",
  mobile_image_url: null,
  button_text: "Shop New In",
  button_link: "/shop",
  placement: "hero",
  sort_order: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  created_at: "",
};

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  const { t } = useLanguage();
  const translatedEyebrow: Record<string, string> = { "Find your fit": t("findFit"), "Just landed": t("justLanded"), "Loved right now": t("lovedNow"), "Most wanted": t("mostWanted"), "Reduced this week": t("specialOffers"), "In their words": t("inTheirWords") };
  const translatedTitle: Record<string, string> = { "Shop by Category": t("shopByCategory"), "New Arrivals": t("newArrivalsTitle"), "Trending Now": t("trendingNow"), "Best Sellers": t("bestSellers"), "Special Offers": t("specialOffers"), "Customer Stories": t("customerStories") };
  return (
    <div className="mt-16 flex items-end justify-between">
      <div>
        <p className="eyebrow">{translatedEyebrow[eyebrow] ?? eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl">{translatedTitle[title] ?? title}</h2>
      </div>
      <Link
        to="/shop"
        className="hidden text-[13px] uppercase tracking-[0.18em] text-foreground/60 underline decoration-accent decoration-2 underline-offset-4 hover:text-brand sm:block"
      >
        {t("viewAll")}
      </Link>
    </div>
  );
}

function Home() {
  const settings = useSettings();
  const { items } = useCart();
  const { language, t } = useLanguage();
  const initial = Route.useLoaderData();
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProducts,
    initialData: initial?.products,
    staleTime: 60_000,
  });
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    initialData: initial?.categories,
    staleTime: 60_000,
  });
  const { data: banners = [], isLoading: bannersLoading } = useQuery({
    queryKey: ["banners"],
    queryFn: () => fetchBanners(),
    initialData: initial?.banners,
    staleTime: 60_000,
  });
  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: fetchTestimonials,
  });

  const live = banners.filter(bannerIsLive);
  const heroSlides = live.filter((b) => b.placement === "hero");
  const promo = live.filter((b) => b.placement === "promo")[0];

  // Only products that are published AND actually in stock
  const inStock = products.filter((p) => p.is_published && Number(p.stock) > 0);
  // Prioritise genuine uploaded product photos, then keep newest-first order
  // within each group. Products without photos remain in the catalogue below.
  const newestFirst = [...inStock].sort((a, b) => {
    const photoPriority = Number(productImages(b).length > 0) - Number(productImages(a).length > 0);
    return photoPriority || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });

  // Hero: admin banners if you have any, otherwise your newest in-stock products
  const productSlides: Banner[] = newestFirst.slice(0, 4).map((p, i) => ({
    ...FALLBACK_HERO,
    id: `product-hero-${p.id}`,
    title: localizedContent(p.name, p.name_ne, language),
    subtitle: t("nowInStockLimited"),
    image_url: productImage(p),
    button_text: t("shopNow"),
    button_link: "/shop",
    sort_order: i,
  }));
  const defaultHero: Banner = { ...FALLBACK_HERO, title: language === "ne" ? t("heroFallbackTitle") : FALLBACK_HERO.title, subtitle: language === "ne" ? t("heroFallbackSubtitle") : FALLBACK_HERO.subtitle, button_text: t("shopNewIn") };
  const heroBanners =
    heroSlides.length > 0 ? heroSlides : productSlides.length > 0 ? productSlides : [defaultHero];

  const activeCategoryIds = new Set(products.map((product) => product.category_id).filter((id): id is string => Boolean(id)));
  const activeCategories = categories.filter((category) => category.is_active && activeCategoryIds.has(category.id));
  const allProducts = [...products].sort((a, b) => {
    const photoPriority = Number(productImages(b).length > 0) - Number(productImages(a).length > 0);
    return photoPriority || String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
  });

  return (
    <SiteLayout>
      {bannersLoading || (heroSlides.length === 0 && productsLoading) ? (
        <section className="relative -mx-5 -mt-2 overflow-hidden sm:-mx-8 lg:-mx-12 2xl:-mx-16">
          <h1 className="sr-only">{t("homeSeoTitle")}</h1>
          <div className="aspect-[3/4] w-full animate-pulse bg-muted sm:aspect-[16/9] lg:aspect-[2/1]" />
        </section>
      ) : (
        <HeroCarousel banners={heroBanners} />
      )}

      {/* Name-only category navigation */}
      {categoriesLoading ? (
        <>
          <SectionHeading eyebrow={t("findFit")} title={t("shopByCategory")} />
          <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-11 w-24 animate-pulse rounded-full bg-muted" />
            ))}
          </div>
        </>
      ) : activeCategories.length > 0 ? (
        <>
          <SectionHeading eyebrow={t("findFit")} title={t("shopByCategory")} />
          <nav className="mt-6 flex flex-wrap gap-2" aria-label={t("shopByCategory")}>
            {activeCategories.map((category) => (
              <Link
                key={category.id}
                to="/collections/$slug"
                params={{ slug: category.slug }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#e5d8cd] bg-[#fffdf9] px-5 py-2.5 text-sm text-[#422d2a] transition hover:border-[#762b3b] hover:bg-[#762b3b] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#762b3b]"
              >
                {categoryLabel(category.slug, category.name, language, category.name_ne)}
              </Link>
            ))}
          </nav>
        </>
      ) : null}

      {/* Product discovery immediately follows category navigation */}
      <section className="mt-12" aria-labelledby="home-all-products">
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-[#e8ded5] pb-4">
          <div>
            <p className="auraluxe-kicker">{language === "ne" ? "नयाँ छनोट" : "Explore the collection"}</p>
            <h2 id="home-all-products" className="mt-2 font-display text-3xl text-[#422d2a] sm:text-4xl">
              {language === "ne" ? "सबै उत्पादनहरू" : "All Products"}
            </h2>
          </div>
          <Link to="/shop" className="shrink-0 text-xs uppercase tracking-[.15em] text-[#762b3b] underline underline-offset-4">
            {t("viewAll")}
          </Link>
        </div>
        {productsLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : allProducts.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {allProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#e9dfd5] bg-[#fffdf9] px-6 py-10 text-center text-sm text-stone-600">
            {language === "ne" ? "हाल कुनै उत्पादन उपलब्ध छैन।" : "No products are available right now."}
          </p>
        )}
      </section>

      {/* Promotional campaign banner */}
      {promo ? (
        <section className="glass-strong mt-16 overflow-hidden rounded-3xl">
          <div className="grid md:grid-cols-2">
            {promo.image_url ? (
              <img
                src={promo.image_url}
                alt={promo.title ?? t("promoAlt")}
                loading="lazy"
                width={1024}
                height={768}
                className="h-full max-h-96 w-full object-cover"
              />
            ) : null}
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow">{t("limitedOffer")}</p>
              {promo.title ? <h2 className="mt-3 font-display text-4xl">{promo.title}</h2> : null}
              {promo.subtitle ? (
                <p className="mt-3 text-[15px] text-muted-foreground">{promo.subtitle}</p>
              ) : null}
              {promo.button_link ? (
                <Link
                  to={promo.button_link as "/shop"}
                  className="mt-6 inline-block w-fit rounded-full bg-primary px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-brand"
                >
                  {promo.button_text ?? t("shopNow")}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* Editorial tiles */}
      <section className="mt-16 grid gap-5 md:grid-cols-3">
        <Link to="/about" className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1">
          <p className="eyebrow">{t("ourStory")}</p>
          <h3 className="mt-3 font-display text-3xl">{t("designedNepalgunj")}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("atelierStory")}
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            {t("readMore")}
          </span>
        </Link>
        <Link
          to="/shop"
          search={{ sort: "newest" }}
          className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1"
        >
          <p className="eyebrow">{t("theEdit")}</p>
          <h3 className="mt-3 font-display text-3xl">{t("newSeasonArrivals")}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {t("freshSilhouettes")}
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            {t("shopNewIn")}
          </span>
        </Link>
        <Link to="/contact" className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1">
          <p className="eyebrow">{t("visitUs")}</p>
          <h3 className="mt-3 font-display text-3xl">{t("nepalgunjStore")}</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {settings["address"] ?? t("comeTry")}
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            {t("directionsHours")}
          </span>
        </Link>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 ? (
        <>
          <SectionHeading eyebrow={t("inTheirWords")} title={t("customerStories")} />
          <section className="mt-6 grid gap-5 sm:grid-cols-3">
            {testimonials.slice(0, 3).map((t) => (
              <blockquote key={t.id} className="glass rounded-3xl p-6">
                <p className="font-display text-xl leading-snug">“{t.body}”</p>
                <footer className="mt-4 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                  {t.author_name}
                  {t.location ? ` · ${t.location}` : ""}
                </footer>
              </blockquote>
            ))}
          </section>
        </>
      ) : null}

      <GoogleReviews />

      {/* Social + contact CTA */}
      <section className="glass-strong mt-16 grid gap-8 rounded-3xl p-8 sm:p-12 md:grid-cols-2">
        <div>
          <p className="eyebrow">{t("followAlong")}</p>
          <h2 className="mt-3 font-display text-4xl">{t("editDaily")}</h2>
          <p className="mt-3 max-w-sm text-[15px] text-muted-foreground">
            {t("stylingNotes")}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            {settings["instagram"] ? (
              <a
                href={settings["instagram"]}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-brand/30 bg-secondary px-6 py-3 text-[12px] uppercase tracking-[0.18em] text-primary"
              >
                Instagram
              </a>
            ) : null}
            {settings["tiktok"] ? (
              <a
                href={settings["tiktok"]}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-brand/30 bg-secondary px-6 py-3 text-[12px] uppercase tracking-[0.18em] text-primary"
              >
                TikTok
              </a>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <p className="text-[15px] text-muted-foreground">
            Prefer to order by message? Send us the piece you like on WhatsApp and we'll reserve it.
          </p>
          <a
            href={whatsappLink(
              settings["whatsapp"] ?? "",
              whatsappProductMessage("Hello Auraluxe! I'd like to place an order.", items),
            )}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-primary px-7 py-3.5 text-center text-[13px] uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-brand"
          >
            Order on WhatsApp
          </a>
          <Link
            to="/contact"
            className="rounded-full border border-brand/30 bg-secondary px-7 py-3.5 text-center text-[13px] uppercase tracking-[0.18em] text-primary"
          >
            Visit the store
          </Link>
        </div>
      </section>
    </SiteLayout>
  );
}
