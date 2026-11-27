import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Auraluxe Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCoupons,
});

type CouponRow = {
  id: string; code: string; type: string; value: number; min_order: number;
  usage_limit: number | null; used_count: number; starts_at: string | null;
  ends_at: string | null; is_active: boolean; auto_apply?: boolean;
};
type CouponForm = {
  code: string; value: string; min_order: string; usage_limit: string;
  starts_at: string; ends_at: string; is_active: boolean; auto_apply: boolean;
};
const empty: CouponForm = { code: "", value: "10", min_order: "0", usage_limit: "", starts_at: "", ends_at: "", is_active: true, auto_apply: false };
const field = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

function AdminCoupons() {
  const qc = useQueryClient();
  const db = supabase as any;
  const { data: coupons = [], isLoading } = useQuery<CouponRow[]>({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await db.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as CouponRow[];
    },
  });
  const [form, setForm] = useState<CouponForm>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function edit(c: CouponRow) {
    const local = (v: string | null) => v ? new Date(v).toISOString().slice(0, 16) : "";
    setEditing(c.id);
    setForm({ code: c.code, value: String(c.value), min_order: String(c.min_order), usage_limit: c.usage_limit == null ? "" : String(c.usage_limit), starts_at: local(c.starts_at), ends_at: local(c.ends_at), is_active: c.is_active, auto_apply: !!c.auto_apply });
  }
  function reset() { setEditing(null); setForm(empty); }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(form.value);
    const min = Number(form.min_order);
    const limit = form.usage_limit === "" ? null : Number(form.usage_limit);
    if (!/^[A-Z0-9_-]{3,40}$/.test(form.code.trim().toUpperCase())) { toast.error("Use 3–40 letters, numbers, hyphens or underscores for the code."); return; }
    if (!Number.isFinite(value) || value <= 0 || value > 100 || !Number.isFinite(min) || min < 0 || (limit !== null && (!Number.isInteger(limit) || limit < 1))) { toast.error("Check the percentage, minimum order and usage limit."); return; }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) { toast.error("End date must be after the start date."); return; }
    setBusy(true);
    try {
      const payload = {
        code: form.code.trim().toUpperCase(), type: "percent", value, min_order: min,
        usage_limit: limit, starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        is_active: form.is_active, auto_apply: form.auto_apply,
      };
      const result = editing
        ? await db.from("coupons").update(payload).eq("id", editing)
        : await db.from("coupons").insert(payload);
      if (result.error) throw result.error;
      toast.success(editing ? "Coupon updated" : "Coupon created");
      reset();
      await qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
    } catch (err) { toast.error(err instanceof Error ? err.message : "Couldn't save coupon"); }
    finally { setBusy(false); }
  }
  async function toggle(c: CouponRow) {
    const { error } = await db.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(c.is_active ? "Coupon paused" : "Coupon activated"); qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); }
  }
  async function remove(c: CouponRow) {
    if (!window.confirm(`Delete coupon ${c.code}? Existing orders will remain unchanged.`)) return;
    const { error } = await db.from("coupons").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Coupon deleted"); if (editing === c.id) reset(); qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); }
  }

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="font-display text-3xl">Coupon Management</h1><p className="mt-1 text-sm text-muted-foreground">Create percentage offers and control how customers use them.</p></div><button onClick={reset} className="rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground">New coupon</button></div>
    <form onSubmit={save} className="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2">
      <h2 className="font-display text-xl sm:col-span-2">{editing ? "Edit coupon" : "Create coupon"}</h2>
      <label className="space-y-1 text-sm">Coupon code<input required maxLength={40} className={field} placeholder="WELCOME10" value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
      <label className="space-y-1 text-sm">Discount percentage<input required type="number" min="0.01" max="100" step="0.01" className={field} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label>
      <label className="space-y-1 text-sm">Minimum order (NPR)<input required type="number" min="0" step="0.01" className={field} value={form.min_order} onChange={e => setForm({ ...form, min_order: e.target.value })} /></label>
      <label className="space-y-1 text-sm">Total uses allowed<input type="number" min="1" step="1" className={field} placeholder="Unlimited" value={form.usage_limit} onChange={e => setForm({ ...form, usage_limit: e.target.value })} /></label>
      <label className="space-y-1 text-sm">Starts at<input type="datetime-local" className={field} value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></label>
      <label className="space-y-1 text-sm">Ends at<input type="datetime-local" className={field} value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></label>
      <div className="flex flex-wrap gap-5 sm:col-span-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} />Active</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.auto_apply} onChange={e => setForm({ ...form, auto_apply: e.target.checked })} />Automatically apply when eligible</label></div>
      <div className="flex gap-2 sm:col-span-2"><button disabled={busy} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-60">{busy ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button>{editing && <button type="button" onClick={reset} className="rounded-full border border-border px-5 py-2.5 text-sm">Cancel</button>}</div>
    </form>
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="border-b border-border p-4 font-display text-xl">Existing coupons</div>
      {isLoading ? <p className="p-5 text-sm text-muted-foreground">Loading coupons…</p> : coupons.length === 0 ? <p className="p-5 text-sm text-muted-foreground">No coupons created yet.</p> : <div className="divide-y divide-border">{coupons.map(c => <div key={c.id} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="font-semibold tracking-wider">{c.code} <span className="ml-2 text-sm font-normal text-muted-foreground">{Number(c.value)}% off</span></p><p className="mt-1 text-xs text-muted-foreground">Min. NPR {Number(c.min_order).toLocaleString()} · Used {c.used_count}{c.usage_limit == null ? "" : ` / ${c.usage_limit}`} · {c.auto_apply ? "Auto-apply" : "Code required"} · {c.is_active ? "Active" : "Paused"}</p></div><button onClick={() => edit(c)} className="rounded-full border border-border px-4 py-2 text-xs">Edit</button><button onClick={() => toggle(c)} className="rounded-full border border-border px-4 py-2 text-xs">{c.is_active ? "Pause" : "Activate"}</button><button onClick={() => remove(c)} className="rounded-full border border-destructive/40 px-4 py-2 text-xs text-destructive">Delete</button></div>)}</div>}
    </section>
  </div>;
}
