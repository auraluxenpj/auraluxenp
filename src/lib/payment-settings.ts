// Client-safe payment settings types and pure rules (no server imports).

export type PaymentSettings = {
  id: string;
  qr_enabled: boolean;
  qr_provider: string | null;
  qr_merchant_name: string | null;
  qr_instructions: string | null;
  qr_image_path: string | null;
  bank_enabled: boolean;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_branch: string | null;
  bank_account_type: string | null;
  bank_instructions: string | null;
  updated_by: string | null;
  updated_at: string;
};

// Narrow projection exposed to customers at checkout — never the raw row.
export type CheckoutMethod =
  | {
      id: "qr";
      label: string;
      provider: string | null;
      merchantName: string;
      instructions: string | null;
      qrImageUrl: string | null; // short-lived signed link, minted server-side
    }
  | {
      id: "bank_transfer";
      label: string;
      bankName: string;
      accountName: string;
      accountNumber: string;
      branch: string | null;
      accountType: string | null;
      instructions: string | null;
    };

const filled = (v: string | null | undefined) => !!v && v.trim().length > 0;

export function qrComplete(s: Pick<PaymentSettings, "qr_enabled" | "qr_image_path" | "qr_merchant_name">): boolean {
  return s.qr_enabled && filled(s.qr_image_path) && filled(s.qr_merchant_name);
}

export function bankComplete(
  s: Pick<PaymentSettings, "bank_enabled" | "bank_name" | "bank_account_name" | "bank_account_number">,
): boolean {
  return s.bank_enabled && filled(s.bank_name) && filled(s.bank_account_name) && filled(s.bank_account_number);
}

// Only genuinely enabled + complete methods are ever offered. COD is never
// returned here — it is removed for new orders.
export function enabledCheckoutMethods(
  s: Pick<PaymentSettings, "qr_enabled" | "qr_image_path" | "qr_merchant_name" | "bank_enabled" | "bank_name" | "bank_account_name" | "bank_account_number">,
): Array<"qr" | "bank_transfer"> {
  const out: Array<"qr" | "bank_transfer"> = [];
  if (qrComplete(s)) out.push("qr");
  if (bankComplete(s)) out.push("bank_transfer");
  return out;
}

export function isAllowedNewOrderMethod(method: string): method is "qr" | "bank_transfer" {
  return method === "qr" || method === "bank_transfer";
}

// ---- QR upload rules: real raster images only, never SVG, never cropped ----
export const QR_MAX_BYTES = 5 * 1024 * 1024;
export const QR_ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const QR_BUCKET = "payment-qr";

// Magic-byte check so a renamed script/SVG cannot pass as an image.
export function sniffImageMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

export function qrPathIsValid(path: string): boolean {
  return /^qr\/[a-z0-9-]+\.(png|jpe?g|webp)$/.test(path);
}
