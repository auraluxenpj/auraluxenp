import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { getPublicCollectionSeo } from "@/lib/seo.functions";
import { categoryLabel, localizedContent, useLanguage } from "@/lib/i18n";
import { productImages } from "@/lib/data";

const SITE_ORIGIN = "https://www.auraluxe.com.np";
const COLLECTION_COPY: Record<string, { description: string; descriptionNe: string; metaDescription: string }> = {
  "party-wear": {
    description: "Discover embroidered suits and coordinated ethnic sets for weddings, festivities and special occasions. Explore available styles, sizes and prices at Auraluxe Nepalgunj.",
    descriptionNe: "औरलक्स नेपालगञ्जमा उत्सव, विवाह तथा विशेष अवसरका लागि कढाइ गरिएका सूट, मिल्दो एथनिक सेट र आकर्षक पहिरनहरू हेर्नुहोस्। प्रत्येक उत्पादनको विवरण र मूल्य उपलब्ध छ।",
    metaDescription: "Shop embroidered party suits, ethnic sets and occasion outfits at Auraluxe Nepalgunj. Explore current styles, details and prices.",
  },
  sarees: {
    description: "Discover sarees at Auraluxe Nepalgunj, from graceful chiffon and georgette styles to silk, organza and traditional prints. Explore the current collection for festive occasions, family functions and elegant everyday dressing.",
    descriptionNe: "औरलक्स नेपालगञ्जमा आकर्षक सिफन र जर्जेटदेखि सिल्क, अर्गान्जा तथा परम्परागत प्रिन्टका साडीहरू हेर्नुहोस्। चाडपर्व, पारिवारिक समारोह र दैनिक पहिरनका लागि उपलब्ध शैलीहरू अन्वेषण गर्नुहोस्।",
    metaDescription: "Explore chiffon, georgette, silk and printed sarees at Auraluxe Nepalgunj. View current designs, product details and prices.",
  },
  accessories: {
    description: "Complete your look with the Auraluxe accessories edit in Nepalgunj. Explore earrings, hair clips, scrunchies, hair accessories and small finishing touches selected to complement traditional and everyday outfits.",
    descriptionNe: "औरलक्स नेपालगञ्जको एसेसरिज संग्रहबाट आफ्नो पहिरनलाई अझ आकर्षक बनाउनुहोस्। इयररिङ, हेयर क्लिप, स्क्रन्ची र दैनिक तथा परम्परागत पहिरनसँग मिल्ने अन्य सामग्री हेर्नुहोस्।",
    metaDescription: "Shop earrings, hair clips, scrunchies and fashion accessories at Auraluxe Nepalgunj. Browse current pieces and prices.",
  },
  purse: {
    description: "Browse handbags, clutch wallets and everyday purses in the Auraluxe collection at Nepalgunj. Compare the current colours, designs, product details and prices to find a finishing touch for daywear or special occasions.",
    descriptionNe: "औरलक्स नेपालगञ्जको संग्रहमा ह्यान्डब्याग, क्लच वालेट र दैनिक प्रयोगका पर्सहरू हेर्नुहोस्। उपलब्ध रङ, डिजाइन, उत्पादन विवरण र मूल्य तुलना गर्नुहोस्।",
    metaDescription: "Explore handbags, clutches and wallets at Auraluxe Nepalgunj. Browse current purse styles, product details and prices.",
  },
  "winter-wear": {
    description: "Explore winter-ready ethnic clothing at Auraluxe Nepalgunj, including warm suit sets, shawls and woollen styles. View the current selection with fabric details, available sizes and prices listed on each product.",
    descriptionNe: "औरलक्स नेपालगञ्जमा न्यानो सूट सेट, सल र ऊनी शैलीका जाडोका एथनिक पहिरनहरू हेर्नुहोस्। प्रत्येक उत्पादनमा कपडा, उपलब्ध साइज र मूल्यको विवरण हेर्न सकिन्छ।",
    metaDescription: "Shop winter suit sets, shawls and woollen ethnic wear at Auraluxe Nepalgunj. View current styles, sizes and prices.",
  },
  "plus-size": {
    description: "Discover the plus-size edit at Auraluxe Nepalgunj, featuring selected ethnic outfits and occasion styles. Check each product page for its specific measurements, fit information, availability and price before ordering.",
    descriptionNe: "औरलक्स नेपालगञ्जको प्लस-साइज संग्रहमा उपलब्ध एथनिक पहिरन र विशेष अवसरका शैलीहरू हेर्नुहोस्। अर्डर गर्नुअघि प्रत्येक उत्पादनको नाप, फिट, उपलब्धता र मूल्य जाँच गर्नुहोस्।",
    metaDescription: "Explore plus-size ethnic outfits and occasion styles at Auraluxe Nepalgunj. Check product fit details, availability and prices.",
  },
  "kurti-set": {
    description: "Browse coordinated kurti sets at Auraluxe Nepalgunj, with selected styles for everyday dressing, work and family occasions. Open each product to review its fabric, set details, available sizes and current price.",
    descriptionNe: "औरलक्स नेपालगञ्जमा दैनिक पहिरन, कार्यालय र पारिवारिक अवसरका लागि उपलब्ध मिल्दो कुर्ती सेटहरू हेर्नुहोस्। कपडा, सेटको विवरण, साइज र मूल्य प्रत्येक उत्पादनमा जाँच गर्नुहोस्।",
    metaDescription: "Shop coordinated women's kurti sets at Auraluxe Nepalgunj. Explore current styles, fabric details, sizes and prices.",
  },
  bottom: {
    description: "Find women's bottom wear at Auraluxe Nepalgunj, including straight pants and palazzo styles to pair with kurtis and ethnic tops. Review each listing for its fabric, fit, available sizes and price.",
    descriptionNe: "औरलक्स नेपालगञ्जमा कुर्ती तथा एथनिक टपसँग लगाउन मिल्ने स्ट्रेट प्यान्ट र पलाजो शैलीका बटम वेयर हेर्नुहोस्। कपडा, फिट, साइज र मूल्य प्रत्येक उत्पादनमा जाँच गर्नुहोस्।",
    metaDescription: "Explore women's straight pants and palazzo styles at Auraluxe Nepalgunj. Check fabric, fit, sizes and current prices.",
  },
  dress: {
    description: "Discover women's dresses in the Auraluxe Nepalgunj collection. Explore the current styles and open each product page for its design details, fit, availability and price.",
    descriptionNe: "औरलक्स नेपालगञ्जको संग्रहमा उपलब्ध महिलाका ड्रेसहरू हेर्नुहोस्। डिजाइन, फिट, उपलब्धता र मूल्यको जानकारीका लागि प्रत्येक उत्पादनको पृष्ठ खोल्नुहोस्।",
    metaDescription: "Browse women's dresses at Auraluxe Nepalgunj. Explore current designs, product details, availability and prices.",
  },
};

function fitMetaDescription(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 160) return normalized;
  const candidate = normalized.slice(0, 159);
  const boundary = candidate.lastIndexOf(" ");
  return `${candidate.slice(0, boundary >= 115 ? boundary : 159).trim()}…`;
}


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
    const collectionCopy = COLLECTION_COPY[category.slug];
    const savedDescription = category.description?.trim() ?? "";
    const description = fitMetaDescription(
      savedDescription.length >= 70
        ? savedDescription
        : collectionCopy?.metaDescription ??
          `Explore the ${category.name.toLowerCase()} collection at Auraluxe Nepalgunj. Browse current styles, prices and availability, with delivery across Nepal.`,
    );
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
        { name: "robots", content: products.length > 0 ? "index,follow,max-image-preview:large" : "noindex,follow" },
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
  const collectionCopy = COLLECTION_COPY[category.slug];
  const savedDescription = category.description?.trim() ?? "";
  const description = localizedContent(
    savedDescription.length >= 70
      ? savedDescription
      : collectionCopy?.description ??
        `Explore the ${category.name.toLowerCase()} collection at Auraluxe Nepalgunj. Browse current styles, prices and availability, with delivery across Nepal.`,
    category.description_ne || collectionCopy?.descriptionNe,
    language,
  );
  const heroImage = category.image_url || products.flatMap(productImages)[0];

  return (
    <SiteLayout>
      <section className="mt-5 sm:mt-10">
        <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[.16em] text-stone-500">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-primary">Shop</Link>
          <span>/</span>
          <span aria-current="page" className="text-primary">{name}</span>
        </nav>
        <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-[minmax(0,1fr)_minmax(260px,.72fr)] md:items-center md:gap-6">
          <div>
            <p className="auraluxe-kicker">Auraluxe Nepalgunj</p>
            <h1 className="mt-2 font-display text-4xl leading-[.98] text-[#422d2a] sm:mt-3 sm:text-6xl">{name} Collection</h1>
            <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-stone-600 sm:mt-4 sm:line-clamp-none sm:text-base sm:leading-7">{description}</p>
          </div>
          {heroImage ? (
            <img src={heroImage} alt={`${name} collection at Auraluxe`} width={900} height={1125} fetchPriority="high" className="mx-auto aspect-[4/5] max-h-[560px] w-full rounded-sm bg-[#eee5dc] object-contain md:aspect-[4/5]" />
          ) : null}
        </div>
      </section>

      <section className="mt-8 sm:mt-12" aria-labelledby="collection-products">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="auraluxe-kicker">Explore the edit</p>
            <h2 id="collection-products" className="mt-2 font-display text-2xl text-[#422d2a] sm:text-3xl">{name} at Auraluxe</h2>
          </div>
          <Link to="/shop" className="text-xs uppercase tracking-[.15em] text-primary underline underline-offset-4">Browse all products</Link>
        </div>
        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:gap-5 lg:grid-cols-3">
            {products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#e9dfd5] bg-[#fffdf9] px-6 py-12 text-center">
            <h3 className="font-display text-2xl text-[#422d2a]">This collection is being refreshed</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-600">There are no published pieces in this collection right now. Explore the full Auraluxe selection instead.</p>
            <Link to="/shop" className="mt-5 inline-flex rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[.16em] text-primary-foreground">Browse all products</Link>
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
