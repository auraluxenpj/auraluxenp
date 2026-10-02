import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Auraluxe" },
      { name: "description", content: "Manage Auraluxe products and inventory." },
      { property: "og:title", content: "Admin — Auraluxe" },
      { property: "og:description", content: "Manage Auraluxe products and inventory." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async ({ context }) => {
    const { data } = await supabase.rpc("has_role", { _user_id: context.user.id, _role: "admin" });
    return { isAdmin: !!data };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/inventory", label: "Inventory" },
] as const;

function AdminLayout() {
  const { isAdmin, user } = Route.useRouteContext();
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
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: n.to === "/admin" }} className="rounded-full px-4 py-2 text-muted-foreground" activeProps={{ className: "bg-secondary text-foreground" }}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{user.email}</span>
            <button onClick={signOut} className="rounded-full border border-border px-4 py-2">Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">
        {isAdmin ? (
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
