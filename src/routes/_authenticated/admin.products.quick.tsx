import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories, slugify } from "@/lib/data";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Button } from "@/components/ui/button";
import { generateProductDraft } from "@/lib/smart-upload.functions";
import { buildProductSku, GARMENT_LABELS, GARMENT_TYPES, PHOTO_DISCLAIMER } from "@/lib/product-information";

export const Route = createFileRoute("/_authenticated/admin/products/quick")({
  head: () => ({ meta: [
    { title: "Smart add product — Auraluxe Admin" },
    { name: "description", content: "Add an Auraluxe product fast with AI-drafted details." },
    { property: "og:title", content: "Smart add product — Auraluxe Admin" },
    { property: "og:description", content: "Add an Auraluxe product fast with AI-drafted details." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: QuickAdd,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is required").max(150),
  slug: z.string().trim().min(2).max(160).regex(/^[a-z0-9-]+$/, "Link may only use a-z, 0-9 and dashes"),
  price: z.number().min(0),
  sale_price: z.number().min(0).nullable(),
  stock: z.number().int().min(0),
});

const list = (s: string) => s.split(/[,\n]/).map((x) => x.trim()).filter(Boolean);

function QuickAdd() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [draftReady, setDraftReady] = useState(false);

  const [description, setDescription] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [fabric, setFabric] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sizes, setSizes] = useState("S, M, L, XL");
  const [colors, setColors] = useState("");
  const [skuKind, setSkuKind] = useState("K");
  const [skuSuffix, setSkuSuffix] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [stock, setStock] = useState("0");
  const [isPublished, setIsPublished] = useState(true);
  const [isNew, setIsNew] = useState(true);
  const [saving, setSaving] = useState(false);

  async function generate() {
    if (name.trim().length < 2) { toast.error("Enter the product name first"); return; }
    setGenerating(true);
    try {
      const d = await generateProductDraft({ data: { name: name.trim(), notes: notes.trim() || undefined, photoCount: images.length } });
      setDescription(d.description);
      setMetaTitle(d.meta_title);
      setMetaDescription(d.meta_description);
      setFabric(d.fabric);
      setCategoryId(d.category_id ?? "");
      if (d.sizes.length) setSizes(d.sizes.join(", "));
      if (d.colors.length) setColors(d.colors.join(", "));
      setSkuKind(d.sku_kind);
      setDraftReady(true);
      toast.success("Draft ready — review it below before saving");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't generate the draft");
    } finally {
      setGenerating(false);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let sku: string;
    try { sku = buildProductSku(skuKind, skuSuffix); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Check the SKU"); return; }
    const parsed = schema.safeParse({
      name, slug: slugify(name), price: Number(price),
      sale_price: salePrice === "" ? null : Number(salePrice), stock: Number(stock),
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Check the form"); return; }
    setSaving(true);
    const { error } = await supabase.from("products").insert({
      ...parsed.data,
      sku, description: description.trim() || null, fabric: fabric.trim() || null,
      category_id: categoryId || null, sizes: list(sizes), colors: list(colors), images,
      is_new: isNew, is_bestseller: false, is_featured: false, is_published: isPublished,
      meta_title: metaTitle.trim() || null, meta_description: metaDescription.trim() || null,
    });
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "That link or SKU is already used" : error.message); return; }
    toast.success("Product created — it's on the shop now");
    qc.invalidateQueries();
    navigate({ to: "/admin/products" });
  }

  const input = "w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm";
  const label = "space-y-1.5 text-xs uppercase tracking-[0.15em] text-muted-foreground";

  return (
    <form onSubmit={save} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Smart add product</h1>
        <div className="flex gap-2">
          <Link to="/admin/products" className="rounded-full border border-border px-4 py-2.5 text-sm">Back to products</Link>
          <Button type="submit" disabled={saving} className="rounded-full px-6">{saving ? "Saving…" : "Save product"}</Button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">1. Name and photos</h2>
        <label className={label + " block"}>Product name
          <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meera Cotton Kurti" />
        </label>
        <label className={label + " block"}>Notes for the AI (optional)
          <textarea rows={2} className={input} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. festive maroon kurti with mirror work, knee length" />
        </label>
        <div className={label}>Photos
          <div className="mt-1">
            <ImageUploader onUploaded={(url) => setImages((p) => [...p, url])} />
          </div>
        </div>
        {images.length ? (
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={src} className="relative">
                <img src={src} alt="" className="h-24 w-20 rounded-lg object-cover" />
                {i === 0 ? <span className="absolute left-1 top-1 rounded bg-background/90 px-1 text-[10px]">Main</span> : null}
                <button type="button" aria-label="Remove" className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs text-destructive"
                  onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>✕</button>
              </div>
            ))}
          </div>
        ) : null}
        <Button type="button" onClick={generate} disabled={generating} className="rounded-full px-6">
          {generating ? "Writing details…" : draftReady ? "Regenerate details with AI" : "Generate details with AI"}
        </Button>
      </div>

      {draftReady ? (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">2. Review the AI draft</h2>
          <p className="text-xs text-muted-foreground">Everything below is editable — nothing is saved until you press Save product.</p>
          <label className={label + " block"}>Description
            <textarea rows={4} className={input} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <p className="text-xs leading-relaxed text-muted-foreground">{PHOTO_DISCLAIMER}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Fabric<input className={input} value={fabric} onChange={(e) => setFabric(e.target.value)} /></label>
            <label className={label}>Category
              <select className={input} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className={label}>Sizes (comma separated)<input className={input} value={sizes} onChange={(e) => setSizes(e.target.value)} /></label>
            <label className={label}>Colours (comma separated)<input className={input} value={colors} onChange={(e) => setColors(e.target.value)} /></label>
            <label className={label}>Search title<input className={input} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} /></label>
            <label className={label}>Search description<input className={input} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} /></label>
          </div>
        </div>
      ) : null}

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">{draftReady ? "3" : "2"}. Price, stock and SKU</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className={label}>Price<input type="number" min={0} step="0.01" className={input} value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <label className={label}>Sale price (optional)<input type="number" min={0} step="0.01" className={input} value={salePrice} onChange={(e) => setSalePrice(e.target.value)} /></label>
          <label className={label}>Stock<input type="number" min={0} className={input} value={stock} onChange={(e) => setStock(e.target.value)} /></label>
        </div>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <label className={label}>Kind of dress
            <select className={input} value={skuKind} onChange={(e) => setSkuKind(e.target.value)}>
              {GARMENT_TYPES.map((kind) => <option key={kind} value={kind}>{GARMENT_LABELS[kind] ?? kind}</option>)}
            </select>
          </label>
          <label className={label}>Final SKU identifier
            <input required pattern="[A-Za-z0-9]+(-[A-Za-z0-9]+)*" className={input} value={skuSuffix} onChange={(e) => setSkuSuffix(e.target.value)} placeholder="e.g. 001" />
          </label>
        </fieldset>
        <p className="break-words text-sm font-medium">AL-{skuKind}-{skuSuffix.trim().toUpperCase() || "…"}</p>
        <div className="flex flex-wrap gap-6 text-sm">
          <label className="flex items-center gap-3"><input type="checkbox" checked={isPublished} onChange={(e) => setIsPublished(e.target.checked)} className="size-4 accent-primary" />Visible on shop</label>
          <label className="flex items-center gap-3"><input type="checkbox" checked={isNew} onChange={(e) => setIsNew(e.target.checked)} className="size-4 accent-primary" />New arrival</label>
        </div>
        <p className="text-xs text-muted-foreground">Need per-size stock, a size chart or more flags? Save here, then open the product in the full editor.</p>
      </div>
    </form>
  );
}
