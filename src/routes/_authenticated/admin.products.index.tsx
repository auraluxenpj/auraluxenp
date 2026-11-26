import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { mapRows, matchProduct, parseCsv } from "@/lib/csv-import";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllProducts, fetchCategories, productImage, type Product } from "@/lib/data";
import { useMoney } from "@/lib/store";
import { isProductSku } from "@/lib/product-information";

export const Route = createFileRoute("/_authenticated/admin/products/")({
  head: () => ({ meta: [
    { title: "Products — Auraluxe Admin" },
    { name: "description", content: "Manage Auraluxe products, SKUs and catalogue imports." },
    { property: "og:title", content: "Products — Auraluxe Admin" },
    { property: "og:description", content: "Manage Auraluxe products and catalogue imports." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProductsList,
});

function ProductsList() {
  const money = useMoney();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [publicationFilter, setPublicationFilter] = useState<"published" | "unpublished">("published");
  const { data: products = [], isLoading } = useQuery({ queryKey: ["admin", "products"], queryFn: fetchAllProducts });
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));

  const refresh = () => qc.invalidateQueries();

  const togglePublish = useMutation({
    mutationFn: async (p: Product) => {
      if (!p.is_published && (!p.sku || !isProductSku(p.sku))) throw new Error("Edit this product and fill its AL garment-type SKU before publishing");
      const { error } = await supabase.from("products").update({ is_published: !p.is_published }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (p: Product) => {
      // Delete the parent first. product_variants.product_id has ON DELETE CASCADE,
      // so variants are removed only if the product deletion succeeds. If another
      // relation (for example a coupon) blocks deletion, the product and variants
      // remain intact.
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
        sku: null,
        is_published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Draft copy created — fill its final SKU identifier before publishing"); refresh(); },
    onError: (e) => toast.error((e as Error).message),
  });

  const list = products.filter((p) => {
    const searchText = `${p.name ?? ""} ${p.model_code ?? ""} ${p.sku ?? ""}`.toLowerCase();
    const matchesSearch = searchText.includes(q.trim().toLowerCase());
    const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
    const matchesStock = stockFilter === "all"
      || (stockFilter === "in-stock" && Number(p.stock) > 0)
      || (stockFilter === "out-of-stock" && Number(p.stock) <= 0)
      || (stockFilter === "low-stock" && Number(p.stock) > 0 && Number(p.stock) <= Number(p.low_stock_threshold ?? 0));
    const matchesPublication = publicationFilter === "published" ? p.is_published : !p.is_published;
    return matchesSearch && matchesCategory && matchesStock && matchesPublication;
  });

  // ---------- Bulk selection ----------
  const [selected, setSelected] = useState<string[]>([]);
  const [imageSyncBusy, setImageSyncBusy] = useState(false);
  const [imageSyncReport, setImageSyncReport] = useState<{ synced: number; failed: string[]; skipped: number } | null>(null);

  // Reconcile every currently mapped catalogue image. Safe to rerun: only the
  // BizSathi image_path field is updated by the authenticated receiver.
  const syncAllBizSathiImages = async () => {
    if (imageSyncBusy) return;
    const candidates = products.filter((p) => {
      const mapped = (p as Product & { bizsathi_product_id?: string | null }).bizsathi_product_id;
      return !!mapped && Array.isArray(p.images) && p.images.length > 0;
    });
    if (!candidates.length) {
      toast.info("No mapped Auraluxe products with images were found.");
      return;
    }
    if (!window.confirm(`Sync primary images for ${candidates.length} mapped products to BizSathi? Only product images will change.`)) return;
    setImageSyncBusy(true);
    setImageSyncReport(null);
    let synced = 0;
    const failed: string[] = [];
    const { data: authData } = await supabase.auth.getSession();
    const accessToken = authData.session?.access_token;
    if (!accessToken) {
      setImageSyncBusy(false);
      toast.error("Please sign in again before syncing product images.");
      return;
    }
    for (const p of candidates) {
      const imageUrl = p.images[0] ?? null;
      if (!imageUrl) { continue; }
      let ok = false;
      let lastError = "Sync was not confirmed";
      for (let attempt = 0; attempt < 3 && !ok; attempt++) {
        try {
          const response = await fetch("/api/public/bizsathi-product-image", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ product_id: p.id, image_url: imageUrl }),
          });
          const result = await response.json().catch(() => null) as { ok?: boolean; synced?: boolean; error?: string } | null;
          ok = response.ok && result?.ok === true && result.synced === true;
          if (!ok) lastError = result?.error ?? `HTTP ${response.status}`;
        } catch (error) {
          lastError = error instanceof Error ? error.message : "Network error";
        }
        if (!ok && attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
      }
      if (ok) synced++; else failed.push(`${p.name} (${p.sku ?? p.id}): ${lastError}`);
    }
    const skipped = products.filter((p) => !(p as Product & { bizsathi_product_id?: string | null }).bizsathi_product_id || !p.images?.length).length;
    setImageSyncReport({ synced, failed, skipped });
    setImageSyncBusy(false);
    if (failed.length) toast.warning(`Image sync finished: ${synced} synced, ${failed.length} need attention.`);
    else toast.success(`Image sync complete: ${synced} product images synced.`);
  };

  const [bulkBusy, setBulkBusy] = useState(false);
  const allSelected = list.length > 0 && list.every((p) => selected.includes(p.id));

  const toggleOne = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = () => setSelected(allSelected ? [] : list.map((p) => p.id));

  const bulkDelete = async () => {
    const targets = products.filter((p) => selected.includes(p.id));
    if (targets.length === 0) return;
    if (!confirm(`Delete ${targets.length} product${targets.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setBulkBusy(true);
    let deleted = 0;
    const failed: string[] = [];
    for (const p of targets) {
      // Rely on the database FK cascade only after the parent delete succeeds.
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) failed.push(p.name); else deleted++;
    }
    setBulkBusy(false);
    setSelected([]);
    if (deleted) toast.success(`${deleted} product${deleted > 1 ? "s" : ""} deleted`);
    if (failed.length) {
      toast.error(
        `${failed.length} couldn't be deleted (they likely have orders). Unpublish them instead: ${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}`,
      );
    }
    refresh();
  };

  const bulkPublish = async () => {
    const targets = products.filter((p) => selected.includes(p.id));
    if (targets.length === 0) return;
    const invalid = targets.filter((p) => !p.sku || !isProductSku(p.sku));
    if (invalid.length) {
      toast.error(`Cannot publish: add a valid AL garment-type SKU to ${invalid.length} selected product(s) first.`);
      return;
    }
    setBulkBusy(true);
    const { error } = await supabase.from("products").update({ is_published: true }).in("id", targets.map((p) => p.id));
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${targets.length} product${targets.length > 1 ? "s" : ""} published`);
    setSelected([]);
    refresh();
  };

  const bulkUnpublish = async () => {
    if (selected.length === 0) return;
    setBulkBusy(true);
    const { error } = await supabase.from("products").update({ is_published: false }).in("id", selected);
    setBulkBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${selected.length} product${selected.length > 1 ? "s" : ""} unpublished`);
    setSelected([]);
    refresh();
  };

  const exportCsv = () => {
    const headers = ["Name", "SKU", "Model Code", "Slug", "Category ID", "Price", "Sale Price", "Stock", "Low Stock Threshold", "Sizes", "Colours", "Fabric", "Published", "New Arrival", "Best Seller", "Featured", "Created"];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = products.map((p) => [
      p.name, p.sku, p.model_code, p.slug, p.category_id, p.price, p.sale_price, p.stock, p.low_stock_threshold,
      (p.sizes ?? []).join(" | "), (p.colors ?? []).join(" | "), p.fabric,
      p.is_published ? "Yes" : "No", p.is_new ? "Yes" : "No", p.is_bestseller ? "Yes" : "No", p.is_featured ? "Yes" : "No",
      p.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auraluxe-products-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${products.length} products`);
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const importCsv = async (file: File) => {
    setImporting(true);
    setReport(null);
    try {
      const { data: cats } = await supabase.from("categories").select("id,name,slug");
      const rows = mapRows(parseCsv(await file.text()), cats ?? []);
      if (rows.length === 0) throw new Error("No product rows found in the file");
      // Show what the file would do before anything is written, so a sheet that does not match the live products cannot silently add hundreds of duplicates.
      const plan = { create: 0, update: 0, skip: 0 };
      for (const r of rows) { if (r.error) { plan.skip++; continue; } const f = matchProduct(products, r.data); if (f.kind === "ambiguous") plan.skip++; else if (f.kind === "match") plan.update++; else plan.create++; }
      if (!window.confirm(`This file will add ${plan.create} new products, update ${plan.update} existing products and skip ${plan.skip} rows. Continue?`)) { setReport({ created: 0, updated: 0, errors: ["Import cancelled. Nothing was changed."] }); return; }
      let created = 0, updated = 0;
      const errors: string[] = [];
      for (const r of rows) {
        if (r.error) { errors.push(`Row ${r.line}: ${r.error}`); continue; }
        const d: any = r.data;
        const found = matchProduct(products, d);
        if (found.kind === "ambiguous") {
          errors.push(`Row ${r.line}: skipped, that ${found.by === "sku" ? "SKU" : "model code"} matches ${found.count} products. Add the exact SKU for the one you mean`);
          continue;
        }
        const match = found.kind === "match" ? found.product : undefined;
        if ((!match || (d.sku && d.sku !== match["sku"])) && (!d.sku || !isProductSku(d.sku))) {
          errors.push(`Row ${r.line}: SKU "${d.sku ?? ""}" is not in the AL-TYPE-001 style, e.g. AL-KURTI-001 or AL-K-001`);
          continue;
        }
        if (match) {
          const { slug: _s, ...upd }: any = d;
          const { error } = await supabase.from("products").update(upd).eq("id", match.id);
          if (error) errors.push(`Row ${r.line}: ${error.message}`); else updated++;
        } else {
          if (!d.name || d.price == null) { errors.push(`Row ${r.line}: new products need Name and Price`); continue; }
          const { error } = await supabase.from("products").insert(d as any);
          if (error) errors.push(`Row ${r.line}: ${error.message}`); else created++;
        }
      }
      setReport({ created, updated, errors });
      toast.success(`Import done: ${created} added, ${updated} updated`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Products</h1>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="rounded-full border border-border px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50">
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <button onClick={syncAllBizSathiImages} disabled={imageSyncBusy || isLoading || products.length === 0} className="rounded-full border border-border px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50">
            {imageSyncBusy ? "Syncing images…" : "Sync BizSathi images"}
          </button>
          <button onClick={exportCsv} disabled={products.length === 0} className="rounded-full border border-border px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] disabled:opacity-50">
            Export CSV
          </button>
          <Link to="/admin/products/quick" className="rounded-full border border-border px-5 py-2.5 text-[12px] uppercase tracking-[0.15em]">
            Smart add
          </Link>
          <Link to="/admin/products/$id" params={{ id: "new" }} className="rounded-full bg-primary px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground">
            Add product
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Import tip: export first, edit in Excel, then import. Rows matching an existing SKU (or slug, or Model Code) are updated; others become new products (need Name and Price). Separate sizes/colours/image links with "|". Category can be a name like "Kurtis".
      </p>
      {imageSyncReport ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p className="font-medium">BizSathi image sync: {imageSyncReport.synced} synced · {imageSyncReport.failed.length} failed · {imageSyncReport.skipped} skipped (unmapped or no image)</p>
          {imageSyncReport.failed.length ? <ul className="mt-2 max-h-48 list-disc overflow-auto pl-5 text-xs text-destructive">{imageSyncReport.failed.map((item) => <li key={item}>{item}</li>)}</ul> : null}
        </div>
      ) : null}
      {report ? (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm">
          <p>{report.created} added · {report.updated} updated · {report.errors.length} skipped</p>
          {report.errors.length ? <ul className="mt-2 list-disc pl-5 text-xs text-destructive">{report.errors.map((e) => <li key={e}>{e}</li>)}</ul> : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3" role="tablist" aria-label="Product publication status">
        <button
          type="button"
          role="tab"
          aria-selected={publicationFilter === "published"}
          onClick={() => { setPublicationFilter("published"); setSelected([]); }}
          className={`rounded-full px-5 py-2.5 text-sm ${publicationFilter === "published" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          Published ({products.filter((p) => p.is_published).length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={publicationFilter === "unpublished"}
          onClick={() => { setPublicationFilter("unpublished"); setSelected([]); }}
          className={`rounded-full px-5 py-2.5 text-sm ${publicationFilter === "unpublished" ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}
        >
          Unpublished ({products.filter((p) => !p.is_published).length})
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_minmax(160px,0.6fr)_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by product name, model or SKU" aria-label="Search products" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm" />
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Filter by category" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <option value="all">All categories</option>
          {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Filter by stock status" className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <option value="all">All stock statuses</option>
          <option value="in-stock">In stock</option>
          <option value="low-stock">Low stock</option>
          <option value="out-of-stock">Out of stock</option>
        </select>
        {q || categoryFilter !== "all" || stockFilter !== "all" ? <button type="button" onClick={() => { setQ(""); setCategoryFilter("all"); setStockFilter("all"); }} className="rounded-xl border border-border px-4 py-3 text-sm">Clear filters</button> : null}
      </div>
      <p className="text-xs text-muted-foreground">Showing {list.length} of {products.length} products</p>
      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

      {list.length > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4" />
            Select all ({list.length})
          </label>
          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-sm font-medium">{selected.length} selected</span>
              <button onClick={() => setSelected([])} disabled={bulkBusy} className="rounded-full border border-border px-3 py-2 disabled:opacity-50">Clear</button>
              {publicationFilter === "published" ? (
                <button onClick={bulkUnpublish} disabled={bulkBusy} className="rounded-full border border-border px-3 py-2 disabled:opacity-50">Unpublish selected</button>
              ) : (
                <button onClick={bulkPublish} disabled={bulkBusy} className="rounded-full border border-border px-3 py-2 disabled:opacity-50">Publish selected</button>
              )}
              <button onClick={bulkDelete} disabled={bulkBusy} className="rounded-full bg-destructive px-3 py-2 text-destructive-foreground disabled:opacity-50">
                {bulkBusy ? "Working…" : "Delete selected"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {list.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-3">
            <input
              type="checkbox"
              checked={selected.includes(p.id)}
              onChange={() => toggleOne(p.id)}
              aria-label={`Select ${p.name}`}
              className="h-4 w-4 shrink-0"
            />
            <img src={productImage(p)} alt={p.name} className="h-16 w-14 rounded-lg object-cover" loading="lazy" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku ?? "No SKU"} · {categoryNames.get(p.category_id ?? "") ?? "Uncategorised"} · {money(Number(p.sale_price ?? p.price))} · {p.stock} in stock · {p.is_published ? "Live" : "Hidden"}
              </p>
              {!p.sku || !isProductSku(p.sku) ? <p className="text-xs text-muted-foreground">SKU format needs admin review</p> : null}
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
