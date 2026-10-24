import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import {
  effectivePrice,
  fetchProductBySlug,
  fetchProducts,
  fetchVariantsForProduct,
  productImage,
} from "@/lib/data";
import { sizeStockLabel, sizeStocks, stockForSize } from "@/lib/size-stock";
import { useCart, useMoney, useSettings, whatsappLink } from "@/lib/store";
import { requiredOptionLabels } from "@/lib/product-options";
import { PhotoZoom } from "@/components/site/PhotoZoom";

export const Route = createFileRoute("/shop/product/$slug")({
  head: ({ params }) => {
    const pretty = params.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      meta: [
        { title: `${pretty} — Auraluxe` },
        {
          name: "description",
          content: `${pretty} from Auraluxe, Nepalgunj. Sizes, colours, fabric details and secure QR or bank transfer payment across Nepal.`,
        },
        { property: "og:title", content: `${pretty} — Auraluxe` },
        {
          property: "og:description",
          content: `${pretty} from Auraluxe, Nepalgunj. Secure QR or bank transfer payment across Nepal.`,
        },
      ],
    };
  },
  component: ProductDetail,
});

function ProductDetail() {
  const { slug } = Route.useParams();
  const money = useMoney();
  const settings = useSettings();
  const { add } = useCart();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug),
  });
  const { data: all = [] } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const productId = product?.id ?? null;
  const { data: variants = [] } = useQuery({
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
    const comboStock = effectiveSize ? stockForSize(variants, effectiveSize, effectiveColor) : null;
    const sizeTotalStock = effectiveSize ? stockForSize(variants, effectiveSize) : null;
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
        <p className="glass mt-10 rounded-3xl p-8 text-sm text-muted-foreground">Loading piece…</p>
      </SiteLayout>
    );
  }

  if (!product || !derived) {
    return (
      <SiteLayout>
        <div className="glass mt-10 rounded-3xl p-8">
          <h1 className="font-display text-3xl">Piece not found</h1>
          <Link to="/shop" className="mt-4 inline-block text-sm text-brand underline">
            Back to the shop
          </Link>
        </div>
      </SiteLayout>
    );
  }

  const d = derived;
  const price = effectivePrice(product);
  const hasDiscount = product.sale_price != null && Number(product.sale_price) > 0;
  const images = product.images?.length ? product.images : [productImage(product)];
  const headerStock = d.comboStock ?? d.sizeTotalStock ?? product.stock;
  const comboEmpty = d.comboStock != null && d.comboStock <= 0 && (d.sizeTotalStock ?? 0) > 0;
  const outOfStock =
    product.stock <= 0 || d.allSizesSoldOut || (d.effectiveSize != null && d.sizeSoldOut);
  const missingOptions = requiredOptionLabels(product, d.effectiveSize, d.effectiveColor);
  const related = all.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 3);

  const chosen = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
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
          Home
        </Link>{" "}
        /{" "}
        <Link to="/shop" className="hover:text-brand">
          Shop
        </Link>{" "}
        / <span className="text-foreground/70">{product.name}</span>
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
                  alt={`${product.name} view ${i + 1}`}
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
                  aria-label="Previous image"
                  onClick={() => goTo(Math.max(0, active - 1))}
                  className="absolute left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground shadow disabled:opacity-0"
                  disabled={active === 0}
                >
                  ‹
                </button>
                <button
                  type="button"
                  aria-label="Next image"
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
                <button key={img + i} type="button" onClick={() => goTo(i)}>
                  <img
                    src={img}
                    alt={`${product.name} view ${i + 1}`}
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

        <div className="glass rounded-3xl p-6 sm:p-8">
          <p className="eyebrow">{product.fabric}</p>
          <h1 className="mt-2 font-display text-4xl leading-tight">{product.name}</h1>

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

          <p className="mt-2 text-[12px] uppercase tracking-[0.18em] text-muted-foreground">
            {outOfStock
              ? "Out of stock"
              : comboEmpty
                ? "Sold out in this colour — please pick another"
                : headerStock <= product.low_stock_threshold
                  ? `Only ${headerStock} left`
                  : "In stock"}
            {product.sku ? ` · SKU ${product.sku}` : ""}
          </p>

          {product.sizes?.length ? (
            <div className="mt-6">
              <p className="label-caps text-muted-foreground">Size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((s) => {
                  const entry = d.sizeStocksList?.find((e) => e.size === s);
                  const soldOut = entry?.stock != null && entry.stock <= 0;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={soldOut}
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
                <p className="mt-2 text-xs text-destructive">Please select a size</p>
              ) : null}
            </div>
          ) : null}

          {product.colors?.length ? (
            <div className="mt-5">
              <p className="label-caps text-muted-foreground">Colour</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.colors.map((c) => (
                  <button
                    key={c}
                    type="button"
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
                <p className="mt-2 text-xs text-destructive">Please select a colour</p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <p className="label-caps text-muted-foreground">Quantity</p>
            <div className="glass flex items-center rounded-full">
              <button
                type="button"
                className="px-4 py-2"
                onClick={() => setQuantity((q) => Math.max(1, Math.min(q, d.maxQty ?? q) - 1))}
              >
                −
              </button>
              <span className="w-8 text-center text-sm">{d.qty}</span>
              <button
                type="button"
                className="px-4 py-2"
                onClick={() =>
                  setQuantity((q) => Math.min(d.maxQty ?? Number.POSITIVE_INFINITY, Math.max(q, 1) + 1))
                }
              >
                +
              </button>
            </div>
            {d.maxQty != null && d.maxQty > 0 ? (
              <span className="text-xs text-muted-foreground">Max {d.maxQty}</span>
            ) : null}
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={outOfStock || comboEmpty || missingOptions.length > 0}
              onClick={() => {
                add(chosen);
                toast.success("Added to your bag");
              }}
              className="flex-1 rounded-full border border-brand/30 bg-secondary py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary disabled:opacity-50"
            >
              Add to bag
            </button>
            <Link
              to="/checkout"
              disabled={outOfStock}
              onClick={(e) => {
                if (missingOptions.length) {
                  e.preventDefault();
                  toast.error(`Please select a ${missingOptions.join(" and ")}`);
                  return;
                }
                if (comboEmpty) {
                  e.preventDefault();
                  toast.error("That colour is sold out in this size — please pick another");
                  return;
                }
                add(chosen);
              }}
              className="flex-1 rounded-full bg-primary py-3.5 text-center text-[12px] uppercase tracking-[0.18em] text-primary-foreground"
            >
              Buy now
            </Link>
          </div>

          <a
            href={whatsappLink(
              settings["whatsapp"] ?? "",
              `Hello Auraluxe! I'm interested in ${product.name} (${product.sku ?? product.slug}).`,
            )}
            target="_blank"
            rel="noreferrer"
            className="mt-3 block rounded-full border border-brand/30 bg-secondary py-3.5 text-center text-[12px] uppercase tracking-[0.18em] text-primary"
          >
            Ask on WhatsApp
          </a>

          {product.description ? (
            <p className="mt-7 whitespace-pre-line border-t border-border pt-6 text-[15px] leading-relaxed text-muted-foreground">
              {product.description}
            </p>
          ) : null}

          {product.size_chart ? (
            <div className="mt-5 rounded-2xl bg-secondary p-4">
              <p className="label-caps text-muted-foreground">Size chart</p>
              <p className="mt-2 whitespace-pre-line text-sm">{product.size_chart}</p>
            </div>
          ) : null}
        </div>
      </section>

      {related.length > 0 ? (
        <>
          <div className="mt-14">
            <p className="eyebrow">You may also like</p>
            <h2 className="mt-2 font-display text-4xl">Related pieces</h2>
          </div>
          <section className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </section>
        </>
      ) : null}
      {zoomed ? <PhotoZoom src={images[active] ?? images[0] ?? ""} alt={`${product.name} view ${active + 1}`} onClose={() => setZoomed(false)} /> : null}
    </SiteLayout>
  );
}
