import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { getPublicCollectionSeo } from "@/lib/seo.functions";
import { categoryLabel, localizedContent, useLanguage } from "@/lib/i18n";
import { productImages } from "@/lib/data";

const SITE_ORIGIN = "https://www.auraluxe.com.np";

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export const Route = createFileRoute("/collections/$slug")({
  loader: async ({ params }) => {
    const collection = await getPublicCollectionSeo({ data: params.slug });
    if (!collection) throw notFound();
    return collection;
  },
  head: ({ params, loaderData }) => {
    const collection = loaderData;
    if (!collection) {
      return {
        meta: [
          { title: "Collection not found — Auraluxe" },
          { name: "robots", content: "noindex,follow" },
        ],
      };
    }

    const { category, products } = collection;
    const canonicalUrl = `${SITE_ORIGIN}/collections/${encodeURIComponent(params.slug)}`;
    const description = (
      category.description?.trim() ||
      `Explore the ${category.name.toLowerCase()} collection at Auraluxe Nepalgunj. Browse available styles, current prices and stock, with delivery across Nepal.`
    ).slice(0, 160);
    const title = `${category.name} Collection in Nepal | Auraluxe Nepalgunj`;
    const image = category.image_url || products.flatMap(productImages)[0];

    const collectionSchema = {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "@id": `${canonicalUrl}#collection`,
      name: `${category.name} Collection — Auraluxe`,
      description,
      url: canonicalUrl,
      isPartOf: { "@type": "WebSite", name: "Auraluxe", url: SITE_ORIGIN },
      mainEntity: {
        "@type": "ItemList",
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: product.name,
          url: `${SITE_ORIGIN}/shop/product/${encodeURIComponent(product.slug)}`,
        })),
      },
    };
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_ORIGIN}/shop` },
        { "@type": "ListItem", position: 3, name: category.name, item: canonicalUrl },
      ],
    };

    return {
      links: [{ rel: "canonical", href: canonicalUrl }],
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index,follow,max-image-preview:large" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: canonicalUrl },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      scripts: [
        { type: "application/ld+json", children: safeJsonLd(collectionSchema) },
        { type: "application/ld+json", children: safeJsonLd(breadcrumbSchema) },
      ],
    };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { category, products } = Route.useLoaderData();
  const { language } = useLanguage();
  const name = categoryLabel(category.slug, category.name, language, category.name_ne);
  const description = localizedContent(
    category.description || `Explore the ${category.name.toLowerCase()} collection at Auraluxe Nepalgunj. Browse available styles, current prices and stock, with delivery across Nepal.`,
    category.description_ne,
    language,
  );
  const heroImage = category.image_url || products.flatMap(productImages)[0];

  return (
    <SiteLayout>
      <section className="mt-8 sm:mt-12">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[.16em] text-stone-500">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary">Shop</Link>
          <span>/</span>
          <span aria-current="page" className="text-primary">{name}</span>
        </nav>
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,.72fr)] md:items-center">
          <div>
            <p className="auraluxe-kicker">Auraluxe Nepalgunj</p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-[#422d2a] sm:text-6xl">{name} Collection</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base">{description}</p>
            <p className="mt-4 text-xs uppercase tracking-[.15em] text-stone-500">
              {products.length} {products.length === 1 ? "published piece" : "published pieces"}
            </p>
          </div>
          {heroImage ? (
            <img src={heroImage} alt={`${name} collection at Auraluxe`} width={900} height={700} fetchPriority="high" className="aspect-[5/4] w-full rounded-sm bg-[#eee5dc] object-cover" />
          ) : null}
        </div>
      </section>

      <section className="mt-10 sm:mt-14" aria-labelledby="collection-products">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="auraluxe-kicker">Explore the edit</p>
            <h2 id="collection-products" className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">{name} at Auraluxe</h2>
          </div>
          <Link to="/shop" className="text-xs uppercase tracking-[.15em] text-primary underline underline-offset-4">Browse all products</Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {products.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      </section>
    </SiteLayout>
  );
}
