import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart } from "@/lib/store";
import { fetchCategories } from "@/lib/data";
import { useI18n } from "@/lib/i18n";

const SHOP_LINKS = [
  { key: "newArrivals", search: { sort: "newest" } as const },
  { key: "sale", search: { category: "sale" } as const },
];
const PLAIN_LINKS = [
  { key: "about", to: "/about" },
  { key: "contact", to: "/contact" },
] as const;

export function Header() {
  const { count } = useCart();
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const activeCategories = categories.filter((c) => c.is_active);

  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setHidden(y > last && y > 120);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className={`sticky top-3 z-30 transition-transform duration-300 motion-reduce:transition-none ${hidden && !open ? "-translate-y-[140%]" : ""}`}>
      <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 sm:px-7 sm:py-4">
        <Link to="/" className="flex items-baseline gap-1" aria-label="Auraluxe home">
          <span className="font-display text-2xl font-semibold tracking-[0.12em]">AURA<span className="text-brand">LUXE</span></span>
        </Link>

        <nav className="hidden items-center gap-6 text-[12px] uppercase tracking-[0.15em] text-foreground/70 lg:flex">
          <div className="relative" onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
            <Link to="/shop" className="flex items-center gap-1 transition hover:text-brand">{t("shop")} <ChevronDown className="size-3.5" /></Link>
            {shopOpen && activeCategories.length > 0 ? (
              <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
                <div className="glass-strong grid min-w-56 gap-1 rounded-2xl p-3">
                  <Link to="/shop" onClick={() => setShopOpen(false)} className="rounded-xl px-4 py-2.5 text-[12px] uppercase tracking-[0.15em] transition hover:bg-secondary hover:text-brand">{t("shopAll")}</Link>
                  {activeCategories.map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={() => setShopOpen(false)} className="rounded-xl px-4 py-2.5 text-[12px] transition hover:bg-secondary hover:text-brand">{c.name}</Link>)}
                </div>
              </div>
            ) : null}
          </div>
          {SHOP_LINKS.map((item) => <Link key={item.key} to="/shop" search={item.search} className="transition hover:text-brand">{t(item.key)}</Link>)}
          {PLAIN_LINKS.map((item) => <Link key={item.key} to={item.to} className="transition hover:text-brand">{t(item.key)}</Link>)}
        </nav>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-brand/20 bg-secondary/70 p-1 text-[11px] font-semibold tracking-wide" aria-label={t("language")}>
            <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"} className={`rounded-full px-2.5 py-1.5 transition ${language === "en" ? "bg-primary text-primary-foreground" : "text-foreground/65 hover:text-brand"}`}>EN</button>
            <button type="button" onClick={() => setLanguage("ne")} aria-pressed={language === "ne"} className={`rounded-full px-2.5 py-1.5 transition ${language === "ne" ? "bg-primary text-primary-foreground" : "text-foreground/65 hover:text-brand"}`}>नेपाली</button>
          </div>
          <Link to="/shop" aria-label={t("search")} className="glass grid size-10 place-items-center rounded-full text-foreground/70 transition hover:text-brand"><Search className="size-4" /></Link>
          <Link to="/cart" aria-label={t("cart")} className="glass relative grid size-10 place-items-center rounded-full text-foreground/70 transition hover:text-brand">
            <ShoppingBag className="size-4" />
            {count > 0 ? <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-medium text-primary-foreground">{count}</span> : null}
          </Link>
          <button type="button" aria-label={t("menu")} aria-expanded={open} onClick={() => setOpen((v) => !v)} className="glass grid size-10 place-items-center rounded-full text-foreground/70 lg:hidden">{open ? <X className="size-4" /> : <Menu className="size-4" />}</button>
        </div>
      </header>

      {open ? (
        <nav className="glass mt-3 flex flex-col gap-1 rounded-2xl p-3 lg:hidden">
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("language")}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setLanguage("en")} className={`rounded-full px-3 py-1.5 text-xs ${language === "en" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>EN</button>
              <button type="button" onClick={() => setLanguage("ne")} className={`rounded-full px-3 py-1.5 text-xs ${language === "ne" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>नेपाली</button>
            </div>
          </div>
          <Link to="/shop" onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[13px] text-foreground/75">{t("shopAll")}</Link>
          {activeCategories.map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 pl-7 text-[12px] text-muted-foreground">{c.name}</Link>)}
          {SHOP_LINKS.map((item) => <Link key={item.key} to="/shop" search={item.search} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[13px] text-foreground/75">{t(item.key)}</Link>)}
          {PLAIN_LINKS.map((item) => <Link key={item.key} to={item.to} onClick={() => setOpen(false)} className="rounded-xl px-4 py-3 text-[13px] text-foreground/75">{t(item.key)}</Link>)}
        </nav>
      ) : null}
    </div>
  );
}
