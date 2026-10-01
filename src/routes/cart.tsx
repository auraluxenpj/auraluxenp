import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { itemKey, useCart, useMoney, useSettings } from "@/lib/store";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your Bag — Auraluxe" },
      { name: "description", content: "Review the pieces in your Auraluxe bag before checkout." },
      { property: "og:title", content: "Your Bag — Auraluxe" },
      { property: "og:description", content: "Review your Auraluxe bag before checkout." },
    ],
  }),
  component: CartPage,
});

function CartPage() {
  const { items, setQuantity, remove, subtotal } = useCart();
  const money = useMoney();
  const s = useSettings();

  const shippingCharge = Number(s["shipping_charge"] ?? 0);
  const threshold = Number(s["free_shipping_threshold"] ?? 0);
  const shipping = items.length === 0 || (threshold > 0 && subtotal >= threshold) ? 0 : shippingCharge;
  const total = subtotal + shipping;

  return (
    <SiteLayout>
      <div className="mt-10">
        <p className="eyebrow">Your selection</p>
        <h1 className="mt-2 font-display text-5xl">Shopping Bag</h1>
      </div>

      {items.length === 0 ? (
        <div className="glass mt-6 rounded-3xl p-8">
          <p className="text-sm text-muted-foreground">Your bag is empty.</p>
          <Link
            to="/shop"
            className="mt-5 inline-block rounded-full bg-primary px-7 py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-8">
            {items.map((item) => {
              const key = itemKey(item);
              return (
                <article key={key} className="glass flex gap-4 rounded-3xl p-4">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      width={200}
                      height={250}
                      className="size-24 shrink-0 rounded-2xl object-cover"
                    />
                  ) : null}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-display text-xl leading-tight">{item.name}</h2>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                          {[item.size, item.color].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <span className="font-display text-lg text-primary">
                        {money(item.price * item.quantity)}
                      </span>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="glass flex items-center rounded-full">
                        <button
                          type="button"
                          className="px-3 py-1.5"
                          onClick={() => setQuantity(key, item.quantity - 1)}
                        >
                          −
                        </button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          className="px-3 py-1.5"
                          onClick={() => setQuantity(key, item.quantity + 1)}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(key)}
                        className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <aside className="glass-strong h-fit rounded-3xl p-6 lg:col-span-4">
            <h2 className="font-display text-2xl">Order summary</h2>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{shipping === 0 ? "Free" : money(shipping)}</dd>
              </div>
              {threshold > 0 && subtotal < threshold ? (
                <p className="text-[11px] uppercase tracking-[0.15em] text-brand">
                  {money(threshold - subtotal)} more for free shipping
                </p>
              ) : null}
              <div className="flex justify-between border-t border-border pt-3 font-display text-xl">
                <dt>Total</dt>
                <dd className="text-primary">{money(total)}</dd>
              </div>
            </dl>
            <Link
              to="/checkout"
              className="mt-6 block rounded-full bg-primary py-3.5 text-center text-[12px] uppercase tracking-[0.18em] text-primary-foreground"
            >
              Proceed to checkout
            </Link>
            <p className="mt-3 text-center text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Coupon codes apply at checkout
            </p>
          </aside>
        </div>
      )}
    </SiteLayout>
  );
}
