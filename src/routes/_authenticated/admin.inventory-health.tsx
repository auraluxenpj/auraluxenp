import { createFileRoute, useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { RefreshCw, Search, ShieldCheck, AlertTriangle, Copy, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inventoryHealthQuery } from '@/lib/inventory-health.query';
import type { HealthProduct } from '@/lib/inventory-health';

type HealthView = 'stock' | 'sku' | 'price';
export const Route = createFileRoute('/_authenticated/admin/inventory-health')({
  validateSearch: (search: Record<string, unknown>): { view: HealthView; q: string } => ({
    view: search['view'] === 'sku' || search['view'] === 'price' ? search['view'] : 'stock',
    q: typeof search['q'] === 'string' ? search['q'] : '',
  }),
  loader: async ({ context }) => {
    if (!context.isAdmin) throw new Error('Administrator access required');
    await context.queryClient.ensureQueryData(inventoryHealthQuery(context.user.id));
  },
  head: () => ({ meta: [
    { title: 'Inventory Health — Auraluxe Admin' },
    { name: 'description', content: 'Administrator review of Auraluxe stock mismatches, duplicate SKUs and published zero-price products.' },
    { property: 'og:title', content: 'Inventory Health — Auraluxe Admin' },
    { property: 'og:description', content: 'Read-only inventory exception review for Auraluxe administrators.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
    { name: 'robots', content: 'noindex,nofollow' },
  ] }),
  component: InventoryHealthPage,
  pendingComponent: () => <p role="status" className="py-12 text-muted-foreground">Checking inventory…</p>,
  errorComponent: HealthError,
  notFoundComponent: () => <p>Inventory health page not found.</p>,
});

function HealthError({ error }: ErrorComponentProps) {
  const router = useRouter();
  return <div role="alert" className="space-y-4 py-8"><h1 className="font-display text-3xl">Inventory check unavailable</h1><p>{error instanceof Error ? error.message : 'Please retry the inventory check.'}</p><Button variant="outline" onClick={() => router.invalidate()}><RefreshCw />Retry</Button></div>;
}

function ProductIdentity({ product }: { product: HealthProduct }) {
  return <div className="min-w-0"><p className="font-medium break-words">{product.name}</p><p className="text-sm text-muted-foreground">{product.sku || 'No SKU'} · {product.is_published ? 'Published' : 'Draft'}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{product.id}</p></div>;
}

function InventoryHealthPage() {
  const { user } = Route.useRouteContext();
  const { data, refetch, isFetching, error } = useSuspenseQuery(inventoryHealthQuery(user.id));
  const { view, q } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const matches = (p: HealthProduct) => `${p.name} ${p.sku ?? ''} ${p.id}`.toLowerCase().includes(q.trim().toLowerCase());
  const stock = data.mismatches.filter(row => matches(row.product));
  const skus = data.duplicateSkus.filter(group => group.some(matches));
  const prices = data.zeroPrice.filter(matches);
  const visibleCount = view === 'stock' ? stock.length : view === 'sku' ? skus.length : prices.length;
  return <div className="space-y-7">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" />Administrator review · Read-only</div><h1 className="font-display text-4xl">Inventory health</h1><p className="mt-2 text-sm text-muted-foreground">{data.productCount} products checked · {data.flaggedCount} products flagged</p></div>
      <div className="space-y-2"><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? 'motion-safe:animate-spin' : ''} />{isFetching ? 'Checking…' : 'Refresh'}</Button><p className="text-xs text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleString()}</p></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Refresh failed. Previous results are shown. {error.message}</p>}
    <div className="grid grid-cols-1 gap-4 border-y border-border py-5 sm:grid-cols-3">
      {[{ icon: AlertTriangle, label: 'Size-stock mismatches', count: data.mismatches.length }, { icon: Copy, label: 'Duplicate SKU groups', count: data.duplicateSkus.length }, { icon: CircleDollarSign, label: 'Published zero-price products', count: data.zeroPrice.length }].map(stat => <div key={stat.label} className="flex items-center gap-4"><stat.icon className="size-5 shrink-0 text-brand" /><div><p className="text-3xl font-medium tabular-nums">{stat.count}</p><p className="text-sm text-muted-foreground">{stat.label}</p></div></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-4">
      <Tabs value={view} onValueChange={value => void navigate({ search: prev => ({ ...prev, view: value as HealthView }) })}><TabsList className="h-auto flex-wrap justify-start"><TabsTrigger value="stock">Size stock</TabsTrigger><TabsTrigger value="sku">Duplicate SKUs</TabsTrigger><TabsTrigger value="price">Zero price</TabsTrigger></TabsList></Tabs>
      <label className="flex w-full items-center gap-2 rounded-md border border-input bg-background px-3 sm:w-80"><Search className="size-4 shrink-0 text-muted-foreground" /><input aria-label="Search flagged products" placeholder="Search name, SKU or product ID" className="h-10 min-w-0 w-full bg-transparent text-sm outline-none" value={q} onChange={e => void navigate({ search: prev => ({ ...prev, q: e.target.value }), replace: true })} /></label>
    </div>
    <section aria-label="Inventory exceptions" className="space-y-3">
      <h2 className="font-display text-2xl">{view === 'stock' ? 'Stock reconciliation' : view === 'sku' ? 'Shared SKU identifiers' : 'Published with no price'} <span className="text-lg text-muted-foreground">({visibleCount})</span></h2>
      {visibleCount === 0 && <div className="border-y border-border py-10 text-center"><ShieldCheck className="mx-auto mb-3 size-6 text-brand" /><p>{q ? 'No flagged products match your search.' : 'No exceptions found in this category.'}</p></div>}
      {view === 'stock' && stock.map(row => <article key={row.product.id} className="rounded-lg border border-border bg-card p-4"><div className="grid gap-4 sm:grid-cols-[1fr_auto]"><ProductIdentity product={row.product} /><div className="flex gap-6 text-sm"><div><p className="text-muted-foreground">Product stock</p><p className="text-2xl tabular-nums">{row.product.stock}</p></div><div><p className="text-muted-foreground">Size total</p><p className="text-2xl tabular-nums text-destructive">{row.sizeTotal}</p></div></div></div><p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">{row.sizes.map(s => `${s.size}: ${s.stock}`).join(' · ')}</p></article>)}
      {view === 'sku' && skus.map(group => <article key={group[0]?.id} className="rounded-lg border border-border bg-card p-4"><h3 className="mb-4 font-sans font-medium">{group[0]?.sku?.trim()} <span className="ml-2 text-sm text-muted-foreground">{group.length} products</span></h3><div className="divide-y divide-border">{group.map(product => <div key={product.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[1fr_auto]"><ProductIdentity product={product} /><p className="text-sm text-muted-foreground">Stock {product.stock}</p></div>)}</div></article>)}
      {view === 'price' && prices.map(product => <article key={product.id} className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[1fr_auto]"><ProductIdentity product={product} /><div className="text-sm"><p className="font-medium text-destructive">Price 0</p><p className="text-muted-foreground">Stock {product.stock}</p></div></article>)}
    </section>
  </div>;
}