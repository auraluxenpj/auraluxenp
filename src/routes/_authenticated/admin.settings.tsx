import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getAdminPaymentSettings, savePaymentSettings } from "@/lib/payment-settings.functions";
import {
  QR_ACCEPTED_MIME,
  QR_BUCKET,
  QR_MAX_BYTES,
  sniffImageMime,
  type PaymentSettings,
} from "@/lib/payment-settings";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Auraluxe Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettings,
});

type FormState = {
  qr_enabled: boolean;
  qr_provider: string;
  qr_merchant_name: string;
  qr_instructions: string;
  qr_image_path: string | null;
  bank_enabled: boolean;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_branch: string;
  bank_account_type: string;
  bank_instructions: string;
};

const EMPTY: FormState = {
  qr_enabled: false,
  qr_provider: "",
  qr_merchant_name: "",
  qr_instructions: "",
  qr_image_path: null,
  bank_enabled: false,
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_branch: "",
  bank_account_type: "",
  bank_instructions: "",
};

function toForm(s: PaymentSettings | null): FormState {
  if (!s) return EMPTY;
  return {
    qr_enabled: s.qr_enabled,
    qr_provider: s.qr_provider ?? "",
    qr_merchant_name: s.qr_merchant_name ?? "",
    qr_instructions: s.qr_instructions ?? "",
    qr_image_path: s.qr_image_path,
    bank_enabled: s.bank_enabled,
    bank_name: s.bank_name ?? "",
    bank_account_name: s.bank_account_name ?? "",
    bank_account_number: s.bank_account_number ?? "",
    bank_branch: s.bank_branch ?? "",
    bank_account_type: s.bank_account_type ?? "",
    bank_instructions: s.bank_instructions ?? "",
  };
}

const field = "w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm";

function AdminSettings() {
  const qc = useQueryClient();
  const fetchSettings = useServerFn(getAdminPaymentSettings);
  const save = useServerFn(savePaymentSettings);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "payment-settings"],
    queryFn: () => fetchSettings(),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (data) setForm(toForm(data.settings));
  }, [data]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const setBool = (k: "qr_enabled" | "bank_enabled") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.checked }));

  async function uploadQr(file: File) {
    if (!QR_ACCEPTED_MIME.includes(file.type as (typeof QR_ACCEPTED_MIME)[number])) {
      toast.error("Please choose a PNG, JPG or WebP image");
      return;
    }
    if (file.size > QR_MAX_BYTES) {
      toast.error("The image is larger than 5MB");
      return;
    }
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const mime = sniffImageMime(head);
    if (!mime || mime !== (file.type === "image/jpg" ? "image/jpeg" : file.type)) {
      toast.error("That file isn't a genuine image");
      return;
    }
    setUploading(true);
    try {
      const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const path = `qr/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(QR_BUCKET).upload(path, file, { contentType: mime });
      if (error) throw error;
      if (form.qr_image_path) {
        await supabase.storage.from(QR_BUCKET).remove([form.qr_image_path]);
      }
      setForm((f) => ({ ...f, qr_image_path: path }));
      toast.success("QR image uploaded — remember to save");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeQr() {
    if (!form.qr_image_path) return;
    setUploading(true);
    try {
      await supabase.storage.from(QR_BUCKET).remove([form.qr_image_path]);
      setForm((f) => ({ ...f, qr_image_path: null }));
      toast.success("QR image removed — remember to save");
    } finally {
      setUploading(false);
    }
  }

  async function onSave() {
    setBusy(true);
    try {
      const emptyToNull = (v: string) => (v.trim() === "" ? null : v.trim());
      await save({
        data: {
          qr_enabled: form.qr_enabled,
          qr_provider: emptyToNull(form.qr_provider),
          qr_merchant_name: emptyToNull(form.qr_merchant_name),
          qr_instructions: emptyToNull(form.qr_instructions),
          qr_image_path: form.qr_image_path,
          bank_enabled: form.bank_enabled,
          bank_name: emptyToNull(form.bank_name),
          bank_account_name: emptyToNull(form.bank_account_name),
          bank_account_number: emptyToNull(form.bank_account_number),
          bank_branch: emptyToNull(form.bank_branch),
          bank_account_type: emptyToNull(form.bank_account_type),
          bank_instructions: emptyToNull(form.bank_instructions),
        },
      });
      toast.success("Payment settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "payment-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Payment Settings</h1>
        <button onClick={onSave} disabled={busy} className="rounded-full bg-primary px-6 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-60">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Customers only see a payment method at checkout when it is switched on and fully filled in. Never enter passwords, PINs or OTPs here — only details a customer needs to pay you.
      </p>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={form.qr_enabled} onChange={setBool("qr_enabled")} className="accent-primary" />
          Enable QR payment
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={field} placeholder="Provider (e.g. eSewa, FonePay)" value={form.qr_provider} onChange={set("qr_provider")} />
          <input className={field} placeholder="Merchant / account display name *" value={form.qr_merchant_name} onChange={set("qr_merchant_name")} />
        </div>
        <textarea rows={3} className={field} placeholder="Instructions shown to the customer (optional)" value={form.qr_instructions} onChange={set("qr_instructions")} />

        <div>
          <p className="mb-2 text-sm font-medium">QR image *</p>
          {form.qr_image_path ? (
            <div className="flex flex-wrap items-center gap-4">
              {data?.qrImageUrl ? (
                <img src={data.qrImageUrl} alt="Payment QR code" className="h-36 w-36 rounded-xl border border-border object-contain bg-background" />
              ) : (
                <p className="text-xs text-muted-foreground">QR image saved (preview unavailable)</p>
              )}
              <div className="flex gap-2 text-xs">
                <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-full border border-border px-4 py-2">
                  Replace
                </button>
                <button type="button" onClick={removeQr} disabled={uploading} className="rounded-full border border-destructive/40 px-4 py-2 text-destructive">
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-xl border-2 border-dashed border-border px-6 py-6 text-sm text-muted-foreground hover:border-primary/60">
              {uploading ? "Uploading…" : "Upload QR image (PNG, JPG or WebP, up to 5MB)"}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])}
          />
          <p className="mt-2 text-xs text-muted-foreground">The QR image is stored privately and shown to customers through a short-lived secure link. It is never cropped or altered.</p>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={form.bank_enabled} onChange={setBool("bank_enabled")} className="accent-primary" />
          Enable bank transfer
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={field} placeholder="Bank name *" value={form.bank_name} onChange={set("bank_name")} />
          <input className={field} placeholder="Account holder / business name *" value={form.bank_account_name} onChange={set("bank_account_name")} />
          <input className={field} placeholder="Account number *" value={form.bank_account_number} onChange={set("bank_account_number")} />
          <input className={field} placeholder="Branch" value={form.bank_branch} onChange={set("bank_branch")} />
          <input className={field} placeholder="Account type (e.g. Savings, Current)" value={form.bank_account_type} onChange={set("bank_account_type")} />
        </div>
        <textarea rows={3} className={field} placeholder="Instructions shown to the customer (optional)" value={form.bank_instructions} onChange={set("bank_instructions")} />
      </section>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Change history</h2>
        {data?.audit?.length ? (
          <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
            {data.audit.map((a: { id: string; changed_by: string | null; changed_at: string }) => (
              <li key={a.id}>
                Changed by {a.changed_by ? `${a.changed_by.slice(0, 8)}…` : "system"} on {new Date(a.changed_at).toLocaleString()}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">No changes recorded yet.</p>
        )}
      </section>
    </div>
  );
}
