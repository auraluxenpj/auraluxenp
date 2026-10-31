import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  bannerIsLive,
  fetchBanners,
  fetchCategories,
  fetchProducts,
  fetchTestimonials,
  productImage,
  type Banner,
  type Product,
} from "@/lib/data";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { useSettings, whatsappLink } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auraluxe — Redefine your beauty" },
      {
        name: "description",
        content:
          "Shop hand-finished kurtis, co-ord sets, suits, dresses and party wear from Auraluxe, Nepalgunj. Secure QR or bank transfer payment across Nepal.",
      },
      { property: "og:title", content: "Auraluxe — Premium Ladies' Fashion in Nepalgunj" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://auraluxe.com.np/" },
      { property: "og:image", content: "https://auraluxe.com.np/images/hero-auraluxe.jpg" },
      { property: "og:image:alt", content: "Auraluxe — premium ladies' fashion from Nepalgunj" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://auraluxe.com.np/images/hero-auraluxe.jpg" },
      {
        property: "og:description",
        content: "Hand-finished kurtis, co-ord sets and party wear, designed in Nepalgunj.",
      },
    ],
  }),
  component: Home,
});

const FALLBACK_HERO: Banner = {
  id: "default-hero",
  title: "The season's silhouette, cut for comfort.",
  subtitle:
    "Hand-finished kurtis, co-ord sets and party wear in breathable georgette and cotton — designed in Nepalgunj, delivered to your door.",
  image_url: "/images/hero-auraluxe.jpg",
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
  return (
    <div className="mt-16 flex items-end justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl">{title}</h2>
      </div>
      <Link
        to="/shop"
        className="hidden text-[13px] uppercase tracking-[0.18em] text-foreground/60 underline decoration-accent decoration-2 underline-offset-4 hover:text-brand sm:block"
      >
        View all
      </Link>
    </div>
  );
}

function Rail({ products }: { products: Product[] }) {
  if (products.length === 0) return null;
  return (
    <section className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </section>
  );
}

function Home() {
  const settings = useSettings();
  const { data: products = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: banners = [] } = useQuery({ queryKey: ["banners"], queryFn: () => fetchBanners() });
  const { data: testimonials = [] } = useQuery({
    queryKey: ["testimonials"],
    queryFn: fetchTestimonials,
  });

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

  return (
    <SiteLayout>
      <HeroCarousel banners={heroBanners} />

      {/* Shop by category */}
      {activeCategories.length > 0 ? (
        <>
          <SectionHeading eyebrow="Find your fit" title="Shop by Category" />
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {activeCategories.map((c) => {
              const img = categoryImage(c.id, c.image_url);
              return (
                <Link
                  key={c.id}
                  to="/shop"
                  search={{ category: c.slug }}
                  className="group glass relative overflow-hidden rounded-3xl transition hover:-translate-y-1"
                >
                  <div className="aspect-[4/5] w-full overflow-hidden bg-muted">
                    {img ? (
                      <img
                        src={img}
                        alt={c.name}
                        loading="lazy"
                        width={768}
                        height={960}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand/20 via-secondary to-accent/30">
                        <span className="font-display text-2xl text-primary">{c.name}</span>
                      </div>
                    )}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 pt-10">
                    <div className="flex items-center justify-between">
                      <span className="font-display text-lg text-primary-foreground drop-shadow">
                        {c.name}
                      </span>
                      <span className="text-primary-foreground/90 transition group-hover:translate-x-1">→</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        </>
      ) : null}

      {newCollection.length > 0 ? (
        <>
          <SectionHeading eyebrow="Just landed" title="New Arrivals" />
          <Rail products={newCollection} />
        </>
      ) : null}

      {/* Promotional campaign banner */}
      {promo ? (
        <section className="glass-strong mt-16 overflow-hidden rounded-3xl">
          <div className="grid md:grid-cols-2">
            {promo.image_url ? (
              <img
                src={promo.image_url}
                alt={promo.title ?? "Auraluxe promotion"}
                loading="lazy"
                width={1024}
                height={768}
                className="h-full max-h-96 w-full object-cover"
              />
            ) : null}
            <div className="flex flex-col justify-center p-8 sm:p-12">
              <p className="eyebrow">Limited offer</p>
              {promo.title ? <h2 className="mt-3 font-display text-4xl">{promo.title}</h2> : null}
              {promo.subtitle ? (
                <p className="mt-3 text-[15px] text-muted-foreground">{promo.subtitle}</p>
              ) : null}
              {promo.button_link ? (
                <Link
                  to={promo.button_link as "/shop"}
                  className="mt-6 inline-block w-fit rounded-full bg-primary px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-brand"
                >
                  {promo.button_text ?? "Shop now"}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {trending.length > 0 ? (
        <>
          <SectionHeading eyebrow="Loved right now" title="Trending Now" />
          <Rail products={trending} />
        </>
      ) : null}

      {bestSellers.length > 0 ? (
        <>
          <SectionHeading eyebrow="Most wanted" title="Best Sellers" />
          <Rail products={bestSellers} />
        </>
      ) : null}

      {offers.length > 0 ? (
        <>
          <SectionHeading eyebrow="Reduced this week" title="Special Offers" />
          <Rail products={offers} />
        </>
      ) : null}

      {/* Editorial tiles */}
      <section className="mt-16 grid gap-5 md:grid-cols-3">
        <Link to="/about" className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1">
          <p className="eyebrow">Our story</p>
          <h3 className="mt-3 font-display text-3xl">Designed in Nepalgunj</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            The Auraluxe atelier, our fabrics, and the hands behind every piece.
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            Read more →
          </span>
        </Link>
        <Link
          to="/shop"
          search={{ sort: "newest" }}
          className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1"
        >
          <p className="eyebrow">The edit</p>
          <h3 className="mt-3 font-display text-3xl">New-season arrivals</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Fresh silhouettes and festive pieces, added as they leave the studio.
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            Shop new in →
          </span>
        </Link>
        <Link to="/contact" className="group glass relative overflow-hidden rounded-3xl p-8 transition hover:-translate-y-1">
          <p className="eyebrow">Visit us</p>
          <h3 className="mt-3 font-display text-3xl">The Nepalgunj store</h3>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {settings["address"] ?? "Come try your favourites in person."}
          </p>
          <span className="mt-5 inline-block text-[12px] uppercase tracking-[0.18em] text-brand transition group-hover:translate-x-1">
            Directions & hours →
          </span>
        </Link>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 ? (
        <>
          <SectionHeading eyebrow="In their words" title="Customer Stories" />
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

      {/* Social + contact CTA */}
      <section className="glass-strong mt-16 grid gap-8 rounded-3xl p-8 sm:p-12 md:grid-cols-2">
        <div>
          <p className="eyebrow">Follow along</p>
          <h2 className="mt-3 font-display text-4xl">The Auraluxe edit, daily</h2>
          <p className="mt-3 max-w-sm text-[15px] text-muted-foreground">
            Styling notes, new arrivals and early access on Instagram and TikTok.
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
              "Hello Auraluxe! I'd like to place an order.",
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
