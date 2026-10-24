import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useCart, useMoney, useSettings, whatsappLink } from "@/lib/store";

export function SiteLayout({ children }: { children: ReactNode }) {
  const { count, subtotal } = useCart();
  const money = useMoney();
  const s = useSettings();

  return (
    <>
      <div className="fixed inset-0 -z-10 bg-background" aria-hidden />
      <div className="fixed -left-24 -top-32 -z-10 h-96 w-96 rounded-full bg-brand/25 blur-3xl" aria-hidden />
      <div className="fixed -right-20 top-1/3 -z-10 h-[28rem] w-[28rem] rounded-full bg-accent/30 blur-3xl" aria-hidden />
      <div className="fixed bottom-0 left-1/3 -z-10 h-80 w-80 rounded-full bg-brand-deep/15 blur-3xl" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-5 pb-32 sm:px-8 md:pb-16">
        <Header />
        <main>{children}</main>
        <Footer />
      </div>

      {/* Small WhatsApp button, bottom-right (mobile) */}
      <a
        href={whatsappLink(s["whatsapp"] ?? "", "Hello Auraluxe! I'd like to ask about a piece.")}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-4 right-4 z-20 grid size-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:bg-brand md:hidden"
      >
        <MessageCircle className="size-5" />
      </a>

      {count > 0 ? (
        <div className="fixed inset-x-4 bottom-4 z-10 flex items-center justify-between gap-3 rounded-full glass-strong py-3 pl-5 pr-24 md:hidden">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Bag</p>
            <p className="truncate font-display text-base">
              {count} item{count > 1 ? "s" : ""} · {money(subtotal)}
            </p>
          </div>
          <Link
            to="/cart"
            className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-[12px] uppercase tracking-[0.15em] text-primary-foreground"
          >
            Checkout
          </Link>
        </div>
      ) : null}
    </>
  );
}
