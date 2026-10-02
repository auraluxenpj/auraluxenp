import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllProducts, productImage, type Product } from "@/lib/data";
import { useMoney } from "@/lib/store";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  component: ProductsList,
});

function ProductsList() {
  const money = useMoney();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const { data: products = [], isLoading } = useQuery({ queryKey: ["admin", "products"], queryFn: fetchAllProducts });

  const refresh = () => qc.invalidateQueries();

  const togglePublish = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").update({ is_published: !p.is_published }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (p: Product) => {
      await supabase.from("product_variants").delete().eq("product_id", p.id);
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Product deleted"); refresh(); },
    onError: () => toast.error("Couldn't delete — this product has orders. Unpublish it instead."),
  });

  const duplicate = useMutation({
    mutationFn: async (p: Product) => {
      const { id: _id, created_at: _c, updated_at: _u, ...rest } = p;
      const suffix = Math.random().toString(36).slice(2, 6);
      const { error } = await supabase.from("products").insert({
        ...rest,
        name: `${p.name} (copy)`,
        slug: `${p.slug}-${suffix}`,
        sku: p.sku ? `${p.sku}-${suffix}` : null,
        is_published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Draft copy created"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const list = products.filter((p) => `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Products</h1>
        <Link to="/admin/products/$id" params={{ id: "new" }} className="rounded-full bg-primary px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground">
          Add product
        </Link>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or SKU" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm" />
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      <div className="space-y-3">
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-3">
            <img src={productImage(p)} alt={p.name} className="h-16 w-14 rounded-lg object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku ?? "No SKU"} · {money(Number(p.sale_price ?? p.price))} · {p.stock} in stock · {p.is_published ? "Live" : "Hidden"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link to="/admin/products/$id" params={{ id: p.id }} className="rounded-full bg-secondary px-3 py-2">Edit</Link>
              <button onClick={() => togglePublish.mutate(p)} className="rounded-full border border-border px-3 py-2">{p.is_published ? "Unpublish" : "Publish"}</button>
              <button onClick={() => duplicate.mutate(p)} className="rounded-full border border-border px-3 py-2">Duplicate</button>
              <button onClick={() => confirm(`Delete "${p.name}"?`) && remove.mutate(p)} className="rounded-full border border-destructive/40 px-3 py-2 text-destructive">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
