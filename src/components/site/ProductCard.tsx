import { Link } from "@tanstack/react-router";
import { effectivePrice, productImage, type Product } from "@/lib/data";
import { useCart, useMoney } from "@/lib/store";
import { toast } from "sonner";

export function ProductCard({ product }: { product: Product }) {
  const money = useMoney();
  const { add } = useCart();
  const price = effectivePrice(product);
  const hasDiscount = product.sale_price != null && Number(product.sale_price) > 0;
  const outOfStock = product.stock <= 0;

  const badge = product.is_new
    ? "New"
    : product.is_bestseller
      ? "Best Seller"
      : hasDiscount
        ? `-${Math.round((1 - Number(product.sale_price) / Number(product.price)) * 100)}%`
        : null;

  return (
    <article className="group glass rounded-3xl p-3 transition hover:-translate-y-1">
      <Link to="/shop/product/$slug" params={{ slug: product.slug }} className="relative block">
        <img
          src={productImage(product)}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={1280}
          className="aspect-[4/5] w-full rounded-2xl bg-muted object-cover"
        />
        {badge ? (
          <span className="absolute left-3 top-3 rounded-full bg-accent/90 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-accent-foreground backdrop-blur">
            {badge}
          </span>
        ) : null}
        {outOfStock ? (
          <span className="absolute right-3 top-3 rounded-full bg-primary/90 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-primary-foreground">
            Sold out
          </span>
        ) : null}
      </Link>
      <div className="px-2 pb-2 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display text-xl leading-tight">
            <Link to="/shop/product/$slug" params={{ slug: product.slug }}>
              {product.name}
            </Link>
          </h3>
          <div className="text-right">
            <span className="font-display text-lg text-primary">{money(price)}</span>
            {hasDiscount ? (
              <span className="ml-2 text-xs text-muted-foreground line-through">
                {money(Number(product.price))}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-1 text-xs uppercase tracking-[0.15em] text-muted-foreground">
          {[product.fabric, product.sizes?.join(" ")].filter(Boolean).join(" · ")}
        </p>
        <button
          type="button"
          disabled={outOfStock}
          onClick={() => {
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
          }}
          className="mt-4 w-full rounded-full border border-brand/30 bg-secondary py-3 text-[12px] uppercase tracking-[0.18em] text-primary backdrop-blur transition group-hover:bg-primary group-hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          {outOfStock ? "Sold out" : "Add to bag"}
        </button>
      </div>
    </article>
  );
}
