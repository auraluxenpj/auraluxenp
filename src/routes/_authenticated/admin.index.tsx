import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMoney } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: Dashboard,
});

function Dashboard() {
  const money = useMoney();
  const { data } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: async () => {
      const [products, orders] = await Promise.all([
        supabase.from("products").select("id, name, stock, low_stock_threshold, is_published"),
        supabase.from("orders").select("id, order_number, customer_name, total, status, created_at").order("created_at", { ascending: false }),
      ]);
      if (products.error) throw products.error;
      if (orders.error) throw orders.error;
      return { products: products.data, orders: orders.data };
    },
  });
  const products = data?.products ?? [];
  const orders = data?.orders ?? [];
  const low = products.filter((p) => p.stock <= p.low_stock_threshold);
  const sales = orders.filter((o) => o.status !== "cancelled" && o.status !== "returned").reduce((s, o) => s + Number(o.total), 0);

  const stats = [
    { label: "Products", value: products.length },
    { label: "Orders", value: orders.length },
    { label: "Sales", value: money(sales) },
    { label: "Low stock", value: low.length },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Dashboard</h1>
        <Link to="/admin/products/$id" params={{ id: "new" }} className="rounded-full bg-primary px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground">
          Add product
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{s.label}</p>
            <p className="mt-2 font-display text-3xl">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Low stock</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {low.length === 0 ? <li className="py-2 text-muted-foreground">All stocked up.</li> : null}
            {low.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <Link to="/admin/products/$id" params={{ id: p.id }} className="hover:text-brand">{p.name}</Link>
                <span className={p.stock === 0 ? "text-destructive" : "text-muted-foreground"}>{p.stock === 0 ? "Out of stock" : `${p.stock} left`}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">Recent orders</h2>
          <ul className="mt-3 divide-y divide-border text-sm">
            {orders.length === 0 ? <li className="py-2 text-muted-foreground">No orders yet.</li> : null}
            {orders.slice(0, 6).map((o) => (
              <li key={o.id} className="flex justify-between gap-2 py-2">
                <span>{o.order_number} · {o.customer_name}</span>
                <span className="text-muted-foreground">{money(Number(o.total))} · {o.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
