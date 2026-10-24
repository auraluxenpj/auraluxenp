import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { effectivePrice, productImage, type Product } from "@/lib/data";
import { useCart, useMoney } from "@/lib/store";
import { stylistCartItem } from "@/lib/stylist-cart";

export function StylistPickCard({
  product,
  reason,
  onSelectionChange,
}: {
  product: Product;
  reason: string;
  onSelectionChange?: (productId: string, sel: { size: string | null; color: string | null }) => void;
}) {
  const money = useMoney();
  const { add } = useCart();
  const price = effectivePrice(product);
  const hasDiscount = product.sale_price != null && Number(product.sale_price) > 0;
  const outOfStock = product.stock <= 0;
  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
  const [color, setColor] = useState<string | null>(colors[0] ?? null);

  const chooseSize = (value: string) => {
    setSize(value);
    onSelectionChange?.(product.id, { size: value, color });
  };
  const chooseColor = (value: string) => {
    setColor(value);
    onSelectionChange?.(product.id, { size, color: value });
  };

  const addPick = () => {
    const item = stylistCartItem(product, { size, color });
    if (!item) {
      toast.error(`${product.name} is sold out`);
      return;
    }
    add(item);
    toast.success(`${product.name} added to your bag`);
  };

  const pill = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition sm:px-3 sm:text-[11px] ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-background text-muted-foreground hover:border-brand/60"
    }`;

  return (
    <article className="group glass flex h-full flex-col rounded-2xl p-2 transition hover:-translate-y-1 sm:rounded-3xl sm:p-3">
      <Link to="/shop/product/$slug" params={{ slug: product.slug }} className="relative block">
        <img
          src={productImage(product)}
          alt={product.name}
          loading="lazy"
          width={1024}
          height={1280}
          className="aspect-[4/5] w-full rounded-xl bg-muted object-cover sm:rounded-2xl"
        />
        {hasDiscount ? (
          <span className="absolute left-2 top-2 rounded-full bg-accent/90 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-accent-foreground backdrop-blur sm:left-3 sm:top-3 sm:px-3 sm:py-1 sm:text-[10px]">
            -{Math.round((1 - Number(product.sale_price) / Number(product.price)) * 100)}%
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col px-1 pb-1 pt-2 sm:px-2 sm:pb-2 sm:pt-3">
        <h3 className="line-clamp-2 font-display text-sm leading-tight sm:text-lg">
          <Link to="/shop/product/$slug" params={{ slug: product.slug }}>
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-primary sm:text-base">
          {money(price)}
          {hasDiscount ? (
            <span className="ml-1.5 text-[10px] text-muted-foreground line-through sm:text-xs">
              {money(Number(product.price))}
            </span>
          ) : null}
        </p>
        {reason ? (
          <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {reason}
          </p>
        ) : null}

        {sizes.length > 1 ? (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Size</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={size === s}
                  onClick={() => chooseSize(s)}
                  className={pill(size === s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {colors.length > 1 ? (
          <div className="mt-2">
            <p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Colour</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {colors.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={color === c}
                  onClick={() => chooseColor(c)}
                  className={pill(color === c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-auto flex gap-2 pt-2.5 sm:pt-3">
          <button
            type="button"
            onClick={addPick}
            disabled={outOfStock}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:py-2.5 sm:text-[11px] sm:tracking-[0.18em]"
          >
            <ShoppingBag className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            {outOfStock ? "Sold out" : "Add to bag"}
          </button>
          <Link
            to="/shop/product/$slug"
            params={{ slug: product.slug }}
            className="rounded-full border border-brand/30 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-primary transition hover:bg-secondary sm:py-2.5 sm:text-[11px] sm:tracking-[0.18em]"
          >
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
