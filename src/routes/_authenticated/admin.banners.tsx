import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, GripVertical, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bannerIsLive, fetchBanners, type Banner } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/admin/banners")({
  head: () => ({
    meta: [
      { title: "Banner Management — Auraluxe Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminBanners,
});

const BUCKET = "product-images";
const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp"];
const SIGNED_URL_SECONDS = 60 * 60 * 24 * 365 * 20;

type FormState = {
  title: string;
  subtitle: string;
  button_text: string;
  button_link: string;
  placement: string;
  image_url: string;
  mobile_image_url: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const EMPTY_FORM: FormState = {
  title: "",
  subtitle: "",
  button_text: "",
  button_link: "/shop",
  placement: "hero",
  image_url: "",
  mobile_image_url: "",
  starts_at: "",
  ends_at: "",
  is_active: false,
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  return v ? new Date(v).toISOString() : null;
}

function toForm(b: Banner): FormState {
  return {
    title: b.title ?? "",
    subtitle: b.subtitle ?? "",
    button_text: b.button_text ?? "",
    button_link: b.button_link ?? "",
    placement: b.placement,
    image_url: b.image_url ?? "",
    mobile_image_url: b.mobile_image_url ?? "",
    starts_at: toLocalInput(b.starts_at),
    ends_at: toLocalInput(b.ends_at),
    is_active: b.is_active,
  };
}

function linkError(link: string): string | null {
  if (!link.trim()) return null;
  const v = link.trim();
  if (v.startsWith("/")) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? null : "External links must start with https://";
  } catch {
    return "Enter a site path like /shop or a full https:// link";
  }
}

const field = "w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm";

function ImageSlot({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (url: string, meta: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState("");

  async function upload(file: File) {
    if (!ACCEPTED.includes(file.type)) {
      toast.error("Please choose a PNG, JPG or WebP image");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("The image is larger than 8MB");
      return;
    }
    setBusy(true);
    try {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `banners/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data, error: signErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, SIGNED_URL_SECONDS);
      if (signErr || !data?.signedUrl) throw signErr ?? new Error("Couldn't create image link");
      const dims = await new Promise<string>((resolve) => {
        const img = new Image();
        img.onload = () => resolve(`${img.naturalWidth}×${img.naturalHeight}px`);
        img.onerror = () => resolve("");
        img.src = URL.createObjectURL(file);
      });
      const kb = Math.round(file.size / 1024);
      const info = `${dims ? `${dims} · ` : ""}${file.type.split("/")[1].toUpperCase()} · ${kb} KB`;
      setMeta(info);
      onChange(data.signedUrl, info);
      toast.success(`${label} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{label}</p>
      {value ? (
        <div className="space-y-2">
          <img src={value} alt={label} className="max-h-44 w-full rounded-xl border border-border object-cover" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {meta ? <span className="text-muted-foreground">{meta}</span> : null}
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-full border border-border px-4 py-2">
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                setMeta("");
                onChange("", "");
              }}
              className="rounded-full border border-destructive/40 px-4 py-2 text-destructive"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="w-full rounded-xl border-2 border-dashed border-border px-6 py-5 text-sm text-muted-foreground hover:border-primary/60"
        >
          {busy ? "Uploading…" : `Upload ${label.toLowerCase()}`}
        </button>
      )}
      <input ref={fileRef} type="file" accept={ACCEPTED.join(",")} hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function AdminBanners() {
  const qc = useQueryClient();
  const { data: banners = [], isLoading } = useQuery({
    queryKey: ["admin", "banners"],
    queryFn: () => fetchBanners(),
  });

  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const [announcement, setAnnouncement] = useState("");
  const [announcementEnabled, setAnnouncementEnabled] = useState(true);
  const [annBusy, setAnnBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("site_settings")
      .select("key, value")
      .in("key", ["announcement", "announcement_enabled"])
      .then(({ data }) => {
        for (const row of data ?? []) {
          if (row.key === "announcement") setAnnouncement(row.value ?? "");
          if (row.key === "announcement_enabled") setAnnouncementEnabled(row.value !== "false");
        }
      });
  }, []);

  function startEdit(b: Banner) {
    setEditingId(b.id);
    setForm(toForm(b));
  }

  function startNew() {
    setEditingId("new");
    setForm(EMPTY_FORM);
  }

  async function save() {
    const err = linkError(form.button_link);
    if (err) {
      toast.error(err);
      return;
    }
    setBusy(true);
    const payload = {
      title: form.title.trim() || null,
      subtitle: form.subtitle.trim() || null,
      button_text: form.button_text.trim() || null,
      button_link: form.button_link.trim() || null,
      placement: form.placement,
      image_url: form.image_url || null,
      mobile_image_url: form.mobile_image_url || null,
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      is_active: form.is_active,
    };
    try {
      if (editingId === "new") {
        const maxSort = banners.reduce((m, b) => Math.max(m, b.sort_order), 0);
        const { error } = await supabase.from("banners").insert({ ...payload, sort_order: maxSort + 1 });
        if (error) throw error;
        toast.success("Banner saved");
      } else if (editingId) {
        const { error } = await supabase.from("banners").update(payload).eq("id", editingId);
        if (error) throw error;
        toast.success("Banner updated");
      }
      setEditingId(null);
      await qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      await qc.invalidateQueries({ queryKey: ["banners"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the banner");
    } finally {
      setBusy(false);
    }
  }

  async function duplicate(b: Banner) {
    const maxSort = banners.reduce((m, x) => Math.max(m, x.sort_order), 0);
    const { error } = await supabase.from("banners").insert({
      title: b.title,
      subtitle: b.subtitle,
      button_text: b.button_text,
      button_link: b.button_link,
      placement: b.placement,
      image_url: b.image_url,
      mobile_image_url: b.mobile_image_url,
      starts_at: b.starts_at,
      ends_at: b.ends_at,
      is_active: false,
      sort_order: maxSort + 1,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Duplicated as a disabled draft");
      qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    }
  }

  async function toggle(b: Banner) {
    const { error } = await supabase.from("banners").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success(b.is_active ? "Banner unpublished" : "Banner published");
      qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      qc.invalidateQueries({ queryKey: ["banners"] });
    }
  }

  async function remove(b: Banner) {
    if (!window.confirm(`Delete "${b.title ?? "this banner"}" permanently?`)) return;
    const { error } = await supabase.from("banners").delete().eq("id", b.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Banner deleted");
      if (editingId === b.id) setEditingId(null);
      qc.invalidateQueries({ queryKey: ["admin", "banners"] });
      qc.invalidateQueries({ queryKey: ["banners"] });
    }
  }

  async function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const ids = banners.map((b) => b.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const results = await Promise.all(
      ids.map((id, i) => supabase.from("banners").update({ sort_order: i + 1 }).eq("id", id)),
    );
    if (results.some((r) => r.error)) toast.error("Couldn't save the new order");
    else toast.success("Banner order saved");
    setDragId(null);
    qc.invalidateQueries({ queryKey: ["admin", "banners"] });
    qc.invalidateQueries({ queryKey: ["banners"] });
  }

  async function saveAnnouncement() {
    setAnnBusy(true);
    try {
      const rows = [
        { key: "announcement", value: announcement.trim() },
        { key: "announcement_enabled", value: announcementEnabled ? "true" : "false" },
      ];
      for (const row of rows) {
        const { error } = await supabase.from("site_settings").upsert(row, { onConflict: "key" });
        if (error) throw error;
      }
      toast.success("Announcement bar saved");
      qc.invalidateQueries({ queryKey: ["site_settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save the announcement");
    } finally {
      setAnnBusy(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Banner Management</h1>
        <button onClick={startNew} className="rounded-full bg-primary px-6 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground">
          New banner
        </button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-xl">Announcement bar</h2>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            className={`${field} max-w-md`}
            placeholder="e.g. Free delivery over Rs. 3,500"
            value={announcement}
            onChange={(e) => setAnnouncement(e.target.value)}
          />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={announcementEnabled} onChange={(e) => setAnnouncementEnabled(e.target.checked)} className="accent-primary" />
            Show on site
          </label>
          <button onClick={saveAnnouncement} disabled={annBusy} className="rounded-full border border-border px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] disabled:opacity-60">
            {annBusy ? "Saving…" : "Save"}
          </button>
        </div>
      </section>

      {editingId ? (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
          <h2 className="font-display text-xl">{editingId === "new" ? "New banner" : "Edit banner"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input className={field} placeholder="Headline" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <input className={field} placeholder="Button label (e.g. Shop Now)" value={form.button_text} onChange={(e) => setForm((f) => ({ ...f, button_text: e.target.value }))} />
          </div>
          <textarea rows={2} className={field} placeholder="Short supporting text" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <input className={field} placeholder="Destination: /shop or https://…" value={form.button_link} onChange={(e) => setForm((f) => ({ ...f, button_link: e.target.value }))} />
              {form.button_link && linkError(form.button_link) ? (
                <p className="mt-1 text-xs text-destructive">{linkError(form.button_link)}</p>
              ) : null}
            </div>
            <select className={field} value={form.placement} onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}>
              <option value="hero">Hero carousel</option>
              <option value="promo">Promotional strip</option>
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="accent-primary" />
              Published (visible on the site)
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Campaign start (optional)</p>
              <input type="datetime-local" className={field} value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Campaign end (optional)</p>
              <input type="datetime-local" className={field} value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <ImageSlot
              label="Desktop image"
              hint="Wide image, around 1920×900 works best. PNG, JPG or WebP up to 8MB."
              value={form.image_url}
              onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
            />
            <ImageSlot
              label="Mobile image (optional)"
              hint="Taller crop for phones, around 1080×1350. Falls back to the desktop image."
              value={form.mobile_image_url}
              onChange={(url) => setForm((f) => ({ ...f, mobile_image_url: url }))}
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={save} disabled={busy} className="rounded-full bg-primary px-6 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-60">
              {busy ? "Saving…" : "Save banner"}
            </button>
            <button onClick={() => setEditingId(null)} className="rounded-full border border-border px-6 py-2.5 text-[12px] uppercase tracking-[0.15em]">
              Cancel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            An unpublished banner is a draft: saved here but hidden from the site. Your current live banner stays unchanged until you save a replacement.
          </p>
        </section>
      ) : null}

      <section className="space-y-2">
        <p className="text-xs text-muted-foreground">Drag banners to reorder. The homepage shows hero banners in this order.</p>
        {banners.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No banners yet — the homepage is showing its built-in default hero.
          </p>
        ) : (
          banners.map((b) => (
            <div
              key={b.id}
              draggable
              onDragStart={() => setDragId(b.id)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => dropOn(b.id)}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <GripVertical className="size-4 cursor-grab text-muted-foreground" aria-hidden />
              {b.image_url ? (
                <img src={b.image_url} alt="" className="h-14 w-24 rounded-lg object-cover" />
              ) : (
                <div className="grid h-14 w-24 place-items-center rounded-lg bg-muted text-[10px] uppercase text-muted-foreground">No image</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.title ?? "(no headline)"}</p>
                <p className="text-xs text-muted-foreground">
                  {b.placement === "hero" ? "Hero carousel" : "Promotional strip"}
                  {b.starts_at ? ` · starts ${new Date(b.starts_at).toLocaleDateString()}` : ""}
                  {b.ends_at ? ` · ends ${new Date(b.ends_at).toLocaleDateString()}` : ""}
                  {b.mobile_image_url ? " · has mobile image" : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.15em] ${
                  bannerIsLive(b) ? "bg-accent/40 text-accent-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {b.is_active ? (bannerIsLive(b) ? "Live" : "Scheduled") : "Draft"}
              </span>
              <div className="flex gap-2">
                <button onClick={() => toggle(b)} className="rounded-full border border-border px-4 py-2 text-xs">
                  {b.is_active ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => startEdit(b)} aria-label="Edit" className="rounded-full border border-border p-2">
                  <Pencil className="size-4" />
                </button>
                <button onClick={() => duplicate(b)} aria-label="Duplicate" className="rounded-full border border-border p-2">
                  <Copy className="size-4" />
                </button>
                <button onClick={() => remove(b)} aria-label="Delete" className="rounded-full border border-destructive/40 p-2 text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
