import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/orders")({
  component: Orders,
});

type Status = "pending" | "confirmed" | "processing" | "shipped" | "delivered" | "cancelled" | "returned";
type PayStatus = "unpaid" | "paid" | "refunded";

const STATUS_LABEL: Record<Status, string> = {
  pending: "New",
  confirmed: "Confirmed",
  processing: "Packing",
  shipped: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  returned: "Returned",
};

const PAYMENT_LABEL: Record<string, string> = { cod: "Cash on Delivery (old)", qr: "QR payment", bank_transfer: "Bank transfer" };

async function fetchOrders() {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(id, product_name, size, color, quantity, unit_price)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
type Order = Awaited<ReturnType<typeof fetchOrders>>[number];

function Orders() {
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["admin", "orders"], queryFn: fetchOrders });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");

  const shown = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return [o.order_number, o.customer_name, o.customer_phone].some((v) => v?.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Orders</h1>
      <p className="text-sm text-muted-foreground">Open an order to confirm it, mark it dispatched with a tracking number, and mark it delivered.</p>
      <div className="flex flex-wrap gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order no., name or phone" className="min-w-0 flex-1 rounded-full border border-border bg-card px-4 py-2 text-sm" />
        <select value={filter} onChange={(e) => setFilter(e.target.value as Status | "all")} className="rounded-full border border-border bg-card px-4 py-2 text-sm">
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!isLoading && shown.length === 0 ? <p className="text-sm text-muted-foreground">No orders found.</p> : null}
      <ul className="space-y-3">
        {shown.map((o) => <OrderCard key={o.id} o={o} />)}
      </ul>
    </div>
  );
}

function OrderCard({ o }: { o: Order }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tracking, setTracking] = useState(o.tracking_number ?? "");
  const [busy, setBusy] = useState(false);
  const status = o.status as Status;

  async function update(patch: { status?: Status; payment_status?: PayStatus; tracking_number?: string | null }, msg: string) {
    setBusy(true);
    const { error } = await supabase.from("orders").update(patch).eq("id", o.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["admin", "orders"] });
  }

  const btn = "rounded-full px-4 py-2 text-sm disabled:opacity-50";
  const done = status === "delivered" || status === "cancelled" || status === "returned";

  return (
    <li className="rounded-2xl border border-border bg-card">
      <button onClick={() => setOpen(!open)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-4 text-left">
        <span className="font-medium">{o.order_number}</span>
        <span className="text-sm text-muted-foreground">{o.customer_name}</span>
        <span className="text-sm">Rs. {Number(o.total).toLocaleString("en-IN")}</span>
        <span className="ml-auto flex gap-2 text-xs">
          <span className="rounded-full bg-secondary px-3 py-1">{STATUS_LABEL[status]}</span>
          <span className={`rounded-full px-3 py-1 ${o.payment_status === "paid" ? "bg-brand text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {o.payment_status === "paid" ? "Paid" : o.payment_status === "refunded" ? "Refunded" : "Unpaid"}
          </span>
        </span>
      </button>
      {open ? (
        <div className="space-y-4 border-t border-border p-4 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="label-caps text-muted-foreground">Customer</p>
              <p>{o.customer_name}</p>
              <p><a href={`tel:${o.customer_phone}`} className="underline">{o.customer_phone}</a></p>
              {o.customer_email ? <p>{o.customer_email}</p> : null}
              <p className="mt-1">{[o.address, o.city, o.state, o.country].filter(Boolean).join(", ")}</p>
              {o.delivery_notes ? <p className="mt-1 text-muted-foreground">Note: {o.delivery_notes}</p> : null}
            </div>
            <div>
              <p className="label-caps text-muted-foreground">Items</p>
              <ul>
                {o.order_items.map((i) => (
                  <li key={i.id}>{i.quantity} × {i.product_name}{i.size ? ` · ${i.size}` : ""}{i.color ? ` · ${i.color}` : ""} — Rs. {Number(i.unit_price).toLocaleString("en-IN")}</li>
                ))}
              </ul>
              <p className="mt-1 text-muted-foreground">Payment: {PAYMENT_LABEL[o.payment_method] ?? o.payment_method}{o.coupon_code ? ` · Coupon ${o.coupon_code}` : ""}</p>
              <p className="text-muted-foreground">Placed {new Date(o.created_at).toLocaleString()}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="label-caps text-muted-foreground">Delivery</p>
            <div className="flex flex-wrap gap-2">
              {status === "pending" ? (
                <button disabled={busy} onClick={() => update({ status: "confirmed" }, "Order confirmed")} className={`${btn} bg-primary text-primary-foreground`}>Confirm order</button>
              ) : null}
              {(status === "pending" || status === "confirmed" || status === "processing") ? (
                <>
                  <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Tracking no. / courier (optional)" className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2" />
                  <button disabled={busy} onClick={() => update({ status: "shipped", tracking_number: tracking.trim() || null }, "Marked as dispatched")} className={`${btn} bg-primary text-primary-foreground`}>Mark dispatched</button>
                </>
              ) : null}
              {status === "shipped" ? (
                <button disabled={busy} onClick={() => update({ status: "delivered" }, "Marked as delivered")} className={`${btn} bg-primary text-primary-foreground`}>Mark delivered</button>
              ) : null}
              {status === "delivered" ? (
                <button disabled={busy} onClick={() => confirm("Mark this order as returned?") && update({ status: "returned" }, "Marked as returned")} className={`${btn} border border-border`}>Mark returned</button>
              ) : null}
              {!done ? (
                <button disabled={busy} onClick={() => confirm("Cancel this order?") && update({ status: "cancelled" }, "Order cancelled")} className={`${btn} border border-border text-destructive`}>Cancel order</button>
              ) : null}
            </div>
            {o.tracking_number ? <p className="text-muted-foreground">Tracking: {o.tracking_number}</p> : null}
          </div>

          <div className="space-y-2">
            <p className="label-caps text-muted-foreground">Payment</p>
            <p className="text-xs text-muted-foreground">Only mark paid after you've checked the money has arrived in your account — a screenshot is not proof.</p>
            <div className="flex flex-wrap gap-2">
              {o.payment_status !== "paid" ? (
                <button disabled={busy} onClick={() => confirm("Confirm you have received this payment in your account?") && update({ payment_status: "paid" }, "Marked as paid")} className={`${btn} border border-border`}>Mark paid</button>
              ) : (
                <button disabled={busy} onClick={() => confirm("Mark this payment as refunded?") && update({ payment_status: "refunded" }, "Marked as refunded")} className={`${btn} border border-border`}>Mark refunded</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </li>
  );
}
