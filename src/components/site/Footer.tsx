import { Link } from "@tanstack/react-router";
import { useSettings } from "@/lib/store";
import brandLogo from "@/assets/auraluxe-wordmark.png.asset.json";

export function Footer() {
  const s = useSettings();
  return (
    <footer className="glass mt-14 rounded-3xl p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <span className="font-display text-2xl font-semibold tracking-[0.12em]">
            AURA<span className="text-brand">LUXE</span>
          </span>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {s["tagline"] ?? "Ladies' fashion atelier"} · {s["address"]}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {s["phone"]} · {s["email"]}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{s["store_hours"]}</p>
        </div>
        <div className="flex flex-wrap gap-x-10 gap-y-2 text-[12px] uppercase tracking-[0.15em] text-foreground/60">
          <Link className="hover:text-brand" to="/stylist">
            AI Stylist
          </Link>
          <Link className="hover:text-brand" to="/track">
            Track Order
          </Link>
          <Link className="hover:text-brand" to="/contact">
            Contact
          </Link>
          <Link className="hover:text-brand" to="/pages/$slug" params={{ slug: "shipping-policy" }}>
            Shipping
          </Link>
          <Link className="hover:text-brand" to="/pages/$slug" params={{ slug: "return-policy" }}>
            Returns
          </Link>
          <Link className="hover:text-brand" to="/pages/$slug" params={{ slug: "faq" }}>
            FAQ
          </Link>
          <Link className="hover:text-brand" to="/pages/$slug" params={{ slug: "privacy-policy" }}>
            Privacy
          </Link>
          <Link className="hover:text-brand" to="/pages/$slug" params={{ slug: "terms" }}>
            Terms
          </Link>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          © {new Date().getFullYear()} Auraluxe · Nepalgunj, Nepal
        </p>
        <div className="flex gap-5 text-[12px] uppercase tracking-[0.15em] text-foreground/60">
          {s["instagram"] ? (
            <a className="hover:text-brand" href={s["instagram"]} target="_blank" rel="noreferrer">
              Instagram
            </a>
          ) : null}
          {s["tiktok"] ? (
            <a className="hover:text-brand" href={s["tiktok"]} target="_blank" rel="noreferrer">
              TikTok
            </a>
          ) : null}
          {s["facebook"] ? (
            <a className="hover:text-brand" href={s["facebook"]} target="_blank" rel="noreferrer">
              Facebook
            </a>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
