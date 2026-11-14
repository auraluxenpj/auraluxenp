import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { effectivePrice, hasDiscount, productImage, type StorefrontProduct } from "@/lib/data";
import { useCart, useMoney } from "@/lib/store";
import { toast } from "sonner";
import { QuickPickDialog } from "@/components/site/QuickPickDialog";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const money = useMoney();
  const { add } = useCart();
  const price = effectivePrice(product);
  const discounted = hasDiscount(product);
  const outOfStock = product.stock <= 0;
  const [picking, setPicking] = useState(false);

  // When the piece offers more than one size or colour, the shopper must
  // choose them before anything goes into the bag.
  const needsPick = (product.sizes?.length ?? 0) > 1 || (product.colors?.length ?? 0) > 1;

  const badge = product.is_new ? "New" : product.is_bestseller ? "Best Seller" : null;
  const discountPercent = discounted
    ? Math.round((1 - price / Number(product.price)) * 100)
    : 0;

  const quickAdd = () => {
    add({
      productId: product.id,
      slug: product.slug,
      name: product.name,
      image: productImage(product),
      price,
      size: product.sizes?.[0] ?? null,
      color: product.colors?.[0] ?? null,
      quantity: 1,
    });
    toast.success(`${product.name} added to your bag`);
  };

  return (
    <article className="group glass rounded-2xl p-2 transition hover:-translate-y-1 sm:rounded-3xl sm:p-3">
      <Link to="/shop/product/$slug" params={{ slug: product.slug }} className="relative block">
        <img
          src={productImage(product)}
          alt={product.name}
          loading="lazy"
          decoding="async"
          width={1024}
          height={1280}
          className="aspect-[4/5] w-full rounded-xl bg-muted object-cover sm:rounded-2xl"
        />
        {badge ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent/90 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-accent-foreground backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[10px]">
            {badge}
          </span>
        ) : null}
        {discounted && !outOfStock ? (
          <span className="absolute right-2 top-2 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold tracking-wide text-primary-foreground shadow-sm sm:right-3 sm:top-3 sm:px-3 sm:text-xs">
            {discountPercent}% OFF
          </span>
        ) : null}
        {outOfStock ? (
          <span className="absolute right-2 top-2 rounded-full bg-primary/90 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-primary-foreground sm:right-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[10px]">
            Sold out
          </span>
        ) : null}
      </Link>
      <div className="px-1 pb-1 pt-2 sm:px-2 sm:pb-2 sm:pt-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-sm leading-tight sm:min-h-0 sm:text-xl">
          <Link to="/shop/product/$slug" params={{ slug: product.slug }}>
            {product.name}
          </Link>
        </h3>
        <div className="mt-2 flex min-h-8 items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-base leading-none text-primary sm:text-lg">{money(price)}</p>
            {discounted ? (
              <p className="mt-1 text-[10px] leading-none text-muted-foreground line-through sm:text-xs">
                {money(Number(product.price))}
              </p>
            ) : null}
          </div>
          {discounted ? (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-xs">
              Save {discountPercent}%
            </span>
          ) : null}
        </div>
        <p className="mt-2 line-clamp-1 min-h-4 text-[10px] uppercase tracking-[0.1em] text-muted-foreground sm:text-xs">
          {[product.fabric, product.sizes?.join(" ")].filter(Boolean).join(" · ") || "Explore the collection"}
        </p>
        <button
          type="button"
          disabled={outOfStock}
          onClick={() => (needsPick ? setPicking(true) : quickAdd())}
          className="mt-2 min-h-11 w-full rounded-full border border-brand/30 bg-secondary px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary backdrop-blur transition group-hover:bg-primary group-hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 sm:mt-4 sm:py-3 sm:text-[12px] sm:tracking-[0.18em]"
        >
          {outOfStock ? "Sold out" : needsPick ? "Choose options" : "Add to bag"}
        </button>
      </div>
      <QuickPickDialog product={product} open={picking} onOpenChange={setPicking} />
    </article>
  );
}
