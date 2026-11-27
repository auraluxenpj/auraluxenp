import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Auraluxe Admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminCoupons,
});

type Coupon = {
  id: string; code: string; type: string; value: number; min_order: number;
  usage_limit: number | null; used_count: number; starts_at: string | null;
  ends_at: string | null; is_active: boolean;
};
const empty = { code: "", type: "percent", value: "10", min_order: "0", usage_limit: "", starts_at: "", ends_at: "" };
const field = "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm";

function AdminCoupons() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { data: coupons = [], isLoading, error } = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Coupon[];
    },
  });
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function edit(c: Coupon) {
    setEditing(c.id);
    setForm({
      code: c.code, type: c.type, value: String(c.value), min_order: String(c.min_order),
      usage_limit: c.usage_limit == null ? "" : String(c.usage_limit),
      starts_at: c.starts_at ? new Date(c.starts_at).toISOString().slice(0, 16) : "",
      ends_at: c.ends_at ? new Date(c.ends_at).toISOString().slice(0, 16) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function reset() { setEditing(null); setForm(empty); }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const value = Number(form.value);
    const minOrder = Number(form.min_order);
    const limit = form.usage_limit.trim() ? Number(form.usage_limit) : null;
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) { toast.error("Use 3–40 letters, numbers, hyphens or underscores"); return; }
    if (!Number.isFinite(value) || value <= 0 || (form.type === "percent" && value > 100)) { toast.error("Enter a valid discount value"); return; }
    if (!Number.isFinite(minOrder) || minOrder < 0 || (limit !== null && (!Number.isInteger(limit) || limit < 1))) { toast.error("Check minimum order and usage limit"); return; }
    if (form.starts_at && form.ends_at && new Date(form.ends_at) <= new Date(form.starts_at)) { toast.error("End date must be after start date"); return; }
    setSaving(true);
    try {
      const payload = {
        code, type: form.type, value, min_order: minOrder, usage_limit: limit,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };
      const result = editing
        ? await supabase.from("coupons").update(payload).eq("id", editing)
        : await supabase.from("coupons").insert(payload);
      if (result.error) throw result.error;
      toast.success(editing ? "Coupon updated" : "Coupon created");
      reset();
      await qc.invalidateQueries({ queryKey: ["admin", "coupons"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save coupon");
    } finally { setSaving(false); }
  }

  async function toggle(c: Coupon) {
    const { error } = await supabase.from("coupons").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success(c.is_active ? "Coupon paused" : "Coupon activated"); await qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); }
  }
  async function remove(c: Coupon) {
    if (!window.confirm(`Delete coupon ${c.code}? Existing orders will remain unchanged.`)) return;
    const { error } = await supabase.from("coupons").delete().eq("id", c.id);
    if (error) toast.error(error.message);
    else { toast.success("Coupon deleted"); await qc.invalidateQueries({ queryKey: ["admin", "coupons"] }); }
  }

  return (
    <div className="space-y-7">
      <div><h1 className="font-display text-3xl">Coupon Management</h1><p className="mt-2 text-sm text-muted-foreground">Create and manage checkout discount codes. Only store admins can access this page.</p></div>
      <form onSubmit={save} className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl">{editing ? "Edit coupon" : "Create coupon"}</h2>{editing ? <button type="button" onClick={reset} className="text-sm underline">Cancel edit</button> : null}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm">Coupon code<input className={field} value={form.code} onChange={set("code")} placeholder="WELCOME10" maxLength={40} required /></label>
          <label className="space-y-1 text-sm">Discount type<select className={field} value={form.type} onChange={set("type")}><option value="percent">Percentage (%)</option><option value="fixed">Fixed amount (NPR)</option></select></label>
          <label className="space-y-1 text-sm">Discount value<input className={field} type="number" min="0.01" max={form.type === "percent" ? 100 : undefined} step="0.01" value={form.value} onChange={set("value")} required /></label>
          <label className="space-y-1 text-sm">Minimum order (NPR)<input className={field} type="number" min="0" step="0.01" value={form.min_order} onChange={set("min_order")} /></label>
          <label className="space-y-1 text-sm">Total usage limit (blank = unlimited)<input className={field} type="number" min="1" step="1" value={form.usage_limit} onChange={set("usage_limit")} /></label>
          <label className="space-y-1 text-sm">Starts at<input className={field} type="datetime-local" value={form.starts_at} onChange={set("starts_at")} /></label>
          <label className="space-y-1 text-sm">Ends at<input className={field} type="datetime-local" value={form.ends_at} onChange={set("ends_at")} /></label>
        </div>
        <div className="flex gap-2"><button disabled={saving} className="rounded-full bg-primary px-6 py-2.5 text-sm text-primary-foreground disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button></div>
      </form>
      <section className="space-y-3">
        <h2 className="font-display text-xl">Existing coupons</h2>
        {isLoading ? <p className="text-sm text-muted-foreground">Loading coupons…</p> : null}
        {error ? <p className="text-sm text-destructive">Could not load coupons: {error.message}</p> : null}
        {!isLoading && coupons.length === 0 ? <p className="text-sm text-muted-foreground">No coupons created yet.</p> : null}
        {coupons.map((c) => (
          <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="font-mono">{c.code}</strong><span className={`rounded-full px-2 py-1 text-xs ${c.is_active ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"}`}>{c.is_active ? "Active" : "Paused"}</span></div><p className="mt-1 text-sm text-muted-foreground">{c.type === "percent" ? `${c.value}% off` : `NPR ${c.value} off`} · Min. NPR {c.min_order} · Used {c.used_count}{c.usage_limit == null ? "" : ` / ${c.usage_limit}`}</p><p className="text-xs text-muted-foreground">{c.starts_at ? `From ${new Date(c.starts_at).toLocaleString()}` : "No start date"}{c.ends_at ? ` · Until ${new Date(c.ends_at).toLocaleString()}` : " · No end date"}</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => edit(c)} className="rounded-full border border-border px-3 py-2 text-xs">Edit</button><button type="button" onClick={() => void toggle(c)} className="rounded-full border border-border px-3 py-2 text-xs">{c.is_active ? "Pause" : "Activate"}</button><button type="button" onClick={() => void remove(c)} className="rounded-full border border-destructive/40 px-3 py-2 text-xs text-destructive">Delete</button></div>
          </article>
        ))}
      </section>
    </div>
  );
}
