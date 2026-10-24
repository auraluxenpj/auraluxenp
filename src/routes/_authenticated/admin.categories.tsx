import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, slugify, type Category } from "@/lib/data";
import { categoryCanDelete, categorySchema, moveCategory } from "@/lib/category-management";

const categoriesQuery = queryOptions({ queryKey: ["categories"], queryFn: fetchCategories });

export const Route = createFileRoute("/_authenticated/admin/categories")({
  head: () => ({ meta: [
    { title: "Categories — Auraluxe Admin" },
    { name: "description", content: "Manage Auraluxe shop categories and collection ordering." },
    { property: "og:title", content: "Categories — Auraluxe Admin" },
    { property: "og:description", content: "Manage Auraluxe shop categories and collection ordering." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
    { name: "robots", content: "noindex" },
  ] }),
  component: Categories,
});

const emptyForm = { name: "", slug: "", description: "", is_active: true };
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Categories() {
  const qc = useQueryClient();
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const { data: usage, error: usageError } = useQuery({
    queryKey: ["admin", "category-usage"],
    queryFn: async () => {
      const [products, coupons] = await Promise.all([
        supabase.from("products").select("category_id"),
        supabase.from("coupons").select("category_id"),
      ]);
      if (products.error) throw products.error;
      if (coupons.error) throw coupons.error;
      return { products: products.data, coupons: coupons.data };
    },
  });
  const [editor, setEditor] = useState<Category | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const ordered = order ? order.flatMap((id) => categories.filter((c) => c.id === id)) : categories;
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["admin", "category-usage"] }),
    ]);
  };
  const counts = (id: string) => ({
    products: usage?.products.filter((p) => p.category_id === id).length ?? 0,
    coupons: usage?.coupons.filter((c) => c.category_id === id).length ?? 0,
  });

  function edit(category: Category | "new") {
    setEditor(category);
    setSlugTouched(category !== "new");
    setForm(category === "new" ? emptyForm : {
      name: category.name, slug: category.slug, description: category.description ?? "", is_active: category.is_active,
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = categorySchema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the category details"); return; }
    const existing = editor && editor !== "new" ? editor : null;
    if (["sale", "new-arrivals"].includes(parsed.data.slug) && existing?.slug !== parsed.data.slug) {
      toast.error("This URL name is reserved for Sale or New Arrivals. Choose another URL name."); return;
    }
    if (categories.some((c) => c.slug === parsed.data.slug && c.id !== existing?.id)) {
      toast.error("That URL name already belongs to another category"); return;
    }
    setBusy(true);
    try {
      const row = { ...parsed.data, description: parsed.data.description || null };
      const result = existing
        ? await supabase.from("categories").update(row).eq("id", existing.id).select("id").single()
        : await supabase.from("categories").insert({ ...row, sort_order: Math.max(-1, ...categories.map((c) => c.sort_order)) + 1 }).select("id").single();
      if (result.error) throw result.error;
      await refresh();
      setEditor(null);
      toast.success(existing ? "Category updated" : "Category created");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't save the category"); }
    finally { setBusy(false); }
  }

  async function saveOrder() {
    if (!order) return;
    setBusy(true);
    try {
      for (const [index, id] of order.entries()) {
        const { error } = await supabase.from("categories").update({ sort_order: index }).eq("id", id).select("id").single();
        if (error) throw error;
      }
      await refresh();
      setOrder(null);
      toast.success("Category order saved");
    } catch { await refresh(); toast.error("Some positions may have saved. Review the order and retry Save order."); }
    finally { setBusy(false); }
  }

  async function removeCategory() {
    if (!deleting) return;
    setBusy(true);
    try {
      const [products, coupons] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("category_id", deleting.id),
        supabase.from("coupons").select("id", { count: "exact", head: true }).eq("category_id", deleting.id),
      ]);
      if (products.error) throw products.error;
      if (coupons.error) throw coupons.error;
      if (!categoryCanDelete(products.count ?? 0, coupons.count ?? 0)) {
        throw new Error("This category has products or coupons. Reassign them first, or hide the category instead.");
      }
      const { error } = await supabase.from("categories").delete().eq("id", deleting.id).select("id").single();
      if (error) throw error;
      await refresh();
      setDeleting(null);
      toast.success("Category deleted");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Couldn't delete the category"); }
    finally { setBusy(false); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="font-display text-3xl">Categories</h1><p className="mt-1 text-sm text-muted-foreground">{categories.length} collections</p></div>
      <Button onClick={() => edit("new")} disabled={busy || !!order}><Plus />Add category</Button>
    </div>
    {order && <div className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
      <p className="text-sm">Unsaved category order</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setOrder(null)}>Discard</Button><Button disabled={busy} onClick={saveOrder}>{busy ? "Saving…" : "Save order"}</Button></div>
    </div>}
    {usageError && <p role="alert" className="text-sm text-destructive">Product and coupon counts could not be loaded. Deletion is unavailable.</p>}
    {categories.length === 0 && <p className="py-10 text-center text-muted-foreground">No categories yet.</p>}
    <div className="divide-y divide-border border-y border-border">
      {ordered.map((category, index) => {
        const count = counts(category.id);
        return <div key={category.id} className="flex flex-wrap items-center gap-4 py-4">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" title={`Move ${category.name} up`} aria-label={`Move ${category.name} up`} disabled={busy || index === 0} onClick={() => setOrder(moveCategory(ordered.map((c) => c.id), category.id, -1))}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" title={`Move ${category.name} down`} aria-label={`Move ${category.name} down`} disabled={busy || index === ordered.length - 1} onClick={() => setOrder(moveCategory(ordered.map((c) => c.id), category.id, 1))}><ArrowDown /></Button>
          </div>
          <div className="min-w-0 flex-1"><h2 className="break-words font-medium">{category.name}</h2><p className="break-all text-xs text-muted-foreground">{category.slug}</p><p className="mt-1 text-xs text-muted-foreground">{usage ? `${count.products} products · ${count.coupons} coupons` : "Loading counts…"} · {category.is_active ? "Visible" : "Hidden"}</p></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={busy || !!order} onClick={() => edit(category)} aria-label={`Edit ${category.name}`}><Pencil />Edit</Button>
            <Button variant="ghost" size="icon" className="text-destructive" disabled={busy || !!order || !usage} title={`Delete ${category.name}`} aria-label={`Delete ${category.name}`} onClick={() => setDeleting(category)}><Trash2 /></Button>
          </div>
        </div>;
      })}
    </div>
    <Dialog open={editor !== null} onOpenChange={(open) => { if (!open && !busy) setEditor(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editor === "new" ? "Add category" : "Edit category"}</DialogTitle><DialogDescription>Category details</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-1 text-sm"><span>Name</span><input required maxLength={100} className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugTouched ? form.slug : slugify(e.target.value) })} /></label>
          <label className="block space-y-1 text-sm"><span>URL name</span><input required maxLength={120} className={inputClass} value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value }); }} /></label>
          <label className="block space-y-1 text-sm"><span>Description</span><textarea maxLength={2000} rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />Visible in shop</label>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>Cancel</Button><Button disabled={busy}>{busy ? "Saving…" : "Save category"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
    <Dialog open={deleting !== null} onOpenChange={(open) => { if (!open && !busy) setDeleting(null); }}>
      <DialogContent><DialogHeader><DialogTitle>Delete {deleting?.name}?</DialogTitle><DialogDescription>{deleting && !categoryCanDelete(counts(deleting.id).products, counts(deleting.id).coupons) ? "This category contains products or coupons. Reassign them first, or edit the category and turn off Visible in shop." : "This removes the category permanently. Existing products and orders will not be deleted."}</DialogDescription></DialogHeader>
        <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={busy || !usage || !deleting || !categoryCanDelete(counts(deleting.id).products, counts(deleting.id).coupons)} onClick={removeCategory}>{busy ? "Deleting…" : "Delete category"}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}