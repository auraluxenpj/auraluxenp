// CSV parsing + row → product mapping for the admin bulk import.
import { normalizeSKU, validateSKU } from "./sku-validator";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQ = false;
  const s = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((v) => v.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");
const ALIASES: Record<string, string> = {
  name: "name",
  productname: "name",
  sku: "sku",
  productsku: "sku",
  skucode: "sku",
  modelcode: "model_code",
  model: "model_code",
  slug: "slug",
  categoryid: "category_id",
  category: "category",
  productcategory: "category",
  price: "price",
  sellingprice: "price",
  saleprice: "sale_price",
  stock: "stock",
  quantity: "stock",
  lowstockthreshold: "low_stock_threshold",
  sizes: "sizes",
  colours: "colors",
  colors: "colors",
  fabric: "fabric",
  description: "description",
  images: "images",
  published: "is_published",
  newarrival: "is_new",
  bestseller: "is_bestseller",
  featured: "is_featured",
};

export type ImportRow = { line: number; data: any; error?: string };

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const bool = (v: string) => /^(yes|y|true|1)$/i.test(v.trim());
const list = (v: string) => v.split(/[|;]/).map((x) => x.trim()).filter(Boolean);

export function mapRows(rows: string[][], categories: { id: string; name: string; slug: string }[]): ImportRow[] {
  if (rows.length < 2) return [];
  const keys = rows[0]!.map((h) => ALIASES[norm(h)]);
  return rows.slice(1).map((r, idx) => {
    const line = idx + 2;
    const data: any = {};
    keys.forEach((k, i) => {
      if (!k) return;
      const v = (r[i] ?? "").trim();
      if (v === "") return;
      if (k === "sku") {
        const result = validateSKU(v);
        if (!result.valid) {
          data._badSku = v;
          return;
        }
        data[k] = result.normalized;
      } else if (["price", "sale_price"].includes(k)) data[k] = Number(v.replace(/[^0-9.]/g, ""));
      else if (["stock", "low_stock_threshold"].includes(k)) data[k] = Math.round(Number(v));
      else if (["sizes", "colors", "images"].includes(k)) data[k] = list(v);
      else if (k.startsWith("is_")) data[k] = bool(v);
      else if (k === "category") {
        const c = categories.find((c) => c.name.toLowerCase() === v.toLowerCase() || c.slug === v.toLowerCase());
        if (c) data.category_id = c.id; else data._badCategory = v;
      } else data[k] = v;
    });
    if (data._badSku) return { line, data, error: "Invalid SKU format. Expected AL-TYPE-001" };
    if (data._badCategory) return { line, data, error: `Unknown category "${data._badCategory}"` };
    for (const k of ["price", "sale_price", "stock", "low_stock_threshold"])
      if (k in data && (!Number.isFinite(data[k] as number) || (data[k] as number) < 0)) return { line, data, error: `Invalid ${k.replace(/_/g, " ")}` };
    if (!data.sku && !data.slug && !data.name) return { line, data, error: "Needs a name, SKU or slug" };
    if (data.name && !data.slug) data.slug = slugify(String(data.name));
    return { line, data };
  });
}

// Decides which existing product a sheet row refers to. SKU first, then slug, then model code.
// A SKU or model code that points at several products is "ambiguous" and the row is skipped, never guessed.
export type MatchResult =
  | { kind: "match"; product: { id: string } & Record<string, any>; by: "sku" | "slug" | "model_code" }
  | { kind: "ambiguous"; by: "sku" | "model_code"; count: number }
  | { kind: "none" };

const key = (v: unknown) => String(v ?? "").trim().toLowerCase();

export function matchProduct(
  products: ({ id: string; sku?: string | null; slug?: string | null; model_code?: string | null } & Record<string, any>)[],
  d: { sku?: string; slug?: string; model_code?: string },
): MatchResult {
  if (d.sku) {
    const normalized = normalizeSKU(d.sku);
    const hits = products.filter((p) => key(p.sku) === key(normalized));
    if (hits.length === 1) return { kind: "match", product: hits[0]!, by: "sku" };
    if (hits.length > 1) return { kind: "ambiguous", by: "sku", count: hits.length };
  }
  if (d.slug) {
    const hits = products.filter((p) => key(p.slug) === key(d.slug));
    if (hits.length === 1) return { kind: "match", product: hits[0]!, by: "slug" };
  }
  if (d.model_code) {
    const hits = products.filter((p) => p.model_code && key(p.model_code) === key(d.model_code));
    if (hits.length === 1) return { kind: "match", product: hits[0]!, by: "model_code" };
    if (hits.length > 1) return { kind: "ambiguous", by: "model_code", count: hits.length };
  }
  return { kind: "none" };
}

export { normalizeSKU, validateSKU };
