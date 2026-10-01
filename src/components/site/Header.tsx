import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Search, ShoppingBag, X } from "lucide-react";
import { useCart, useSettings } from "@/lib/store";

const NAV = [
  { label: "Shop", to: "/shop" },
  { label: "New In", to: "/shop", search: { sort: "newest" } as const },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export function Header() {
  const { count } = useCart();
  const settings = useSettings();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative z-30">
      {settings["announcement"] ? (
        <div className="glass mt-5 flex items-center justify-center gap-3 rounded-full px-5 py-2 text-center text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span className="truncate">{settings["announcement"]}</span>
        </div>
      ) : null}

      <header className="glass mt-6 flex items-center justify-between rounded-2xl px-5 py-4 sm:px-7">
        <Link to="/" className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-semibold tracking-[0.12em]">
            AURA<span className="text-brand">LUXE</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-[13px] uppercase tracking-[0.18em] text-foreground/70 md:flex">
          {NAV.map((item) => (
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
            onClick={() => setOpen((v) => !v)}
            className="glass grid size-10 place-items-center rounded-full text-foreground/70 md:hidden"
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </header>

      {open ? (
        <nav className="glass mt-3 flex flex-col gap-1 rounded-2xl p-3 md:hidden">
          {NAV.map((item) => (
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
