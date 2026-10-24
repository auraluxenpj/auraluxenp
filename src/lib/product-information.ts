export const PHOTO_DISCLAIMER = "Please note: the actual product’s colour, texture and fine details may vary slightly from the images shown due to lighting, camera settings, screen display and AI-generated or enhanced imagery.";

export const GARMENT_TYPES = ["KURTI", "CO-ORD-SET", "SUIT", "DRESS", "SAREE", "GOWN", "PALAZZO-SET", "SHARARA-SET", "TOP", "PARTY-WEAR", "OTHER"] as const;

export function skuTypeForProduct(name: string, category = ""): string {
  const value = `${name} ${category}`.toLowerCase();
  if (/saree|sari/.test(value)) return "SAREE";
  if (/sharara/.test(value)) return "SHARARA-SET";
  if (/co[ -]?ord/.test(value)) return "CO-ORD-SET";
  if (/palazzo|plazzo/.test(value)) return "PALAZZO-SET";
  if (/kurti|kurta/.test(value)) return "KURTI";
  if (/gown/.test(value)) return "GOWN";
  if (/dress/.test(value)) return "DRESS";
  if (/suit/.test(value)) return "SUIT";
  if (/\btop\b/.test(value)) return "TOP";
  if (/party/.test(value)) return "PARTY-WEAR";
  return "OTHER";
}

export function buildProductSku(kind: string, suffix: string): string {
  const type = kind.trim().toUpperCase();
  const ending = suffix.trim().toUpperCase();
  if (!(GARMENT_TYPES as readonly string[]).includes(type)) throw new Error("Choose a garment type for the SKU");
  if (!/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(ending)) throw new Error("Enter the final SKU identifier using letters, numbers or dashes");
  return `AL-${type}-${ending}`;
}

export function splitProductSku(sku: string | null, name: string, category = "") {
  const value = sku?.trim().toUpperCase() ?? "";
  const kind = [...GARMENT_TYPES].sort((a, b) => b.length - a.length).find((t) => value.startsWith(`AL-${t}-`));
  if (kind) return { kind, suffix: value.slice(`AL-${kind}-`.length) };
  // Retain legacy identifiers when the admin saves using the descriptive format.
  return { kind: skuTypeForProduct(name, category), suffix: value.replace(/^AL-[A-Z]+-/, "") };
}

export function isProductSku(value: string): boolean {
  const parsed = splitProductSku(value, "");
  try { return buildProductSku(parsed.kind, parsed.suffix) === value; } catch { return false; }
}