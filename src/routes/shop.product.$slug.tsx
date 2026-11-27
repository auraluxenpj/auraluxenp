import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import {
  effectivePrice,
  hasDiscount as productHasDiscount,
  fetchProductBySlug,
  fetchProducts,
  fetchVariantsForProduct,
  productImage,
  productImages,
} from "@/lib/data";
import { sizeStockLabel, sizeStocks, stockForSize } from "@/lib/size-stock";
import { useCart, useMoney, useSettings, whatsappLink, whatsappProductMessage } from "@/lib/store";
import { requiredOptionLabels } from "@/lib/product-options";
import { PhotoZoom } from "@/components/site/PhotoZoom";
import { WomensSizeGuide } from "@/components/site/WomensSizeGuide";
import { PHOTO_DISCLAIMER } from "@/lib/product-information";
import { localizedContent, useLanguage } from "@/lib/i18n";
import { getPublicProductSeo } from "@/lib/seo.functions";

const SITE_ORIGIN = "https://www.auraluxe.com.np";

function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\\u2028/g, "\\\\u2028")
    .replace(/\\u2029/g, "\\\\u2029");
}

export const Route = createFileRoute("/shop/product/$slug")({
  loader: ({ params }) => getPublicProductSeo({ data: params.slug }),
  head: ({ params, loaderData }) => {
    const product = loaderData;
    const canonicalUrl = `${SITE_ORIGIN}/shop/product/${encodeURIComponent(params.slug)}`;

    if (!product) {
      return {
        links: [{ rel: "canonical", href: canonicalUrl }],
        meta: [
          { title: "Product not found — Auraluxe" },
          { name: "robots", content: "noindex,follow" },
        ],
      };
    }

    const regularPrice = Number(product.price);
    const salePrice = Number(product.sale_price);
    const price = product.sale_price != null && salePrice > 0 && salePrice < regularPrice
      ? salePrice
      : regularPrice;
    const description = (
      product.meta_description?.trim() ||
      product.description?.trim() ||
      `Shop ${product.name} at Auraluxe Nepalgunj. View product details, price and availability.`
    ).slice(0, 300);
    const title = product.meta_title?.trim() || `${product.name} | Auraluxe Nepalgunj`;
    const images = (product.images ?? []).filter(
      (image): image is string => typeof image === "string" && /^https?:\\/\\//i.test(image),
    );
    const availability = Number(product.stock) > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";
    const productSchema = {
      "@context": "https://schema.org",
      "@type": "Product",
      "@id": `${canonicalUrl}#product`,
      name: product.name,
      url: canonicalUrl,
      ...(description ? { description } : {}),
      ...(images.length ? { image: images } : {}),
      ...(product.sku ? { sku: product.sku } : {}),
      ...(product.categories?.name ? { category: product.categories.name } : {}),
      brand: { "@type": "Brand", name: "Auraluxe" },
      offers: {
        "@type": "Offer",
        url: canonicalUrl,
        priceCurrency: "NPR",
        price: Number.isFinite(price) ? String(price) : "0",
        availability,
        itemCondition: "https://schema.org/NewCondition",
        seller: { "@type": "Organization", name: "Auraluxe" },
      },
    };
    const breadcrumbSchema = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_ORIGIN },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_ORIGIN}/shop` },
        ...(product.categories?.name
          ? [{ "@type": "ListItem", position: 3, name: product.categories.name }]
          : []),
        {
          "@type": "ListItem",
          position: product.categories?.name ? 4 : 3,
          name: product.name,
          item: canonicalUrl,
        },
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
        { property: "og:type", content: "product" },
        { property: "og:url", content: canonicalUrl },
        ...(images[0] ? [{ property: "og:image", content: images[0] }] : []),
        { name: "twitter:card", content: images[0] ? "summary_large_image" : "summary" },
        ...(images[0] ? [{ name: "twitter:image", content: images[0] }] : []),
      ],
      scripts: [
        { type: "application/ld+json", children: safeJsonLd(productSchema) },
        { type: "application/ld+json", children: safeJsonLd(breadcrumbSchema) },
      ],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const money = useMoney();
  const { t, language } = useLanguage();
  const settings = useSettings();
  const { add } = useCart();

  const {
    data: product,
    isLoading,
    isError: productError,
    refetch: retryProduct,
  } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug),
  });
  const { data: all = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const productId = product?.id ?? null;
  const {
    data: variants = [],
    isLoading: variantsLoading,
    isError: variantsError,
    refetch: retryVariants,
  } = useQuery({
    queryKey: ["product-variants", productId],
    queryFn: () => fetchVariantsForProduct(productId as string),
    enabled: productId != null,
  });

  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  // Per-size stock comes from tracked variants; pieces without any fall back
  // to the single product-level stock figure.
  const derived = useMemo(() => {
    if (!product) return null;
    const sizeStocksList = sizeStocks(product, variants);
    const effectiveSize = size ?? (product.sizes?.length === 1 ? product.sizes[0] ?? null : null);
    const effectiveColor = color ?? (product.colors?.length === 1 ? product.colors[0] ?? null : null);
    // A single generic BizSathi-mapped variant represents pooled SKU stock.
    // Do not interpret its lack of a size label as zero stock for every size.
    const hasSizeTrackedVariants = variants.some((variant) => Boolean(variant.size?.trim()));
    const comboStock = effectiveSize && hasSizeTrackedVariants
      ? stockForSize(variants, effectiveSize, effectiveColor)
      : null;
    const sizeTotalStock = effectiveSize && hasSizeTrackedVariants
      ? stockForSize(variants, effectiveSize)
      : null;
    const maxQty = comboStock ?? sizeTotalStock;
    const qty = Math.max(1, Math.min(quantity, maxQty ?? quantity));
    const allSizesSoldOut =
      !!sizeStocksList &&
      sizeStocksList.length > 0 &&
      sizeStocksList.every((e) => e.stock != null && e.stock <= 0);
    const sizeSoldOut = (sizeTotalStock ?? 1) <= 0;
    return {
      sizeStocksList,
      effectiveSize,
      effectiveColor,
      comboStock,
      sizeTotalStock,
      maxQty,
      qty,
      allSizesSoldOut,
      sizeSoldOut,
    };
  }, [product, variants, size, color, quantity]);

  const sliderRef = useRef<HTMLDivElement>(null);
  const goTo = (i: number) => {
    const el = sliderRef.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setActive(i);
  };

  if (isLoading) {
    return (
      <SiteLayout>
        <p className="glass mt-10 rounded-3xl p-8 text-sm text-muted-foreground">{t("loadingCollection")}</p>
      </SiteLayout>
    );
  }

  if (productError) {
    return (
      <SiteLayout>
        <div role="alert" className="glass mt-10 rounded-3xl p-8">
          <h1 className="font-display text-3xl">This product could not be loaded</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Please check your connection and try again.
          </p>
          <button
            type="button"
            onClick={() => void retryProduct()}
            className="mt-5 rounded-full bg-primary px-6 py-3 text-xs uppercase tracking-[0.16em] text-primary-foreground"
          >
            Try again
          </button>
          <Link to="/shop" className="ml-4 inline-block text-sm text-brand underline">
            {t("backToShop")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  if (!product || !derived) {
    return (
      <SiteLayout>
        <div className="glass mt-10 rounded-3xl p-8">
          <h1 className="font-display text-3xl">{t("pieceNotFound")}</h1>
          <Link to="/shop" className="mt-4 inline-block text-sm text-brand underline">
            {t("backToShop")}
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const d = derived;
  const displayName = localizedContent(product.name, product.name_ne, language);
  const displayDescription = localizedContent(product.description, product.description_ne, language);
  const displayFabric = localizedContent(product.fabric, product.fabric_ne, language);
  const price = effectivePrice(product);
  const hasDiscount = productHasDiscount(product);
  const realProductImages = productImages(product);
  const baseImages = realProductImages.length ? realProductImages : [productImage(product)];
  const exactVariantImage = variants.find((variant) =>
    variant.image_url &&
    (!d.effectiveSize || variant.size === d.effectiveSize) &&
    (!d.effectiveColor || variant.color === d.effectiveColor)
  )?.image_url;
  const sizeVariantImage = variants.find((variant) =>
    variant.image_url && d.effectiveSize && variant.size === d.effectiveSize
  )?.image_url;
  // BizSathi's SKU can represent pooled stock across several website size options.
  const genericSkuImage = variants.find((variant) =>
    variant.image_url && !variant.size && !variant.color
  )?.image_url;
  const selectedVariantImage = exactVariantImage ?? sizeVariantImage ?? genericSkuImage;
  const images = selectedVariantImage
    ? [selectedVariantImage, ...baseImages.filter((image) => image !== selectedVariantImage)]
    : baseImages;
  const comboEmpty = d.comboStock != null && d.comboStock <= 0 && (d.sizeTotalStock ?? 0) > 0;
  const outOfStock =
    product.stock <= 0 || d.allSizesSoldOut || (d.effectiveSize != null && d.sizeSoldOut);
  const missingOptions = requiredOptionLabels(product, d.effectiveSize, d.effectiveColor);
  const related = all.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 3);

  const chosen = {
    productId: product.id,
    slug: product.slug,
    name: displayName,
    image: images[0] ?? null,
    price,
    size: d.effectiveSize,
    color: d.effectiveColor,
    quantity: d.qty,
  };

  return (
    <SiteLayout>
      <nav className="mt-8 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/" className="hover:text-brand">
          {t("home")}
        </Link>{" "}
        /{" "}
        <Link to="/shop" className="hover:text-brand">
          {t("shop")}
        </Link>{" "}
        / <span className="text-foreground/70">{displayName}</span>
      </nav>

      <section className="mt-6 grid gap-8 lg:grid-cols-2">
        <div>
          <div className="relative">
            <div
              ref={sliderRef}
              onScroll={(e) => {
                const el = e.currentTarget;
                const i = Math.round(el.scrollLeft / el.clientWidth);
                if (i !== active) setActive(i);
              }}
              className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {images.map((img, i) => (
                <img
                  key={img + i}
                  src={img}
                  alt={`${displayName} view ${i + 1}`}
                  loading={i === 0 ? "eager" : "lazy"}
                  width={1024}
                  height={1280}
                  onClick={() => setZoomed(true)}
                  className="aspect-[4/5] w-full shrink-0 cursor-zoom-in snap-center bg-muted object-cover"
                />
              ))}
            </div>
            {images.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label={t("previousImage")}
                  onClick={() => goTo(Math.max(0, active - 1))}
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow disabled:opacity-0"
                  disabled={active === 0}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label={t("nextImage")}
                  onClick={() => goTo(Math.min(images.length - 1, active + 1))}
                  className="absolute right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow disabled:opacity-0"
                  disabled={active === images.length - 1}
                >
                  ›
                </button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {images.map((_, i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-background" : "w-1.5 bg-background/60"}`} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((img, i) => (
                <button key={img + i} type="button" onClick={() => goTo(i)} aria-label={`Show image ${i + 1} of ${images.length}`} aria-current={i === active ? "true" : undefined}>
                  <img
                    src={img}
                    alt={`${displayName} view ${i + 1}`}
                    loading="lazy"
                    width={256}
                    height={256}
                    className={`aspect-square w-full rounded-2xl object-cover ${i === active ? "ring-2 ring-brand" : ""}`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="auraluxe-product-buybox glass rounded-3xl p-6 sm:p-8 lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow">{displayFabric}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight">{displayName}</h1>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-display text-3xl text-primary">{money(price)}</span>
            {hasDiscount ? (
              <>
                <span className="text-sm text-muted-foreground line-through">
                  {money(Number(product.price))}
                </span>
                <span className="text-[11px] uppercase tracking-[0.2em] text-brand">
                  −{Math.round((1 - price / Number(product.price)) * 100)}%
                </span>
              </>
            ) : null}
          </div>

          {variantsError ? (
            <div role="alert" className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">
                Stock options could not be checked. Please retry before adding this item to your bag.
              </p>
              <button
                type="button"
                onClick={() => void retryVariants()}
                className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand underline"
              >
                Retry stock check
              </button>
            </div>
          ) : variantsLoading ? (
            <p role="status" className="mt-3 text-xs text-muted-foreground">
              Checking size and colour availability…
            </p>
          ) : null}

          <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
            {outOfStock
              ? t("outOfStockDetail")
              : comboEmpty
                ? t("soldOutColour")
                : t("inStock")}
            {product.sku ? ` · SKU ${product.sku}` : ""}
          </p>

          {product.sizes?.length ? (
            <div className="mt-6">
              <p className="label-caps text-muted-foreground">{t("size")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const entry = d.sizeStocksList?.find((e) => e.size === s);
                  const soldOut = entry?.stock != null && entry.stock <= 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={variantsLoading || variantsError || soldOut}
                      aria-pressed={d.effectiveSize === s}
                      onClick={() => setSize(s)}
                      className={`flex min-w-[4.5rem] flex-col items-center rounded-full px-5 py-2 text-[12px] uppercase tracking-[0.15em] ${
                        d.effectiveSize === s
                          ? "bg-primary text-primary-foreground"
                          : soldOut
                            ? "glass text-muted-foreground/60"
                            : "glass text-foreground/70"
                      } ${soldOut ? "cursor-not-allowed" : ""}`}
                    >
                      <span className={soldOut ? "line-through" : ""}>{s}</span>
                      {entry?.stock != null ? (
                        <span
                          className={`text-[10px] normal-case tracking-normal ${
                            soldOut ? "text-destructive/80" : "text-muted-foreground"
                          }`}
                        >
                          {sizeStockLabel(entry)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {(product.sizes?.length ?? 0) > 1 && !size ? (
                <p className="mt-2 text-xs text-destructive">{t("pleaseSelectSize")}</p>
              ) : null}
            </div>
          ) : null}

          {product.colors?.length ? (
            <div className="mt-5">
              <p className="label-caps text-muted-foreground">{t("colour")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={d.effectiveColor === c}
                    onClick={() => setColor(c)}
                    className={`rounded-full px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] ${
                      color === c
                        ? "bg-primary text-primary-foreground"
                        : "glass text-foreground/70"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              {(product.colors?.length ?? 0) > 1 && !color ? (
                <p className="mt-2 text-xs text-destructive">{t("pleaseSelectColour")}</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <p className="label-caps text-muted-foreground">{t("quantity")}</p>
            <div className="glass flex items-center rounded-full">
              <button
                type="button"
                aria-label={t("decreaseQuantity")}
                disabled={d.qty <= 1}
                className="px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => setQuantity((q) => Math.max(1, Math.min(q, d.maxQty ?? q) - 1))}
              >
                −
              </button>
              <span className="w-8 text-center text-sm" aria-live="polite" aria-atomic="true">{d.qty}</span>
              <button
                type="button"
                aria-label={t("increaseQuantity")}
                disabled={d.maxQty != null && d.qty >= d.maxQty}
                className="px-4 py-2 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() =>
                  setQuantity((q) => Math.min(d.maxQty ?? Number.POSITIVE_INFINITY, Math.max(q, 1) + 1))
                }
              >
                +
              </button>
            </div>
            {d.maxQty != null && d.maxQty > 0 ? (
              <span className="text-xs text-muted-foreground">{t("max")} {d.maxQty}</span>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={outOfStock || comboEmpty || missingOptions.length > 0 || variantsLoading || variantsError}
              onClick={() => {
                add(chosen);
                toast.success(t("addedBagToast"));
              }}
              className="flex-1 rounded-full border border-brand/30 bg-secondary py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary disabled:opacity-50"
            >
              {t("addToBag")}
            </button>
            <Link
              to="/checkout"
              disabled={outOfStock}
              onClick={(e) => {
                if (variantsLoading || variantsError) {
                  e.preventDefault();
                  toast.error("Please wait until stock availability has been confirmed.");
                  return;
                }
                if (missingOptions.length) {
                  e.preventDefault();
                  toast.error(`${t("pleaseSelect")} ${missingOptions.join(` ${t("and")} `)}`);
                  return;
                }
                if (comboEmpty) {
                  e.preventDefault();
                  toast.error(t("soldOutSize"));
                  return;
                }
                add(chosen);
              }}
              className="flex-1 rounded-full bg-primary py-3.5 text-center text-[12px] uppercase tracking-[0.18em] text-primary-foreground"
            >
              {t("buyNow")}
            </Link>
          </div>

          <a
            href={whatsappLink(
              settings["whatsapp"] ?? "",
              whatsappProductMessage("Namaste! I would like to enquire about this product.", [{ productId: product.id, slug: product.slug, name: displayName + (product.sku ? " (SKU: " + product.sku + ")" : ""), image: images[0] ?? null, price, size: d.effectiveSize, color: d.effectiveColor, quantity: d.qty }]),
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-full border border-brand/30 bg-secondary py-3.5 text-center text-[12px] uppercase tracking-[0.18em] text-primary"
          >
            {t("askWhatsApp")}
          </a>

          <div className="auraluxe-product-details mt-7 border-t border-border pt-6">
            {displayDescription ? <p className="whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">{displayDescription}</p> : null}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{PHOTO_DISCLAIMER}</p>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border pt-5 text-center sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
            <div className="auraluxe-service-item">
              <span aria-hidden="true">✓</span>
              <small>{t("qualityChecked")}</small>
            </div>
            <div className="auraluxe-service-item">
              <span aria-hidden="true">↗</span>
              <small>{t("secureCheckout")}</small>
            </div>
            <div className="auraluxe-service-item">
              <span aria-hidden="true">⌂</span>
              <small>{t("deliveryNepal")}</small>
            </div>
            <div className="auraluxe-service-item">
              <span aria-hidden="true">♡</span>
              <small>{t("personalAssistance")}</small>
            </div>
          </div>
          <WomensSizeGuide customChart={product.size_chart} />
        </div>
      </section>

      {related.length > 0 ? (
        <>
          <div className="mt-14">
            <p className="eyebrow">{t("youMayLike")}</p>
            <h2 className="mt-2 font-display text-4xl">{t("relatedPieces")}</h2>
          </div>
          <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </section>
        </>
      ) : null}
      {zoomed ? <PhotoZoom src={images[active] ?? images[0] ?? ""} alt={`${displayName} view ${active + 1}`} onClose={() => setZoomed(false)} /> : null}
    </SiteLayout>
  );
}
