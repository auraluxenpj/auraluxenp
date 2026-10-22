import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { effectivePrice, fetchProductBySlug, fetchProducts, productImage } from "@/lib/data";
import { useCart, useMoney, useSettings, whatsappLink } from "@/lib/store";

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

  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [active, setActive] = useState(0);

  if (isLoading) {
    return (
      <SiteLayout>
        <p className="glass mt-10 rounded-3xl p-8 text-sm text-muted-foreground">Loading piece…</p>
      </SiteLayout>
    );
  }

  if (!product) {
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

  const price = effectivePrice(product);
  const hasDiscount = product.sale_price != null && Number(product.sale_price) > 0;
  const images = product.images?.length ? product.images : [productImage(product)];
  const outOfStock = product.stock <= 0;
  const related = all.filter((p) => p.category_id === product.category_id && p.id !== product.id).slice(0, 3);

  const chosen = {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: images[0] ?? null,
    price,
    size: size ?? product.sizes?.[0] ?? null,
    color: color ?? product.colors?.[0] ?? null,
    quantity: qty,
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
          <img
            src={images[active] ?? images[0]}
            alt={product.name}
            width={1024}
            height={1280}
            className="aspect-[4/5] w-full rounded-3xl bg-muted object-cover"
          />
          {images.length > 1 ? (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {images.map((img, i) => (
                <button key={img + i} type="button" onClick={() => setActive(i)}>
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
              : product.stock <= product.low_stock_threshold
                ? `Only ${product.stock} left`
                : "In stock"}
            {product.sku ? ` · SKU ${product.sku}` : ""}
          </p>

          {product.sizes?.length ? (
            <div className="mt-6">
              <p className="label-caps text-muted-foreground">Size</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSize(s)}
                    className={`rounded-full px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] ${
                      (size ?? product.sizes[0]) === s
                        ? "bg-primary text-primary-foreground"
                        : "glass text-foreground/70"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
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
                      (color ?? product.colors[0]) === c
                        ? "bg-primary text-primary-foreground"
                        : "glass text-foreground/70"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-5 flex items-center gap-3">
            <p className="label-caps text-muted-foreground">Quantity</p>
            <div className="glass flex items-center rounded-full">
              <button type="button" className="px-4 py-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                −
              </button>
              <span className="w-8 text-center text-sm">{qty}</span>
              <button type="button" className="px-4 py-2" onClick={() => setQty((q) => q + 1)}>
                +
              </button>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={outOfStock}
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
              onClick={() => add(chosen)}
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
    </SiteLayout>
  );
}
