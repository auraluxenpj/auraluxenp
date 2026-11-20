import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X, ArrowUpRight } from "lucide-react";
import { useCart } from "@/lib/store";
import { fetchCategories } from "@/lib/data";
import { categoryLabel, useLanguage } from "@/lib/i18n";

const QUICK_LINKS = [
  { label: "New Arrivals", search: { sort: "newest" } as const },
  { label: "Best Sellers", search: { sort: "bestsellers" } as const },
  { label: "Sale", search: { category: "sale" } as const },
];
const STORY_LINKS = [
  { label: "Our Story", to: "/about" },
  { label: "Visit Our Store", to: "/contact" },
] as const;
const OCCASION_LINKS = [
  { label: "Festive Edit", query: "festive" },
  { label: "Wedding Guest", query: "wedding" },
  { label: "Everyday Elegance", query: "everyday" },
  { label: "Office Wear", query: "office" },
  { label: "Party Wear", query: "party" },
];

export function Header() {
  const { count } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [mobileShopOpen, setMobileShopOpen] = useState(false);
  const [mobileOccasionOpen, setMobileOccasionOpen] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const activeCategories = categories.filter((c) => c.is_active);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const q = searchTerm.trim();
    setSearchOpen(false);
    setMobileOpen(false);
    if (q) navigate({ to: "/shop", search: { q } });
  };

  const closeMenus = () => {
    setActiveMenu(null);
    setMobileOpen(false);
    setMobileShopOpen(false);
    setMobileOccasionOpen(false);
    setSearchOpen(false);
  };

  // Keep the mobile search and navigation panels mutually exclusive, and let
  // keyboard users dismiss either panel without needing to find its close control.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setActiveMenu(null);
      setMobileOpen(false);
      setMobileShopOpen(false);
      setMobileOccasionOpen(false);
      setSearchOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <div className="auraluxe-announcement -mx-5 mb-0 flex min-h-8 items-center justify-center px-3 text-center sm:-mx-8 lg:-mx-12 2xl:-mx-16">
        <span>{t("delivery")}</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">{t("curatedNepalgunj")}</span>
      </div>
      <div className="auraluxe-header-wrap sticky top-0 z-40 -mx-5 px-5 sm:-mx-8 sm:px-8 lg:-mx-12 lg:px-12 2xl:-mx-16 2xl:px-16">
        <header className="auraluxe-header relative flex min-h-[76px] items-center justify-between gap-3">
          <Link to="/" onClick={closeMenus} className="auraluxe-wordmark flex shrink-0 flex-col leading-none" aria-label="Auraluxe home">
            <span>AURALUXE</span>
            <small>THE ART OF EVERYDAY ELEGANCE</small>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex" aria-label="Main navigation" onMouseLeave={() => setActiveMenu(null)}>
            <div className="auraluxe-nav-group relative" onMouseEnter={() => setActiveMenu("women")}>
              <button type="button" className="auraluxe-nav-link flex items-center gap-1.5" aria-expanded={activeMenu === "women"} onClick={() => setActiveMenu(activeMenu === "women" ? null : "women")}>
                {t("women")} <ChevronDown className="size-3" />
              </button>
            </div>
            <Link to="/shop" search={{ sort: "newest" }} className="auraluxe-nav-link">{t("newIn")}</Link>
            <div className="auraluxe-nav-group relative" onMouseEnter={() => setActiveMenu("occasion")}>
              <button type="button" className="auraluxe-nav-link flex items-center gap-1.5" aria-expanded={activeMenu === "occasion"} onClick={() => setActiveMenu(activeMenu === "occasion" ? null : "occasion")}>
                {t("collections")} <ChevronDown className="size-3" />
              </button>
            </div>
            <Link to="/shop" search={{ category: "sale" }} className="auraluxe-nav-link">{t("sale")}</Link>
            <Link to="/about" className="auraluxe-nav-link">{t("ourStory")}</Link>

            {activeMenu ? (
              <div className="auraluxe-mega absolute left-1/2 top-full z-50 w-[min(1080px,92vw)] -translate-x-1/2 pt-3" onMouseEnter={() => setActiveMenu(activeMenu)}>
                <div className="grid grid-cols-[1fr_2fr_1.15fr] gap-8 border border-[#e9e1d8] bg-[#fffdf9] p-8 shadow-2xl">
                  <div className="border-r border-[#e9e1d8] pr-7">
                    <p className="auraluxe-kicker">{activeMenu === "women" ? t("theWardrobe") : t("curatedMoments")}</p>
                    <h3 className="mt-3 font-display text-3xl leading-tight text-[#422d2a]">{activeMenu === "women" ? t("signatureStyle") : t("occasionDress")}</h3>
                    <p className="mt-3 text-sm leading-6 text-stone-500">{t("thoughtfulPieces")}</p>
                    <Link to="/shop" onClick={closeMenus} className="mt-5 inline-flex items-center gap-2 border-b border-[#762b3b] pb-1 text-xs uppercase tracking-[.18em] text-[#762b3b]">{t("exploreAll")} <ArrowUpRight className="size-3" /></Link>
                  </div>
                  <div>
                    <p className="auraluxe-kicker mb-4">{activeMenu === "women" ? t("shopCategory") : t("shopEdit")}</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {(activeMenu === "women" ? activeCategories : OCCASION_LINKS.map((item) => ({ id: item.label, name: item.label, slug: item.query }))).map((c) => (
                        <Link key={c.id} to="/shop" search={activeMenu === "women" ? { category: c.slug } : { q: c.slug }} onClick={closeMenus} className="auraluxe-mega-link">{categoryLabel(c.slug, c.name, language)}</Link>
                      ))}
                      {activeMenu === "women" ? ["Kurti Sets", "Short Kurtis", "Sarees", "Dresses", "Bags & Accessories"].map((name) => (
                        <Link key={name} to="/shop" onClick={closeMenus} className="auraluxe-mega-link">{name}</Link>
                      )) : null}
                    </div>
                  </div>
                  <div className="relative min-h-[220px] overflow-hidden bg-[#efe5dc]">
                    <img src="https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=85" alt="Auraluxe ethnic fashion collection" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#2d1918]/70 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <p className="text-[9px] uppercase tracking-[.22em]">Auraluxe edit</p>
                      <p className="mt-2 font-display text-2xl">Made for your moments</p>
                      <Link to="/shop" onClick={closeMenus} className="mt-3 inline-block border-b border-white/80 pb-1 text-[10px] uppercase tracking-[.18em]">Discover now</Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div className="auraluxe-language-switch" role="group" aria-label={t("language")}>
              <button type="button" onClick={() => setLanguage("en")} aria-pressed={language === "en"}>EN</button>
              <span aria-hidden="true">/</span>
              <button type="button" onClick={() => setLanguage("ne")} aria-pressed={language === "ne"}>ने</button>
            </div>
            <button type="button" aria-label={t("searchProducts")} aria-expanded={searchOpen} onClick={() => { const next = !searchOpen; setSearchOpen(next); if (next) { setMobileOpen(false); setActiveMenu(null); setMobileShopOpen(false); setMobileOccasionOpen(false); } }} className="auraluxe-icon-link"><Search className="size-[18px]" /></button>
            <Link to="/auth" aria-label={t("myAccount")} className="auraluxe-icon-link hidden sm:grid"><UserRound className="size-[18px]" /></Link>
            <Link to="/cart" aria-label={`${t("shoppingBag")}, ${count}`} className="auraluxe-icon-link relative">
              <ShoppingBag className="size-[18px]" />
              {count > 0 ? <span className="absolute -right-1 -top-1 grid size-[17px] place-items-center rounded-full bg-[#762b3b] text-[9px] text-white">{count}</span> : null}
            </Link>
            <button type="button" aria-label="Menu" aria-expanded={mobileOpen} onClick={() => { const next = !mobileOpen; setMobileOpen(next); if (next) { setSearchOpen(false); setActiveMenu(null); } }} className="auraluxe-icon-link xl:hidden">
              {mobileOpen ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
            </button>
          </div>
        </header>

        {searchOpen ? (
          <form onSubmit={submitSearch} className="auraluxe-search-panel flex items-center gap-3 border-t border-[#eee5dd] py-4">
            <Search className="size-4 shrink-0 text-[#8b6a5e]" />
            <input autoFocus value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={t("searchPlaceholder")} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400" aria-label="Search products" />
            <button type="submit" className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#762b3b]">{t("search")}</button>
            <button type="button" aria-label="Close search" onClick={() => setSearchOpen(false)} className="auraluxe-icon-link"><X className="size-4" /></button>
          </form>
        ) : null}

        {mobileOpen ? (
          <nav className="auraluxe-mobile-nav xl:hidden" aria-label="Mobile navigation">
            <button type="button" onClick={() => setMobileShopOpen((v) => !v)} aria-expanded={mobileShopOpen}>{t("shopCategory")} <ChevronDown className={`size-4 transition ${mobileShopOpen ? "rotate-180" : ""}`} /></button>
            {mobileShopOpen ? activeCategories.map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={closeMenus}>{c.name}</Link>) : null}
            {QUICK_LINKS.map((item) => <Link key={item.label} to="/shop" search={item.search} onClick={closeMenus}>{item.label}</Link>)}
            <button type="button" onClick={() => setMobileOccasionOpen((v) => !v)} aria-expanded={mobileOccasionOpen}>{t("shopOccasion")} <ChevronDown className={`size-4 transition ${mobileOccasionOpen ? "rotate-180" : ""}`} /></button>
            {mobileOccasionOpen ? OCCASION_LINKS.map((item) => <Link key={item.label} to="/shop" search={{ q: item.query }} onClick={closeMenus}>{item.label}</Link>) : null}
            <Link to="/auth" onClick={closeMenus}>{t("myAccount")}</Link>
            {STORY_LINKS.map((item) => <Link key={item.label} to={item.to} onClick={closeMenus}>{item.label}</Link>)}
          </nav>
        ) : null}
      </div>
    </>
  );
}
