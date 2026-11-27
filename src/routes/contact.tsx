import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useCart, useSettings, whatsappLink, whatsappProductMessage } from "@/lib/store";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Auraluxe — Nepalgunj Store" },
      {
        name: "description",
        content:
          "Visit Auraluxe, a women's fashion store on Rani Talab Road near Tribhuvan Chowk, Nepalgunj. Find our address, opening hours and contact details.",
      },
      { property: "og:title", content: "Contact Auraluxe — Nepalgunj Store" },
      {
        property: "og:description",
        content: "Call, WhatsApp, email or visit the Auraluxe store in Nepalgunj.",
      },
    ],
    links: [{ rel: "canonical", href: "https://www.auraluxe.com.np/contact" }],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(100),
  phone: z.string().trim().min(7, "Please enter a valid phone number").max(20),
  message: z.string().trim().min(1, "Please write a message").max(1000),
});

function Contact() {
  const s = useSettings();
  const { items } = useCart();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const mapQuery = s["address"]?.trim();
  const mapEmbedUrl = mapQuery
    ? `https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`
    : s["map_embed"];
  const directionsUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : null;

  const field =
    "w-full rounded-2xl border border-border bg-input px-5 py-3 text-sm outline-none placeholder:text-muted-foreground";

  return (
    <SiteLayout>
      <div className="mt-10">
        <p className="eyebrow">We'd love to hear from you</p>
        <h1 className="mt-2 font-display text-5xl">Visit Auraluxe in Nepalgunj</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
          Find our ladies' fashion store near Tribhuvan Chowk. Visit us to explore kurtis, sarees, dresses and accessories, or contact the team before your visit.
        </p>
      </div>

      <section className="mt-6 max-w-3xl">
        <h2 className="font-display text-2xl">Product and store enquiries</h2>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Contact Auraluxe about product details, available sizes or colours, current prices, online orders and visiting the Nepalgunj store. If you have a particular item in mind, share its product name or website link so the team can identify it more easily.
        </p>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Store address, contact information and opening hours are shown on this page. Use the directions link for navigation, or send a message through the form to continue in WhatsApp.
        </p>
      </section>

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
                whatsappProductMessage(`Hello Auraluxe!\nName: ${parsed.data.name}\nPhone: ${parsed.data.phone}\n\n${parsed.data.message}`, items),
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
            {directionsUrl ? (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-full bg-primary px-5 py-3 text-[11px] uppercase tracking-[0.15em] text-primary-foreground"
              >
                Get directions on Google Maps
              </a>
            ) : null}
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
          {mapEmbedUrl ? (
            <iframe
              title="Auraluxe store location near Tribhuvan Chowk, Nepalgunj"
              src={mapEmbedUrl}
              loading="lazy"
              className="h-72 w-full rounded-3xl border border-border"
            />
          ) : null}
        </div>
      </section>
    </SiteLayout>
  );
}
