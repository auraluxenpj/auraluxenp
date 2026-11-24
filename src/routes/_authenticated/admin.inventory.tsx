import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllProducts, type Product } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/inventory")({
  component: Inventory,
});

function Inventory() {
  const { data: products = [] } = useQuery({ queryKey: ["admin", "products"], queryFn: fetchAllProducts });
  const authorityQuery = useQuery({
    queryKey: ["inventory-authority"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("website_inventory_authority_enabled");
      if (error) throw error;
      return data === true;
    },
  });
  // Fail closed: never offer direct stock edits until the authority check confirms
  // that the website is allowed to own inventory.
  const canEditStock = authorityQuery.data === false;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Inventory</h1>
      <p className="text-sm text-muted-foreground">
        {authorityQuery.isLoading
          ? "Checking the active stock source…"
          : authorityQuery.isError
            ? "Stock editing is temporarily disabled because the stock source could not be verified."
            : canEditStock
              ? "Change a stock number and press Save. The shop updates immediately."
              : "Stock is managed by BizSathi. Make stock changes in BizSathi; this page shows the current website stock only."}
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground">
            <tr><th className="p-3">Product</th><th className="p-3">SKU</th><th className="p-3">Status</th><th className="p-3">Stock</th></tr>
          </thead>
          <tbody className="divide-y divide-border">
            {products.map((p) => <Row key={p.id} p={p} canEditStock={canEditStock} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({ p, canEditStock }: { p: Product; canEditStock: boolean }) {
  const qc = useQueryClient();
  const [stock, setStock] = useState(String(p.stock));
  const [saving, setSaving] = useState(false);
  const status = p.stock === 0 ? "Out of stock" : p.stock <= p.low_stock_threshold ? "Low" : "In stock";

  async function save(value: number) {
    if (!canEditStock) return;
    setSaving(true);
    const { error } = await supabase.from("products").update({ stock: Math.max(0, value) }).eq("id", p.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${p.name} stock updated`);
    qc.invalidateQueries();
  }

  return (
    <tr>
      <td className="p-3">{p.name}</td>
      <td className="p-3 text-muted-foreground">{p.sku ?? "—"}</td>
      <td className={`p-3 ${p.stock === 0 ? "text-destructive" : p.stock <= p.low_stock_threshold ? "text-brand" : "text-muted-foreground"}`}>{status}</td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <button disabled={!canEditStock || saving} onClick={() => save(p.stock - 1)} className="size-8 rounded-full border border-border disabled:opacity-40">−</button>
          <input disabled={!canEditStock} type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 disabled:opacity-50" />
          <button disabled={!canEditStock || saving} onClick={() => save(p.stock + 1)} className="size-8 rounded-full border border-border disabled:opacity-40">+</button>
          <button disabled={!canEditStock || saving || Number(stock) === p.stock} onClick={() => save(Number(stock))} className="rounded-full bg-primary px-3 py-1.5 text-xs text-primary-foreground disabled:opacity-40">Save</button>
        </div>
      </td>
    </tr>
  );
}
