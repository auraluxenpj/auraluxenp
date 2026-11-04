import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
  // Fetch the data the hero needs BEFORE the page renders (on the server), so the
  // hero photo is in the first HTML and starts downloading immediately.
  // If any fetch fails we fall back to the normal client-side loading.
  loader: async () => {
    const safe = <T,>(p: Promise<T>) => p.catch(() => undefined);
    const [products, categories, banners] = await Promise.all([
      safe(fetchProducts()),
      safe(fetchCategories()),
      safe(fetchBanners()),
    ]);
    return { products, categories, banners };
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
      return img ? [{ rel: "preload", as: "image", href: img, fetchPriority: "high" } as any] : [];
    })(),
  }),
  component: Home,
});

// The image that will be the first hero slide (same rules the page uses below)
function heroImageFor(data?: { products?: Product[]; banners?: Banner[] }): string | null {
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

// Category tile whose picture comes from the in-stock products of that category
// and gently cycles through them (only while the tile is on screen).
function CategoryTile({
  name,
  slug,
  images,
  offset,
}: {
  name: string;
  slug: string;
  images: string[];
  offset: number;
}) {
  const count = images.length;
  const imagesKey = images.join("|");
  const boxRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const [started, setStarted] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (count < 2 || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let interval: number | undefined;
    const startTimer = window.setTimeout(() => {
      setStarted(true);
      interval = window.setInterval(() => {
        const next = (activeRef.current + 1) % count;
        const img = new Image();
        img.onload = () => {
          activeRef.current = next;
          setActive(next);
        };
        img.src = images[next];
      }, 5000);
    }, 2000 + offset * 700);
    return () => {
      window.clearTimeout(startTimer);
      if (interval) window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, imagesKey, offset, inView]);

  const shown = count > 0 ? active % count : 0;
  const visible = started ? images : images.slice(0, 1);

  return (
    <Link
      to="/shop"
      search={{ category: slug }}
      className="group glass relative overflow-hidden rounded-3xl transition hover:-translate-y-1"
    >
      <div ref={boxRef} className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
        {count > 0 ? (
          visible.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={i === shown ? name : ""}
              aria-hidden={i !== shown}
              loading="lazy"
              width={768}
              height={960}
              className={`absolute inset-0 h-full w-full object-cover transition-[opacity,transform] duration-700 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${
                i === shown ? "opacity-100" : "opacity-0"
              }`}
            />
          ))
        ) : (
          <div className="grid h-full w-full place-items-center bg-gradient-to-br from-brand/20 via-secondary to-accent/30">
            <span className="font-display text-2xl text-primary">{name}</span>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent p-4 pt-10">
        <div className="flex items-center justify-between">
          <span className="font-display text-lg text-primary-foreground drop-shadow">{name}</span>
          <span className="text-primary-foreground/90 transition group-hover:translate-x-1">→</span>
        </div>
      </div>
    </Link>
  );
}

function Home() {
  const settings = useSettings();
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
  const newestFirst = [...inStock].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );

  // Each product appears in only ONE section (in page order), so nothing repeats
  const used = new Set<string>();
  const pick = (list: Product[], n = 3) => {
    const fresh = list.filter((p) => !used.has(p.id)).slice(0, n);
    fresh.forEach((p) => used.add(p.id));
    return fresh;
  };

  // New arrivals: flagged ones first, then topped up with the newest in-stock products
  const newCollection = pick([
    ...newestFirst.filter((p) => p.is_new),
    ...newestFirst.filter((p) => !p.is_new),
  ]);
  const trending = pick(inStock.filter((p) => p.is_featured));
  const bestSellers = pick(inStock.filter((p) => p.is_bestseller));
  const offers = pick(
    inStock.filter((p) => p.sale_price != null && Number(p.sale_price) > 0),
  );

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
  // Category pictures: newest in-stock products of that category (up to 3),
  // falling back to the image set in admin, then to a plain coloured tile.
  const categoryImages = (categoryId: string, fallback?: string | null): string[] => {
    const own = newestFirst
      .filter((p) => p.category_id === categoryId)
      .map((p) => productImage(p))
      .filter(Boolean);
    const unique = Array.from(new Set(own)).slice(0, 3);
    if (unique.length > 0) return unique;
    return fallback ? [fallback] : [];
  };

  return (
    <SiteLayout>
      {bannersLoading || (heroSlides.length === 0 && productsLoading) ? (
        <section className="relative -mx-5 -mt-2 overflow-hidden sm:-mx-8">
          <h1 className="sr-only">Auraluxe — Premium Ladies' Fashion in Nepalgunj</h1>
          <div className="aspect-[3/4] w-full animate-pulse bg-muted sm:aspect-[16/9] lg:aspect-[2/1]" />
        </section>
      ) : (
        <HeroCarousel banners={heroBanners} />
      )}

      {/* Placeholder while categories load, so the page below doesn't jump */}
      {categoriesLoading ? (
        <>
          <SectionHeading eyebrow="Find your fit" title="Shop by Category" />
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[4/5] w-full animate-pulse rounded-3xl bg-muted" />
            ))}
          </section>
        </>
      ) : null}

      {/* Shop by category */}
      {activeCategories.length > 0 ? (
        <>
          <SectionHeading eyebrow="Find your fit" title="Shop by Category" />
          <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {activeCategories.map((c, i) => (
              <CategoryTile
                key={c.id}
                name={c.name}
                slug={c.slug}
                images={categoryImages(c.id, c.image_url)}
                offset={i}
              />
            ))}
          </section>
        </>
      ) : null}

      {productsLoading ? (
        <>
          <SectionHeading eyebrow="Just landed" title="New Arrivals" />
          <section
            className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3"
            aria-hidden="true"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] w-full animate-pulse rounded-3xl bg-muted" />
            ))}
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
