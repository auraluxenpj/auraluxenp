import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart, useSettings } from "@/lib/store";
import { fetchCategories } from "@/lib/data";
import brandLogo from "@/assets/auraluxe-wordmark.png.asset.json";

const SHOP_LINKS = [
  { label: "New Arrivals", search: { sort: "newest" } as const },
  { label: "Sale", search: { category: "sale" } as const },
];
const PLAIN_LINKS = [
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
] as const;

export function Header() {
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });

  const activeCategories = categories.filter((c) => c.is_active);

  // Auto-hide the header when scrolling down, reveal when scrolling up
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
    <div
      className={`sticky top-3 z-30 transition-transform duration-300 motion-reduce:transition-none ${
        hidden && !open ? "-translate-y-[140%]" : ""
      }`}
    >
      <header className="glass flex items-center justify-between rounded-2xl px-5 py-4 sm:px-7">
        <Link to="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold tracking-[0.12em]">
            AURA<span className="text-brand">LUXE</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 text-[13px] uppercase tracking-[0.18em] text-foreground/70 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setShopOpen(true)}
            onMouseLeave={() => setShopOpen(false)}
          >
            <Link to="/shop" className="flex items-center gap-1 transition hover:text-brand">
              Shop <ChevronDown className="size-3.5" />
            </Link>
            {shopOpen && activeCategories.length > 0 ? (
              <div className="absolute left-1/2 top-full -translate-x-1/2 pt-3">
                <div className="glass-strong grid min-w-56 gap-1 rounded-2xl p-3">
                  <Link
                    to="/shop"
                    onClick={() => setShopOpen(false)}
                    className="rounded-xl px-4 py-2.5 text-[12px] uppercase tracking-[0.15em] transition hover:bg-secondary hover:text-brand"
                  >
                    All products
                  </Link>
                  {activeCategories.map((c) => (
                    <Link
                      key={c.id}
                      to="/shop"
                      search={{ category: c.slug }}
                      onClick={() => setShopOpen(false)}
                      className="rounded-xl px-4 py-2.5 text-[12px] uppercase tracking-[0.15em] transition hover:bg-secondary hover:text-brand"
                    >
                      {c.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          {SHOP_LINKS.map((item) => (
            <Link key={item.label} to="/shop" search={item.search} className="transition hover:text-brand">
              {item.label}
            </Link>
          ))}
          {PLAIN_LINKS.map((item) => (
            <Link key={item.label} to={item.to} className="transition hover:text-brand">
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/shop"
            aria-label="Search products"
            className="glass grid size-10 place-items-center rounded-full text-foreground/70 transition hover:text-brand"
          >
            <Search className="size-4" />
          </Link>
          <Link
            to="/cart"
            aria-label="Cart"
            className="glass relative grid size-10 place-items-center rounded-full text-foreground/70 transition hover:text-brand"
          >
            <ShoppingBag className="size-4" />
            {count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-brand text-[9px] font-medium text-primary-foreground">
                {count}
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="glass grid size-10 place-items-center rounded-full text-foreground/70 lg:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {open ? (
        <nav className="glass mt-3 flex flex-col gap-1 rounded-2xl p-3 lg:hidden">
          <Link
            to="/shop"
            onClick={() => setOpen(false)}
            className="rounded-xl px-4 py-3 text-[13px] uppercase tracking-[0.18em] text-foreground/75"
          >
            Shop all
          </Link>
          {activeCategories.map((c) => (
            <Link
              key={c.id}
              to="/shop"
              search={{ category: c.slug }}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 pl-7 text-[12px] uppercase tracking-[0.15em] text-muted-foreground"
            >
              {c.name}
            </Link>
          ))}
          {SHOP_LINKS.map((item) => (
            <Link
              key={item.label}
              to="/shop"
              search={item.search}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-[13px] uppercase tracking-[0.18em] text-foreground/75"
            >
              {item.label}
            </Link>
          ))}
          {PLAIN_LINKS.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-[13px] uppercase tracking-[0.18em] text-foreground/75"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
