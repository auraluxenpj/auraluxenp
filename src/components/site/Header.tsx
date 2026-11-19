import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useCart, useSettings } from "@/lib/store";
import { fetchCategories } from "@/lib/data";

const QUICK_LINKS = [
  { label: "New In", search: { sort: "newest" } as const },
  { label: "Best Sellers", search: { sort: "popular" } as const },
  { label: "Sale", search: { category: "sale" } as const },
];
const PLAIN_LINKS = [
  { label: "Our Story", to: "/about" },
  { label: "Visit Us", to: "/contact" },
] as const;

export function Header() {
  const { count } = useCart();
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const activeCategories = categories.filter((c) => c.is_active);

  return (
    <>
      <div className="auraluxe-announcement -mx-5 mb-0 flex min-h-8 items-center justify-center px-3 text-center sm:-mx-8">
        <span>Complimentary delivery on orders above NPR 3,000</span>
        <span className="hidden sm:inline">·</span>
        <span className="hidden sm:inline">Thoughtfully curated ethnic wear, from Nepalgunj</span>
      </div>
      <div className="auraluxe-header-wrap sticky top-0 z-40 -mx-5 px-5 sm:-mx-8 sm:px-8">
        <header className="auraluxe-header relative flex min-h-[76px] items-center justify-between gap-3">
          <Link to="/" className="auraluxe-wordmark flex shrink-0 flex-col leading-none" aria-label="Auraluxe home">
            <span>AURALUXE</span>
            <small>THE ART OF EVERYDAY ELEGANCE</small>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex" aria-label="Main navigation">
            <div className="auraluxe-nav-group relative" onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
              <Link to="/shop" className="auraluxe-nav-link flex items-center gap-1.5">Shop <ChevronDown className="size-3" /></Link>
              {shopOpen ? (
                <div className="auraluxe-mega absolute left-1/2 top-full z-50 w-[min(760px,85vw)] -translate-x-1/2 pt-4">
                  <div className="grid grid-cols-[1.2fr_2fr] gap-8 rounded-sm border border-stone-200 bg-[#fffdf9] p-8 shadow-2xl">
                    <div className="border-r border-stone-200 pr-7">
                      <p className="auraluxe-kicker">Explore Auraluxe</p>
                      <h3 className="mt-3 font-display text-3xl text-stone-800">Find your next favourite.</h3>
                      <p className="mt-3 text-sm leading-6 text-stone-500">Considered silhouettes and thoughtful details for every occasion.</p>
                      <Link to="/shop" onClick={() => setShopOpen(false)} className="mt-5 inline-block border-b border-[#762b3b] pb-1 text-xs uppercase tracking-[.18em] text-[#762b3b]">Shop everything →</Link>
                    </div>
                    <div>
                      <p className="auraluxe-kicker mb-4">Shop by category</p>
                      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
                        {activeCategories.map((c) => (
                          <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={() => setShopOpen(false)} className="auraluxe-mega-link">{c.name}</Link>
                        ))}
                        {["Kurti Sets", "Sarees", "Dresses", "Bags & Accessories"].map((name) => (
                          <Link key={name} to="/shop" onClick={() => setShopOpen(false)} className="auraluxe-mega-link">{name}</Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            {QUICK_LINKS.map((item) => <Link key={item.label} to="/shop" search={item.search} className="auraluxe-nav-link">{item.label}</Link>)}
            {PLAIN_LINKS.map((item) => <Link key={item.label} to={item.to} className="auraluxe-nav-link">{item.label}</Link>)}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link to="/shop" aria-label="Search products" className="auraluxe-icon-link"><Search className="size-[18px]" /></Link>
            <Link to="/auth" aria-label="My account" className="auraluxe-icon-link hidden sm:grid"><UserRound className="size-[18px]" /></Link>
            <Link to="/cart" aria-label={`Shopping bag, ${count} items`} className="auraluxe-icon-link relative">
              <ShoppingBag className="size-[18px]" />
              {count > 0 ? <span className="absolute -right-1 -top-1 grid size-[17px] place-items-center rounded-full bg-[#762b3b] text-[9px] text-white">{count}</span> : null}
            </Link>
            <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className="auraluxe-icon-link xl:hidden">
              {open ? <X className="size-[18px]" /> : <Menu className="size-[18px]" />}
            </button>
          </div>
        </header>
        {open ? (
          <nav className="auraluxe-mobile-nav xl:hidden" aria-label="Mobile navigation">
            <Link to="/shop" onClick={() => setOpen(false)}>Shop all</Link>
            {QUICK_LINKS.map((item) => <Link key={item.label} to="/shop" search={item.search} onClick={() => setOpen(false)}>{item.label}</Link>)}
            {activeCategories.map((c) => <Link key={c.id} to="/shop" search={{ category: c.slug }} onClick={() => setOpen(false)}>{c.name}</Link>)}
            <Link to="/auth" onClick={() => setOpen(false)}>My account</Link>
            {PLAIN_LINKS.map((item) => <Link key={item.label} to={item.to} onClick={() => setOpen(false)}>{item.label}</Link>)}
          </nav>
        ) : null}
      </div>
    </>
  );
}
