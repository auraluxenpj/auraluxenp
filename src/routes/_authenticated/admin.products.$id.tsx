import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, slugify } from "@/lib/data";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { WomensSizeGuide } from "@/components/site/WomensSizeGuide";
import { buildProductSku, GARMENT_LABELS, GARMENT_TYPES, PHOTO_DISCLAIMER, skuTypeForProduct, splitProductSku } from "@/lib/product-information";

export const Route = createFileRoute("/_authenticated/admin/products/$id")({
  head: ({ params }) => ({ meta: [
    { title: `${params.id === "new" ? "Add" : "Edit"} product — Auraluxe Admin` },
    { name: "description", content: "Manage Auraluxe product details, garment SKUs, photos and stock." },
    { property: "og:title", content: "Product editor — Auraluxe Admin" },
    { property: "og:description", content: "Manage Auraluxe product details and inventory." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProductEditor,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/, "Link may only use a-z, 0-9 and dashes"),
  price: z.number().min(0),
  sale_price: z.number().min(0).nullable(),
  stock: z.number().int().min(0),
});

type Form = {
  name: string; slug: string; sku: string; description: string; fabric: string; category_id: string;
  price: string; sale_price: string; stock: string; low_stock_threshold: string;
  sizes: string; colors: string; images: string; size_chart: string;
  is_new: boolean; is_bestseller: boolean; is_featured: boolean; is_published: boolean;
  meta_title: string; meta_description: string;
};

const EMPTY: Form = {
  name: "", slug: "", sku: "", description: "", fabric: "", category_id: "",
  price: "", sale_price: "", stock: "0", low_stock_threshold: "5",
  sizes: "S, M, L, XL", colors: "", images: "", size_chart: "",
  is_new: true, is_bestseller: false, is_featured: false, is_published: true,
  meta_title: "", meta_description: "",
};

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

function ProductEditor() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [f, setF] = useState<Form>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [skuKind, setSkuKind] = useState("KURTI");
  const [skuSuffix, setSkuSuffix] = useState("");
  const [skuKindTouched, setSkuKindTouched] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: product } = useQuery({
    queryKey: ["admin", "product", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [trackBySize, setTrackBySize] = useState(false);
  const [sizeStock, setSizeStock] = useState<Record<string, string>>({});
  const { data: variants = [] } = useQuery({
    queryKey: ["admin", "product-variants", id],
    enabled: !isNew,
    queryFn: async () => {
      const { data, error } = await supabase.from("product_variants").select("*").eq("product_id", id);
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (isNew || !product) return;
    const rows = variants.filter((v) => v.size);
    setTrackBySize(rows.length > 0);
    const map: Record<string, string> = {};
    for (const s of product.sizes) {
      const row = rows.find((v) => v.size?.trim().toLowerCase() === s.trim().toLowerCase());
      map[s] = String(row ? row.stock : 0);
    }
    setSizeStock(map);
  }, [isNew, product, variants]);

  useEffect(() => {
    if (!product) return;
    const parts = splitProductSku(product.sku, product.name);
    setSkuKind(parts.kind);
    setSkuSuffix(parts.suffix);
    setSkuKindTouched(true);
    setF({
      name: product.name, slug: product.slug, sku: product.sku ?? "", description: product.description ?? "",
      fabric: product.fabric ?? "", category_id: product.category_id ?? "",
      price: String(product.price), sale_price: product.sale_price != null ? String(product.sale_price) : "",
      stock: String(product.stock), low_stock_threshold: String(product.low_stock_threshold),
      sizes: product.sizes.join(", "), colors: product.colors.join(", "), images: product.images.join("\n"),
      size_chart: product.size_chart ?? "", is_new: product.is_new, is_bestseller: product.is_bestseller,
      is_featured: product.is_featured, is_published: product.is_published,
      meta_title: product.meta_title ?? "", meta_description: product.meta_description ?? "",
    });
  }, [product]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((prev) => ({ ...prev, [k]: v }));

  useEffect(() => {
    if (isNew && !skuKindTouched) {
      setSkuKind(skuTypeForProduct(f.name, categories.find((c) => c.id === f.category_id)?.name));
    }
  }, [isNew, skuKindTouched, f.name, f.category_id, categories]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let sku: string;
    try { sku = buildProductSku(skuKind, skuSuffix); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Check the SKU"); return; }
    const parsed = schema.safeParse({
      name: f.name, slug: f.slug, price: Number(f.price),
      sale_price: f.sale_price === "" ? null : Number(f.sale_price), stock: Number(f.stock),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    const row = {
      ...parsed.data,
      sku, description: f.description.trim() || null, fabric: f.fabric.trim() || null,
      category_id: f.category_id || null, low_stock_threshold: Number(f.low_stock_threshold) || 0,
      sizes: list(f.sizes), colors: list(f.colors), images: list(f.images),
      size_chart: f.size_chart.trim() || null, is_new: f.is_new, is_bestseller: f.is_bestseller,
      is_featured: f.is_featured, is_published: f.is_published,
      meta_title: f.meta_title.trim() || null, meta_description: f.meta_description.trim() || null,
    };
    // With per-size tracking on, the overall stock is always the sum of the sizes.
    if (trackBySize) {
      row.stock = list(f.sizes).reduce(
        (n, s) => n + (Math.max(0, Math.floor(Number(sizeStock[s] ?? "0")) || 0)),
        0,
      );
    }
    setSaving(true);
    const { data: saved, error } = isNew
      ? await supabase.from("products").insert(row).select("id").single()
      : await supabase.from("products").update(row).eq("id", id).select("id").single();
    if (error || !saved) {
      setSaving(false);
      toast.error(error?.code === "23505" ? "That link or SKU is already used" : error?.message ?? "Couldn't save");
      return;
    }
    const productId = isNew ? saved.id : id;
    const { error: clearError } = await supabase
      .from("product_variants")
      .delete()
      .eq("product_id", productId)
      .not("size", "is", null);
    if (clearError) { setSaving(false); toast.error(clearError.message); return; }
    if (trackBySize) {
      const sizes = list(f.sizes);
      if (sizes.length) {
        const { error: variantError } = await supabase.from("product_variants").insert(
          sizes.map((s) => ({
            product_id: productId,
            size: s,
            color: null,
            stock: Math.max(0, Math.floor(Number(sizeStock[s] ?? "0")) || 0),
          })),
        );
        if (variantError) { setSaving(false); toast.error(variantError.message); return; }
      }
    }
    setSaving(false);
    toast.success(isNew ? "Product created — it's on the shop now" : "Product saved");
    qc.invalidateQueries();
    navigate({ to: "/admin/products" });
  }

  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm";
  const label = "space-y-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">{isNew ? "Add product" : "Edit product"}</h1>
        <div className="flex gap-2">
          {!isNew && f.slug ? <Link to="/shop/product/$slug" params={{ slug: f.slug }} target="_blank" className="rounded-full border border-border px-4 py-2.5 text-sm">View on shop</Link> : null}
          <Button type="submit" disabled={saving} className="rounded-full px-6">{saving ? "Saving…" : "Save"}</Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5 lg:col-span-2">
          <label className={label + " block"}>Name
            <input className={input} value={f.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} />
          </label>
          <label className={label + " block"}>Page link (/shop/product/…)
            <input className={input} value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
          </label>
          <label className={label + " block"}>Description
            <textarea rows={5} className={input} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">{PHOTO_DISCLAIMER}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Fabric<input className={input} value={f.fabric} onChange={(e) => set("fabric", e.target.value)} /></label>
            <label className={label}>Category
              <select className={input} value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>Sizes (comma separated)<input className={input} value={f.sizes} onChange={(e) => set("sizes", e.target.value)} /></label>
            <label className={label}>Colours (comma separated)<input className={input} value={f.colors} onChange={(e) => set("colors", e.target.value)} /></label>
          </div>
          <div className={label + " block"}>Photos
            <div className="mt-1">
              <ImageUploader onUploaded={(url) => setF((p) => ({ ...p, images: [...list(p.images), url].join("\n") }))} />
            </div>
          </div>
          {list(f.images).length ? (
            <div className="flex flex-wrap gap-2">
              {list(f.images).map((src, i, arr) => (
                <div key={src} className="relative">
                  <img src={src} alt="" className="h-24 w-20 rounded-lg object-cover" />
                  {i === 0 ? <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px]">Main</span> : null}
                  <div className="absolute inset-x-0 bottom-0 flex justify-between p-0.5">
                    <button type="button" aria-label="Move left" disabled={i === 0} className="rounded bg-background/90 px-1 text-xs disabled:opacity-30"
                      onClick={() => { set("images", move(arr, i, i - 1)); }}>‹</button>
                    <button type="button" aria-label="Remove" className="rounded bg-background/90 px-1 text-xs text-destructive"
                      onClick={() => set("images", arr.filter((_, j) => j !== i).join("\n"))}>✕</button>
                    <button type="button" aria-label="Move right" disabled={i === arr.length - 1} className="rounded bg-background/90 px-1 text-xs disabled:opacity-30"
                      onClick={() => { set("images", move(arr, i, i + 1)); }}>›</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Or paste photo links</summary>
            <textarea rows={3} className={input} value={f.images} onChange={(e) => set("images", e.target.value)} placeholder="https://…/photo.jpg" />
          </details>
          <label className={label + " block"}>Size chart<textarea rows={3} className={input} value={f.size_chart} onChange={(e) => set("size_chart", e.target.value)} /></label>
          <WomensSizeGuide customChart={f.size_chart} />
        </div>

        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <label className={label + " block"}>Price<input type="number" min={0} step="0.01" className={input} value={f.price} onChange={(e) => set("price", e.target.value)} /></label>
            <label className={label + " block"}>Sale price (optional)<input type="number" min={0} step="0.01" className={input} value={f.sale_price} onChange={(e) => set("sale_price", e.target.value)} /></label>
            <fieldset className="space-y-2">
              <legend className={label}>SKU</legend>
              <label className="block text-xs text-muted-foreground">Kind of dress
                <select className={input} value={skuKind} onChange={(e) => { setSkuKind(e.target.value); setSkuKindTouched(true); }}>
                  {GARMENT_TYPES.map((kind) => <option key={kind} value={kind}>{GARMENT_LABELS[kind] ?? kind}</option>)}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">Final SKU identifier
                <input required pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" className={input} value={skuSuffix} onChange={(e) => setSkuSuffix(e.target.value)} placeholder="e.g. 001" />
              </label>
              <p className="break-words text-sm font-medium">AL-{skuKind}-{skuSuffix.trim().toUpperCase() || "…"}</p>
            </fieldset>
            <label className={label + " block"}>Stock{trackBySize ? (
              <input type="number" min={0} className={input} disabled value={list(f.sizes).reduce((n, s) => n + (Math.max(0, Math.floor(Number(sizeStock[s] ?? "0")) || 0)), 0)} />
            ) : (
              <input type="number" min={0} className={input} value={f.stock} onChange={(e) => set("stock", e.target.value)} />
            )}</label>
            <label className={label + " block"}>Low-stock warning at<input type="number" min={0} className={input} value={f.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} /></label>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={trackBySize}
                  onChange={(e) => setTrackBySize(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Track stock for each size
              </label>
              {trackBySize ? (
                <div className="space-y-2">
                  {list(f.sizes).length === 0 ? (
                    <p className="text-xs text-muted-foreground">Add sizes above first.</p>
                  ) : (
                    list(f.sizes).map((s) => (
                      <div key={s} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">{s}</span>
                        <input
                          type="number"
                          min={0}
                          className={input}
                          value={sizeStock[s] ?? "0"}
                          onChange={(e) => setSizeStock((p) => ({ ...p, [s]: e.target.value }))}
                        />
                      </div>
                    ))
                  )}
                  <p className="text-xs text-muted-foreground">
                    0 marks that size sold out on the shop. Colours share each size's stock.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Turn this on to set how many pieces you have in every size. Sizes set to 0 show as sold
                  out and can't be ordered.
                </p>
              )}
            </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
            {([["is_published", "Visible on shop"], ["is_new", "New arrival"], ["is_bestseller", "Best seller"], ["is_featured", "Featured / trending"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-3"><input type="checkbox" checked={f[k]} onChange={(e) => set(k, e.target.checked)} className="size-4 accent-primary" />{l}</label>
            ))}
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
            <label className={label + " block"}>Search title<input className={input} value={f.meta_title} onChange={(e) => set("meta_title", e.target.value)} /></label>
            <label className={label + " block"}>Search description<textarea rows={3} className={input} value={f.meta_description} onChange={(e) => set("meta_description", e.target.value)} /></label>
          </div>
        </div>
      </div>
    </form>
  );
}

function move(arr: string[], from: number, to: number) {
  const a = [...arr];
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x as string);
  return a.join("\n");
}
