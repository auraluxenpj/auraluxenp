import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PackageSearch, Truck, CheckCircle2, Clock } from "lucide-react";
import { trackOrder, type TrackedOrder } from "@/lib/orders.functions";
import { useMoney } from "@/lib/store";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Your Order — Auraluxe Nepalgunj" },
      {
        name: "description",
        content: "Check your AURALUXE order status with your order number and phone number or email.",
      },
      { property: "og:title", content: "Track Your Order — Auraluxe Nepalgunj" },
      { property: "og:description", content: "Check delivery status with your order number and contact details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

const STEPS = ["pending", "confirmed", "processing", "shipped", "delivered"] as const;
const STEP_LABEL: Record<string, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  processing: "Preparing",
  shipped: "Dispatched",
  delivered: "Delivered",
};

function StatusTimeline({ status }: { status: string }) {
  if (status === "cancelled" || status === "returned") {
    return (
      <p className="mt-6 rounded-2xl border border-border bg-secondary px-4 py-3 text-center text-sm">
        This order is <span className="font-semibold capitalize">{status}</span>. Questions? Message us on
        WhatsApp and we'll help.
      </p>
    );
  }
  const active = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <ol className="mt-6 flex items-start justify-between gap-1">
      {STEPS.map((step, i) => {
        const done = active >= 0 && i <= active;
        return (
          <li key={step} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span
              className={`flex h-8 w-8 items-center justify-center rounded-full border text-[10px] ${
                done
                  ? "border-brand bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
            </span>
            <span className={`text-[10px] uppercase tracking-[0.12em] ${done ? "text-foreground" : "text-muted-foreground"}`}>
              {STEP_LABEL[step]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TrackPage() {
  const money = useMoney();
  const run = useServerFn(trackOrder);
  const [orderNumber, setOrderNumber] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotFound(false);
    setOrder(null);
    setLoading(true);
    try {
      const res = await run({ data: { orderNumber, contact } });
      if (res) setOrder(res);
      else setNotFound(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl">
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-brand">Order tracking</p>
        <h1 className="mt-2 font-display text-3xl sm:text-5xl">Where's my order?</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
          Enter your order number (it looks like AL-261024-ABCDE) and the phone number or email you
          used at checkout.
        </p>
      </header>

      <form onSubmit={submit} className="glass mt-8 grid gap-4 rounded-3xl p-5 sm:p-8">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Order number</span>
          <input
            required
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            placeholder="AL-…"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Phone number or email
          </span>
          <input
            required
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="98… or you@example.com"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[12px] uppercase tracking-[0.2em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          <PackageSearch className="h-4 w-4" />
          {loading ? "Checking…" : "Track order"}
        </button>
      </form>

      {error ? (
        <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notFound ? (
        <p className="mt-6 rounded-2xl border border-border bg-secondary px-4 py-3 text-sm">
          We couldn't find an order with those details. Check the order number and the phone or email
          you used at checkout, or message us on WhatsApp.
        </p>
      ) : null}

      {order ? (
        <section className="glass mt-8 rounded-3xl p-5 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">{order.order_number}</h2>
            <span className="rounded-full bg-secondary px-3 py-1 text-[11px] uppercase tracking-[0.15em]">
              Placed {new Date(order.created_at).toLocaleDateString()}
            </span>
          </div>

          <StatusTimeline status={order.status} />

          <div className="mt-6 grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
            <p className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" />
              Payment: <span className="capitalize">{order.payment_status}</span>
            </p>
            {order.tracking_number ? (
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-brand" />
                Tracking: <span className="font-medium">{order.tracking_number}</span>
              </p>
            ) : null}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Items</p>
            <ul className="mt-2 space-y-1 text-sm">
              {order.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-4">
                  <span>{item.product_name}</span>
                  <span className="text-muted-foreground">× {item.quantity}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex justify-between border-t border-border pt-3 font-display text-lg">
              <span>Total</span>
              <span>{money(order.total)}</span>
            </p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
