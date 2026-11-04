import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const FRAMES = [
  { label: "Product (4:5)", value: 4 / 5 },
  { label: "Portrait (3:4)", value: 3 / 4 },
  { label: "Square (1:1)", value: 1 },
  { label: "Banner (16:9)", value: 16 / 9 },
];

async function cropToBlob(src: string, area: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const maxW = 1400;
  const scale = Math.min(1, maxW / area.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(area.width * scale);
  canvas.height = Math.round(area.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Crop failed"))), "image/jpeg", 0.85));
}

export function ImageUploader({ onUploaded, defaultAspect = 4 / 5 }: { onUploaded: (url: string) => void; defaultAspect?: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(defaultAspect);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const current = queue[0];

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const urls = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .filter((f) => (f.size > 15 * 1024 * 1024 ? (toast.error(`${f.name} is larger than 15MB`), false) : true))
      .map((f) => URL.createObjectURL(f));
    setQueue((q) => [...q, ...urls]);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const next = () => {
    if (current) URL.revokeObjectURL(current);
    setQueue((q) => q.slice(1));
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const onComplete = useCallback((_: Area, px: Area) => setArea(px), []);

  const save = async () => {
    if (!current || !area) return;
    setBusy(true);
    try {
      const blob = await cropToBlob(current, area);
      const path = `products/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw error;
      const { data, error: sErr } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 20);
      if (sErr || !data) throw sErr ?? new Error("Could not get link");
      onUploaded(data.signedUrl);
      toast.success("Photo uploaded");
      next();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center text-sm transition ${drag ? "border-primary bg-primary/5" : "border-border hover:border-primary/60"}`}
      >
        <p className="font-medium">Drop photos here or tap to choose</p>
        <p className="mt-1 text-xs text-muted-foreground">You can crop each photo to fit the frame before it's saved.</p>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {current ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-background p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-xl">Crop photo</h3>
              {queue.length > 1 ? <span className="text-xs text-muted-foreground">{queue.length - 1} more waiting</span> : null}
            </div>
            <div className="relative h-80 w-full overflow-hidden rounded-xl bg-muted">
              <Cropper image={current} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onComplete} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FRAMES.map((fr) => (
                <button key={fr.label} type="button" onClick={() => setAspect(fr.value)}
                  className={`rounded-full border px-3 py-1 text-xs ${aspect === fr.value ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                  {fr.label}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-3 text-xs">Zoom
              <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={next} disabled={busy} className="rounded-full border border-border px-4 py-2 text-sm">Skip</button>
              <button type="button" onClick={save} disabled={busy} className="rounded-full bg-primary px-5 py-2 text-sm text-primary-foreground disabled:opacity-60">
                {busy ? "Uploading…" : "Crop & upload"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
