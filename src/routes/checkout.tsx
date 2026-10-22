import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { getCheckoutPaymentMethods } from "@/lib/payment-settings.functions";
import { placeOrder } from "@/lib/checkout.functions";
import type { CheckoutMethod } from "@/lib/payment-settings";
import { useCart, useMoney, useSettings, whatsappLink } from "@/lib/store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Auraluxe" },
      { name: "description", content: "Complete your Auraluxe order with secure QR payment or bank transfer." },
      { property: "og:title", content: "Checkout — Auraluxe" },
      { property: "og:description", content: "Complete your Auraluxe order." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

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

function PaymentInstructions({ method, orderNumber, total }: { method: CheckoutMethod; orderNumber: string; total: string }) {
  const s = useSettings();
  const wa = whatsappLink(s["whatsapp"] ?? "", `Namaste! I've placed order ${orderNumber} (${total}) and I'm sending my payment screenshot.`);
  return (
    <div className="mt-6 rounded-2xl border border-border bg-background/70 p-5 text-left">
      <h2 className="font-display text-xl">How to pay</h2>
      {method.id === "qr" ? (
        <div className="mt-3 space-y-3 text-sm">
          <p>
            Scan this QR code{method.provider ? ` with ${method.provider}` : ""} and pay <strong>{total}</strong> to{" "}
            <strong>{method.merchantName}</strong>.
          </p>
          {method.qrImageUrl ? (
            <img src={method.qrImageUrl} alt="Payment QR code" className="mx-auto h-48 w-48 rounded-xl border border-border object-contain" />
          ) : null}
          {method.instructions ? <p className="text-muted-foreground">{method.instructions}</p> : null}
        </div>
      ) : (
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Bank</dt><dd>{method.bankName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Account name</dt><dd>{method.accountName}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Account number</dt><dd className="font-mono">{method.accountNumber}</dd></div>
          {method.branch ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Branch</dt><dd>{method.branch}</dd></div> : null}
          {method.accountType ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Account type</dt><dd>{method.accountType}</dd></div> : null}
          <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Amount</dt><dd className="font-medium">{total}</dd></div>
          {method.instructions ? <p className="pt-2 text-muted-foreground">{method.instructions}</p> : null}
        </dl>
      )}
      <p className="mt-4 text-xs text-muted-foreground">
        Your order is reserved but unpaid. After paying, send your payment screenshot on WhatsApp so we can verify and confirm it.
      </p>
      <a href={wa} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-full bg-secondary px-6 py-3 text-[12px] uppercase tracking-[0.15em]">
        Send payment proof on WhatsApp
      </a>
    </div>
  );
}

function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const money = useMoney();
  const s = useSettings();
  const placeOrderFn = useServerFn(placeOrder);
  const { data: methodsData, isLoading: methodsLoading } = useQuery({
    queryKey: ["checkout", "payment-methods"],
    queryFn: () => getCheckoutPaymentMethods(),
    staleTime: 60_000,
    retry: 1,
  });
  const methods = useMemo(() => methodsData?.methods ?? [], [methodsData]);
  const [payment, setPayment] = useState<string | null>(null);
  const selected = methods.find((m) => m.id === payment) ?? methods[0];
  const [form, setForm] = useState<Form>({
    customer_name: "", customer_phone: "", customer_email: "", address: "", city: "Nepalgunj",
    state: "", country: "Nepal", postal_code: "", delivery_notes: "",
  });
  const [code, setCode] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<{ orderNumber: string; total: number; method: CheckoutMethod } | null>(null);
  // One key per checkout attempt set, so a retried submit returns the same
  // order instead of duplicating it.
  const [checkoutKey] = useState(() => crypto.randomUUID());

  // Display estimates only — the server recomputes everything from trusted
  // records and its totals are authoritative.
  const shippingCharge = Number(s["shipping_charge"] ?? 0);
  const threshold = Number(s["free_shipping_threshold"] ?? 0);
  const estShipping = threshold > 0 && subtotal >= threshold ? 0 : shippingCharge;

  async function submitOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Please check the form"); return; }
    setBusy(true);
    try {
      const v = parsed.data;
      const result = await placeOrderFn({
        data: {
          checkoutKey,
          paymentMethod: selected.id,
          coupon,
          customer: {
            customer_name: v.customer_name,
            customer_phone: v.customer_phone,
            customer_email: v.customer_email || null,
            address: v.address,
            city: v.city,
            state: v.state || null,
            country: v.country,
            postal_code: v.postal_code || null,
            delivery_notes: v.delivery_notes || null,
          },
          items: items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, quantity: i.quantity })),
        },
      });
      clear();
      setPlaced({ orderNumber: result.order_number, total: Number(result.total), method: selected });
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "We couldn't place your order. Please try again.");
    } finally {
      setBusy(false);
    }
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
          <p className="mt-1 font-display text-2xl text-primary">{placed.orderNumber}</p>
          <PaymentInstructions method={placed.method} orderNumber={placed.orderNumber} total={money(placed.total)} />
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

  if (!methodsLoading && methods.length === 0) {
    const wa = whatsappLink(s["whatsapp"] ?? "", "Namaste! I'd like to place an order, but online payment seems unavailable.");
    return (
      <SiteLayout>
        <div className="glass mt-10 rounded-3xl p-8 text-center">
          <h1 className="font-display text-4xl">Checkout</h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Online payment isn't available right now. Please message us on WhatsApp and we'll complete your order personally.
          </p>
          <a href={wa} target="_blank" rel="noreferrer" className="mt-6 inline-block rounded-full bg-primary px-7 py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground">
            Message us on WhatsApp
          </a>
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
      <form onSubmit={submitOrder} className="mt-6 grid gap-6 lg:grid-cols-12">
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
              <label key={m.id} className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${selected?.id === m.id ? "border-primary bg-secondary" : "border-border"}`}>
                <input type="radio" name="payment" checked={selected?.id === m.id} onChange={() => setPayment(m.id)} className="accent-primary" />
                {m.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Payment instructions appear after you place the order. Your order stays unpaid until we verify your payment.
          </p>
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
              <button type="button" onClick={() => { const c = code.trim(); if (c) { setCoupon(c); } }} className="rounded-full bg-secondary px-5 text-xs uppercase tracking-[0.15em]">Apply</button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Coupons are checked when the order is placed.</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Shipping (estimated)</dt><dd>{estShipping === 0 ? "Free" : money(estShipping)}</dd></div>
            <div className="flex justify-between border-t border-border pt-3 font-display text-xl"><dt>Estimated total</dt><dd className="text-primary">{money(subtotal + estShipping)}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">The final total is confirmed securely when you place the order.</p>
          <button disabled={busy || !selected} className="w-full rounded-full bg-primary py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-60">
            {busy ? "Placing order…" : "Place order"}
          </button>
        </aside>
      </form>
    </SiteLayout>
  );
}
