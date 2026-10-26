import { GARMENT_TYPES } from "./product-information";

export type SmartDraft = {
  description: string;
  meta_title: string;
  meta_description: string;
  fabric: string;
  category_id: string | null;
  sizes: string[];
  colors: string[];
  sku_kind: string;
};

export type RawSmartDraft = {
  description?: unknown;
  meta_title?: unknown;
  meta_description?: unknown;
  fabric?: unknown;
  category_id?: unknown;
  sizes?: unknown;
  colors?: unknown;
  sku_kind?: unknown;
};

const cleanText = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "";

const cleanList = (v: unknown, maxItems: number, maxLen: number): string[] => {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  for (const item of v) {
    const s = cleanText(item, maxLen);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= maxItems) break;
  }
  return out;
};

/**
 * Turn the model's raw answer into a safe draft: clamp lengths, only keep a
 * category id that exists in the shop, and only keep a garment kind from the
 * shop's own SKU letters. Anything unrecognised falls back to empty/OTH so
 * the admin reviews it instead of saving nonsense.
 */
export function sanitizeSmartDraft(
  raw: RawSmartDraft,
  categories: { id: string; name: string }[],
): SmartDraft {
  const categoryId =
    typeof raw.category_id === "string" && categories.some((c) => c.id === raw.category_id)
      ? raw.category_id
      : null;
  const kind =
    typeof raw.sku_kind === "string" &&
    (GARMENT_TYPES as readonly string[]).includes(raw.sku_kind.trim().toUpperCase())
      ? raw.sku_kind.trim().toUpperCase()
      : "OTH";
  return {
    description: cleanText(raw.description, 1200),
    meta_title: cleanText(raw.meta_title, 70),
    meta_description: cleanText(raw.meta_description, 160),
    fabric: cleanText(raw.fabric, 120),
    category_id: categoryId,
    sizes: cleanList(raw.sizes, 12, 8),
    colors: cleanList(raw.colors, 8, 30),
    sku_kind: kind,
  };
}
