import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useSettings, whatsappLink } from "@/lib/store";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Auraluxe — Nepalgunj Store" },
      {
        name: "description",
        content:
          "Call, WhatsApp, email or visit the Auraluxe store in Nepalgunj. Store hours, map and social links.",
      },
      { property: "og:title", content: "Contact Auraluxe — Nepalgunj Store" },
      {
        property: "og:description",
        content: "Call, WhatsApp, email or visit the Auraluxe store in Nepalgunj.",
      },
    ],
  }),
  component: Contact;
});

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(20),
  message: z.string().trim().min(1, "Please write a message").max(1000),
});

function Contact() {
  const s = useSettings();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });

  const field =
    "w-full rounded-2xl border border-border bg-input px-5 py-3 text-sm outline-none placeholder:text-muted-foreground";

  return (
    <SiteLayout>
      <div className="mt-10">
        <p className="eyebrow">We'd love to hear from you</p>
        <h1 className="mt-2 font-display text-5xl">Contact Auraluxe</h1>
      </div>

      <section className="mt-6 grid gap-6 lg:grid-cols-12">
        <form
          className="glass-strong rounded-3xl p-6 sm:p-8 lg:col-span-7"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = schema.safeParse(form);
            if (!parsed.success) {
              toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
              return;
            }
            window.open(
              whatsappLink(
                s["whatsapp"] ?? "",
                `Hello Auraluxe!\nName: ${parsed.data.name}\nPhone: ${parsed.data.phone}\n\n${parsed.data.message}`,
              ),
              "_blank",
            );
            toast.success("Opening WhatsApp with your message");
          }}
        >
          <h2 className="font-display text-2xl">Send a message</h2>
          <div className="mt-5 flex flex-col gap-3">
            <input
              className={field}
              placeholder="Your name"
              maxLength={100}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className={field}
              placeholder="Phone number"
              maxLength={20}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <textarea
              className={`${field} min-h-32`}
              placeholder="How can we help?"
              maxLength={1000}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
            <button
              type="submit"
              className="rounded-full bg-primary py-3.5 text-[12px] uppercase tracking-[0.18em] text-primary-foreground"
            >
              Send on WhatsApp
            </button>
          </div>
        </form>

        <div className="flex flex-col gap-4 lg:col-span-5">
          <div className="glass rounded-3xl p-6">
            <p className="label-caps text-muted-foreground">Store</p>
            <p className="mt-2 text-[15px]">{s["address"]}</p>
            <p className="mt-3 text-[15px]">{s["phone"]}</p>
            <p className="text-[15px]">{s["email"]}</p>
            <p className="mt-3 text-sm text-muted-foreground">{s["store_hours"]}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-[12px] uppercase tracking-[0.15em]">
              {s["instagram"] ? (
                <a className="text-brand" href={s["instagram"]} target="_blank" rel="noreferrer">
                  Instagram
                </a>
              ) : null}
              {s["tiktok"] ? (
                <a className="text-brand" href={s["tiktok"]} target="_blank" rel="noreferrer">
                  TikTok
                </a>
              ) : null}
              {s["facebook"] ? (
                <a className="text-brand" href={s["facebook"]} target="_blank" rel="noreferrer">
                  Facebook
                </a>
              ) : null}
            </div>
          </div>
          {s["map_embed"] ? (
            <iframe
              title="Auraluxe store location"
              src={s["map_embed"]}
              loading="lazy"
              className="h-72 w-full rounded-3xl border border-border"
            />
          ) : null}
        </div>
      </section>
    </SiteLayout>
  );
}
