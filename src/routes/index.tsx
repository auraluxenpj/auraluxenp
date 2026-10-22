import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  bannerIsLive,
  fetchBanners,
  fetchCategories,
  fetchProducts,
  fetchTestimonials,
  type Product,
} from "@/lib/data";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { useSettings, whatsappLink } from "@/lib/store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Auraluxe — Premium Ladies' Fashion in Nepalgunj" },
      {
        name: "description",
        content:
          "Shop hand-finished kurtis, co-ord sets, suits, dresses and party wear from Auraluxe, Nepalgunj. Secure QR or bank transfer payment across Nepal.",
      },
      { property: "og:title", content: "Auraluxe — Premium Ladies' Fashion in Nepalgunj" },
      {
        property: "og:description",
        content: "Hand-finished kurtis, co-ord sets and party wear, designed in Nepalgunj.",
      },
    ],
  }),
  component: Home,
});

function SectionHeading({ eyebrow, title, to }: { eyebrow: string; title: string; to?: string }) {
  return (
    <div className="mt-14 flex items-end justify-between">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="mt-2 font-display text-4xl">{title}</h2>
      </div>
      {to ? (
        <Link
          to="/shop"
          className="hidden text-[13px] uppercase tracking-[0.18em] text-foreground/60 underline decoration-accent decoration-2 underline-offset-4 hover:text-brand sm:block"
        >
          View all
        </Link>
      ) : null}
    </div>
  );
}

function Grid({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <p className="glass mt-6 rounded-3xl p-8 text-sm text-muted-foreground">
        Nothing here yet — new pieces are being added.
      </p>
    );
  }
  return (
    <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

  const hero = banners.filter((b) => b.placement === "hero" && bannerIsLive(b))[0];
  const promo = banners.filter((b) => b.placement === "promo" && bannerIsLive(b))[0];

  const newCollection = products.filter((p) => p.is_new).slice(0, 3);
  const trending = products.filter((p) => p.is_featured).slice(0, 3);
  const bestSellers = products.filter((p) => p.is_bestseller).slice(0, 3);
  const offers = products.filter((p) => p.sale_price != null && Number(p.sale_price) > 0).slice(0, 3);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="glass-strong relative overflow-hidden rounded-3xl p-8 sm:p-12 lg:col-span-7">
          <div className="max-w-md">
            <p className="eyebrow">Nepalgunj · Est. 2024</p>
            <h1 className="mt-5 font-display text-5xl leading-[1.02] sm:text-6xl">
              {hero?.title ?? "The season's silhouette, cut for comfort."}
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              {hero?.subtitle ??
                "Hand-finished kurtis, co-ord sets and party wear in breathable georgette and cotton — designed in Nepalgunj, delivered to your door."}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/shop"
                className="rounded-full bg-primary px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-brand"
              >
                {hero?.button_text ?? "Shop New In"}
              </Link>
              <Link
                to="/about"
                className="text-[13px] uppercase tracking-[0.18em] text-foreground/70 underline decoration-accent decoration-2 underline-offset-4 transition hover:text-brand"
              >
                Our story
              </Link>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5">
          <img
            src={hero?.image_url ?? "/images/hero-auraluxe.jpg"}
            alt="Auraluxe lavender georgette kurti"
            width={1088}
            height={1408}
            className="h-full min-h-[320px] w-full rounded-3xl object-cover"
          />
        </div>
      </section>

      {/* Featured categories */}
      <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {categories
          .filter((c) => c.is_active)
          .slice(0, 4)
          .map((c) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ category: c.slug }}
              className="glass flex items-center justify-between rounded-2xl px-5 py-4 text-left transition hover:border-brand/40"
            >
              <span className="font-display text-lg">{c.name}</span>
              <span className="text-sm text-brand">→</span>
            </Link>
          ))}
      </section>

      <SectionHeading eyebrow="Just landed" title="New Collection" to="/shop" />
      <Grid products={newCollection} />

      {/* Promotional banner */}
      {promo ? (
        <section className="glass-strong mt-14 overflow-hidden rounded-3xl bg-gradient-to-r from-brand/20 via-secondary to-accent/25 px-8 py-10 sm:px-12">
          <div className="max-w-lg">
            <p className="eyebrow">Limited offer</p>
            <h2 className="mt-3 font-display text-4xl">{promo.title}</h2>
            <p className="mt-3 text-[15px] text-muted-foreground">{promo.subtitle}</p>
            <Link
              to="/shop"
              className="mt-6 inline-block rounded-full bg-primary px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary-foreground transition hover:bg-brand"
            >
              {promo.button_text ?? "Shop the sale"}
            </Link>
          </div>
        </section>
      ) : null}

      <SectionHeading eyebrow="Loved right now" title="Trending Now" to="/shop" />
      <Grid products={trending} />

      <SectionHeading eyebrow="Most wanted" title="Best Sellers" to="/shop" />
      <Grid products={bestSellers} />

      <SectionHeading eyebrow="Reduced this week" title="Special Offers" to="/shop" />
      <Grid products={offers} />

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
      <section className="glass-strong mt-14 grid gap-8 rounded-3xl p-8 sm:p-12 md:grid-cols-2">
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
