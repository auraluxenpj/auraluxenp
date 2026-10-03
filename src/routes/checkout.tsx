import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { supabase } from "@/integrations/supabase/client";
import { useCart, useMoney, useSettings } from "@/lib/store";
import type { Coupon } from "@/lib/data";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Auraluxe" },
      { name: "description", content: "Complete your Auraluxe order with Cash on Delivery or bank transfer." },
      { property: "og:title", content: "Checkout — Auraluxe" },
      { property: "og:description", content: "Complete your Auraluxe order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

const PAYMENT_LABELS: Record<string, string> = {
  cod: "Cash on Delivery",
  bank_transfer: "Bank transfer",
  esewa: "eSewa",
  khalti: "Khalti",
};

const schema = z.object({
  customer_name: z.string().trim().min(2, "Please enter your name").max(100),
  customer_phone: z.string().trim().regex(/^[0-9+\-\s]{7,20}$/, "Please enter a valid phone number"),
  customer_email: z.union([z.literal(""), z.string().trim().email("Please enter a valid email").max(255)]),
  address: z.string().trim().min(4, "Please enter your address").max(300),
  city: z.string().trim().min(2, "Please enter your city").max(100),
  state: z.string().trim().max(100),
  country: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().max(20),
  delivery_notes: z.string().trim().max(500),
});

type Form = z.infer<typeof schema>;

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const money = useMoney();
  const s = useSettings();
  const methods = (s["payment_methods"] || "cod").split(",").map((m) => m.trim()).filter(Boolean);
  const [payment, setPayment] = useState(methods[0] ?? "cod");
  const [form, setForm] = useState<Form>({
    customer_name: "", customer_phone: "", customer_email: "", address: "", city: "Nepalgunj",
    state: "", country: "Nepal", postal_code: "", delivery_notes: "",
  });
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  const discount = coupon
    ? Math.min(subtotal, coupon.type === "fixed" ? Number(coupon.value) : (subtotal * Number(coupon.value)) / 100)
    : 0;
  const shippingCharge = Number(s["shipping_charge"] ?? 0);
  const threshold = Number(s["free_shipping_threshold"] ?? 0);
  const shipping = threshold > 0 && subtotal >= threshold ? 0 : shippingCharge;
  const taxPct = Number(s["tax_percent"] ?? 0);
  const tax = ((subtotal - discount) * taxPct) / 100;
  const total = Math.max(0, subtotal - discount + shipping + tax);

  async function applyCoupon() {
    const c = code.trim().toUpperCase();
    if (!c) return;
    const { data } = await supabase.from("coupons").select("*").ilike("code", c).eq("is_active", true).maybeSingle();
    const now = Date.now();
    if (!data) { toast.error("That code isn't valid"); return; }
    if ((data.starts_at && new Date(data.starts_at).getTime() > now) || (data.ends_at && new Date(data.ends_at).getTime() < now)) {
      toast.error("That code has expired"); return;
    }
    if (data.usage_limit != null && data.used_count >= data.usage_limit) { toast.error("That code has been fully used"); return; }
    if (subtotal < Number(data.min_order)) { toast.error(`Spend ${money(Number(data.min_order))} or more to use this code`); return; }
    setCoupon(data);
    toast.success(`${data.code} applied`);
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form"); return; }
    setBusy(true);
    const { data: auth } = await supabase.auth.getUser();
    const id = crypto.randomUUID();
    const d = new Date();
    const orderNumber = `AL-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const v = parsed.data;
    const { error } = await supabase.from("orders").insert({
      id,
      order_number: orderNumber,
      user_id: auth.user?.id ?? null,
      customer_name: v.customer_name,
      customer_phone: v.customer_phone,
      customer_email: v.customer_email || null,
      address: v.address,
      city: v.city,
      state: v.state || null,
      country: v.country,
      postal_code: v.postal_code || null,
      delivery_notes: v.delivery_notes || null,
      payment_method: payment,
      subtotal,
      discount,
      shipping,
      total,
      coupon_code: coupon?.code ?? null,
    });
    if (error) { setBusy(false); toast.error("We couldn't place your order. Please try again."); return; }
    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: id, product_id: i.productId, product_name: i.name, image_url: i.image,
        size: i.size, color: i.color, unit_price: i.price, quantity: i.quantity,
      })),
    );
    setBusy(false);
    if (itemsError) { toast.error("Your order was received but some items failed to save. We'll contact you."); }
    clear();
    setPlaced(orderNumber);
    window.scrollTo({ top: 0 });
  }

  const field = "w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm";
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  if (placed) {
    return (
      <SiteLayout>
        <div className="glass-strong mx-auto mt-10 max-w-lg rounded-3xl p-8 text-center">
          <p className="eyebrow">Thank you</p>
          <h1 className="mt-2 font-display text-4xl">Order placed</h1>
          <p className="mt-3 text-sm text-muted-foreground">Your order number is</p>
          <p className="mt-1 font-display text-2xl text-primary">{placed}</p>
          <p className="mt-4 text-sm text-muted-foreground">We'll call you shortly to confirm delivery.</p>
          <Link to="/shop" className="mt-6 inline-block rounded-full bg-primary px-7 py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground">
            Continue shopping
          </Link>
        </div>
      </SiteLayout>
    );
  }

  if (items.length === 0) {
    return (
      <SiteLayout>
        <div className="glass mt-10 rounded-3xl p-8">
          <h1 className="font-display text-4xl">Checkout</h1>
          <p className="mt-3 text-sm text-muted-foreground">Your bag is empty.</p>
          <Link to="/shop" className="mt-5 inline-block rounded-full bg-primary px-7 py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground">
            Start shopping
          </Link>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="mt-10">
        <p className="eyebrow">Almost yours</p>
        <h1 className="mt-2 font-display text-5xl">Checkout</h1>
      </div>
      <form onSubmit={placeOrder} className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="glass space-y-4 rounded-3xl p-6 lg:col-span-7">
          <h2 className="font-display text-2xl">Delivery details</h2>
          <input className={field} placeholder="Full name *" value={form.customer_name} onChange={set("customer_name")} autoComplete="name" />
          <div className="grid gap-4 sm:grid-cols-2">
            <input className={field} placeholder="Phone *" inputMode="tel" value={form.customer_phone} onChange={set("customer_phone")} autoComplete="tel" />
            <input className={field} placeholder="Email (optional)" type="email" value={form.customer_email} onChange={set("customer_email")} autoComplete="email" />
          </div>
          <input className={field} placeholder="Street address *" value={form.address} onChange={set("address")} autoComplete="street-address" />
          <div className="grid gap-4 sm:grid-cols-2">
            <input className={field} placeholder="City *" value={form.city} onChange={set("city")} />
            <input className={field} placeholder="Province / State" value={form.state} onChange={set("state")} />
            <input className={field} placeholder="Country" value={form.country} onChange={set("country")} />
            <input className={field} placeholder="Postal code" value={form.postal_code} onChange={set("postal_code")} />
          </div>
          <textarea rows={3} className={field} placeholder="Delivery instructions (optional)" value={form.delivery_notes} onChange={set("delivery_notes")} />

          <h2 className="pt-2 font-display text-2xl">Payment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {methods.map((m) => (
              <label key={m} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${payment === m ? "border-primary bg-secondary" : "border-border"}`}>
                <input type="radio" name="payment" checked={payment === m} onChange={() => setPayment(m)} className="accent-primary" />
                {PAYMENT_LABELS[m] ?? m}
              </label>
            ))}
          </div>
        </div>

        <aside className="glass-strong h-fit space-y-4 rounded-3xl p-6 lg:col-span-5">
          <h2 className="font-display text-2xl">Your order</h2>
          <ul className="space-y-3">
            {items.map((i) => (
              <li key={`${i.productId}${i.size}${i.color}`} className="flex gap-3 text-sm">
                {i.image ? <img src={i.image} alt={i.name} className="size-14 rounded-xl object-cover" loading="lazy" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{[i.size, i.color, `× ${i.quantity}`].filter(Boolean).join(" · ")}</p>
                </div>
                <span>{money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <input className={field} placeholder="Coupon code" value={code} onChange={(e) => setCode(e.target.value)} disabled={!!coupon} />
            {coupon ? (
              <button type="button" onClick={() => { setCoupon(null); setCode(""); }} className="rounded-full border border-border px-4 text-xs">Remove</button>
            ) : (
              <button type="button" onClick={applyCoupon} className="rounded-full bg-secondary px-5 text-xs uppercase tracking-[0.15em]">Apply</button>
            )}
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            {discount > 0 ? <div className="flex justify-between text-brand"><dt>Discount ({coupon?.code})</dt><dd>− {money(discount)}</dd></div> : null}
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{shipping === 0 ? "Free" : money(shipping)}</dd></div>
            {tax > 0 ? <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{money(tax)}</dd></div> : null}
            <div className="flex justify-between border-t border-border pt-3 font-display text-xl"><dt>Total</dt><dd className="text-primary">{money(total)}</dd></div>
          </dl>
          <button disabled={busy} className="w-full rounded-full bg-primary py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-60">
            {busy ? "Placing order…" : "Place order"}
          </button>
        </aside>
      </form>
    </SiteLayout>
  );
}
