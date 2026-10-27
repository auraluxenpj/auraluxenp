import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Auraluxe" },
      { name: "description", content: "Manage Auraluxe products and inventory." },
      { property: "og:title", content: "Admin — Auraluxe" },
      { property: "og:description", content: "Manage Auraluxe products and inventory." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    const { data: isPosUser } = await supabase.rpc("can_use_pos");
    return { isAdmin: !!data, isPosUser: !!isPosUser };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/categories", label: "Categories" },
  { to: "/admin/banners", label: "Banners" },
  { to: "/admin/inventory", label: "Inventory" },
  { to: "/admin/inventory-health", label: "Inventory Health" },
  { to: "/admin/pos", label: "POS Billing" },
  { to: "/admin/khata", label: "Customer Khata" },
  { to: "/admin/expenses", label: "Expenses" },
  { to: "/admin/purchases", label: "Purchases" },
  { to: "/admin/settings", label: "Settings" },
] as const;

function AdminLayout() {
  const { isAdmin, isPosUser, user } = Route.useRouteContext();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isPosPage = pathname === "/admin/pos" || pathname.startsWith("/admin/pos/");
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-5 py-4">
          <Link to="/" className="font-display text-xl font-semibold tracking-[0.12em]">
            AURA<span className="text-brand">LUXE</span>
          </Link>
          <nav className="flex w-full flex-wrap gap-1 text-sm sm:w-auto">
            {NAV.filter(n => isAdmin || (isPosUser && n.to === "/admin/pos")).map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/admin" }} className="rounded-full px-4 py-2 text-muted-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <Button variant="outline" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        {isAdmin || (isPosUser && isPosPage) ? (
          <Outlet />
        ) : (
          <div className="rounded-2xl border border-border p-8 text-center">
            <h1 className="font-display text-2xl">No admin access</h1>
            <p className="mt-2 text-sm text-muted-foreground">This account isn't a store admin.</p>
          </div>
        )}
      </main>
    </div>
  );
}
