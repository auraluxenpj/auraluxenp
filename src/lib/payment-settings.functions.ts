import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  bankComplete,
  qrComplete,
  qrPathIsValid,
  QR_BUCKET,
  type CheckoutMethod,
  type PaymentSettings,
} from "./payment-settings";

async function requireAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

// Admin: full settings + short-lived QR preview link + recent audit history.
export const getAdminPaymentSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { data, error } = await db.from("payment_settings").select("*").eq("id", "main").maybeSingle();
    if (error) throw error;

    let qrImageUrl: string | null = null;
    if (data?.qr_image_path) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: signed } = await supabaseAdmin.storage
        .from(QR_BUCKET)
        .createSignedUrl(data.qr_image_path, 600);
      qrImageUrl = signed?.signedUrl ?? null;
    }

    const { data: audit } = await db
      .from("payment_settings_audit")
      .select("id, changed_by, changed_at")
      .order("changed_at", { ascending: false })
      .limit(10);

    return { settings: (data ?? null) as PaymentSettings | null, qrImageUrl, audit: audit ?? [] };
  });

const saveSchema = z.object({
  qr_enabled: z.boolean(),
  qr_provider: z.string().trim().max(60).nullable(),
  qr_merchant_name: z.string().trim().max(120).nullable(),
  qr_instructions: z.string().trim().max(1000).nullable(),
  qr_image_path: z.string().trim().max(200).nullable(),
  bank_enabled: z.boolean(),
  bank_name: z.string().trim().max(120).nullable(),
  bank_account_name: z.string().trim().max(120).nullable(),
  bank_account_number: z.string().trim().max(60).nullable(),
  bank_branch: z.string().trim().max(120).nullable(),
  bank_account_type: z.string().trim().max(60).nullable(),
  bank_instructions: z.string().trim().max(1000).nullable(),
});

// Admin: save settings. The changer is recorded server-side from the verified
// session — caller-submitted actor IDs are never accepted.
export const savePaymentSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.supabase, context.userId);
    if (data.qr_image_path && !qrPathIsValid(data.qr_image_path)) {
      throw new Error("Invalid QR image path");
    }
    const db = context.supabase as any;
    const { error } = await db
      .from("payment_settings")
      .update({ ...data, updated_by: context.userId })
      .eq("id", "main");
    if (error) throw error;
    return { ok: true };
  });

// Public: narrow projection of enabled, fully configured methods only.
// The QR image is exposed as a short-lived signed link — the bucket stays
// private and no other file is reachable through this.
export const getCheckoutPaymentMethods = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any)
    .from("payment_settings")
    .select(
      "qr_enabled, qr_provider, qr_merchant_name, qr_instructions, qr_image_path, bank_enabled, bank_name, bank_account_name, bank_account_number, bank_branch, bank_account_type, bank_instructions",
    )
    .eq("id", "main")
    .maybeSingle();
  if (error) throw error;

  const methods: CheckoutMethod[] = [];
  if (data && qrComplete(data)) {
    let qrImageUrl: string | null = null;
    const { data: signed } = await supabaseAdmin.storage
      .from(QR_BUCKET)
      .createSignedUrl(data.qr_image_path, 3600);
    qrImageUrl = signed?.signedUrl ?? null;
    if (qrImageUrl) {
      methods.push({
        id: "qr",
        label: data.qr_provider?.trim() ? `Pay by QR (${data.qr_provider.trim()})` : "Pay by QR",
        provider: data.qr_provider ?? null,
        merchantName: data.qr_merchant_name.trim(),
        instructions: data.qr_instructions ?? null,
        qrImageUrl,
      });
    }
  }
  if (data && bankComplete(data)) {
    methods.push({
      id: "bank_transfer",
      label: "Bank transfer",
      bankName: data.bank_name.trim(),
      accountName: data.bank_account_name.trim(),
      accountNumber: data.bank_account_number.trim(),
      branch: data.bank_branch ?? null,
      accountType: data.bank_account_type ?? null,
      instructions: data.bank_instructions ?? null,
    });
  }
  return { methods };
});
