import { createFileRoute, useNavigate, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useRef, useState } from 'react';
import { RefreshCw, Search, ShieldCheck, AlertTriangle, Copy, CircleDollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { inventoryHealthQuery } from '@/lib/inventory-health.query';
import { registerAuraluxeStockBaselines } from '@/lib/bizsathi-stock-baseline.functions';
import type { HealthProduct } from '@/lib/inventory-health';

type HealthView = 'stock' | 'sku' | 'price';
type BaselineRow = { sku: string; quantity: number };

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
    { property: 'og:description', content: 'Inventory exception review and approval-gated physical stock baseline registration.' },
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

function parseCsvRecords(source: string): string[][] {
  const input = source.replace(/^\uFEFF/, '');
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"' && quoted && input[i + 1] === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      record.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      record.push(field);
      if (record.some((cell) => cell.trim() !== '')) records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  record.push(field);
  if (record.some((cell) => cell.trim() !== '')) records.push(record);
  return records;
}

function BaselineImport({ onComplete }: { onComplete: () => void }) {
  const register = useServerFn(registerAuraluxeStockBaselines);
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<BaselineRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [status, setStatus] = useState('');
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);

  async function loadFile(file?: File) {
    setRows([]);
    setApproved(false);
    setStatus('');
    if (!file) return;
    try {
      const records = parseCsvRecords(await file.text());
      const headers = records[0]?.map((cell) => cell.trim().toLowerCase()) ?? [];
      const skuIndex = headers.indexOf('sku');
      const qtyIndex = headers.indexOf('qty');
      if (skuIndex < 0 || qtyIndex < 0) throw new Error('CSV must contain SKU and qty columns');
      const parsed = records.slice(1).map((record, index) => {
        const sku = (record[skuIndex] ?? '').trim();
        const rawQuantity = (record[qtyIndex] ?? '').trim();
        if (!sku || !/^\d+$/.test(rawQuantity)) throw new Error(`Invalid SKU or whole-unit qty on CSV row ${index + 2}`);
        return { sku, quantity: Number(rawQuantity) };
      });
      const unique = new Set(parsed.map((row) => row.sku.toLowerCase()));
      const quantityTotal = parsed.reduce((sum, row) => sum + row.quantity, 0);
      if (parsed.length !== 395 || unique.size !== 395 || quantityTotal !== 1705) {
        throw new Error(`Expected the verified 395-SKU / 1,705-unit count sheet; found ${parsed.length} rows, ${unique.size} unique SKUs and ${quantityTotal} units`);
      }
      setRows(parsed);
      setFileName(file.name);
      setStatus('CSV validated. No stock has been written yet.');
    } catch (error) {
      setFileName(file.name);
      setStatus(error instanceof Error ? error.message : 'Could not read this CSV');
    }
  }

  async function registerAll() {
    if (rows.length !== 395 || !approved || busy) return;
    setBusy(true);
    setStatus('Starting safe 10-SKU registration batches…');
    let processed = 0;
    let duplicates = 0;
    const totalBatches = 40;
    try {
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
        const result = await register({ data: { rows, batchIndex } });
        processed += result.processed;
        duplicates += result.duplicates;
        if (!result.ok) {
          setStatus(`Paused in batch ${batchIndex + 1}/${totalBatches} at SKU ${result.failedSku}. ${processed} baselines processed (${duplicates} already registered). Error: ${result.error}. Retry the same approved file to safely resume; identical baselines are idempotent.`);
          return;
        }
        setStatus(`Registering batch ${batchIndex + 1}/${totalBatches}… ${processed}/395 processed; ${duplicates} already registered.`);
      }
      setStatus(`Completed: ${processed} baselines processed; ${duplicates} were already identical. Website stock sync is still OFF.`);
      onComplete();
    } catch (error) {
      setStatus(`Registration paused after ${processed}/395 processed: ${error instanceof Error ? error.message : 'Unknown error'}. Retry the same approved file; previously registered identical baselines will be safely skipped. No stock-sync switch was enabled.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div>
        <h2 className="font-display text-2xl">Physical stock baseline</h2>
        <p className="mt-1 text-sm text-muted-foreground">Register the owner-approved Aura Final count for 25 November 2026. This writes verified quantities to Auraluxe but does not enable stock-event delivery or website checkout authority.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="block max-w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-primary-foreground" disabled={busy} onChange={(event) => void loadFile(event.target.files?.[0])} />
        {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
      </div>
      {rows.length > 0 && <div className="grid gap-2 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-3">
        <p><strong className="tabular-nums">{rows.length}</strong> unique SKUs</p>
        <p><strong className="tabular-nums">{total.toLocaleString()}</strong> counted units</p>
        <p>Reference: <strong>25 Nov 2026</strong></p>
      </div>}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1 accent-primary" checked={approved} onChange={(event) => setApproved(event.target.checked)} disabled={busy || rows.length !== 395} />
        <span>I confirm this is the reconciled physical-count sheet and approve registering its 395 SKU quantities as Auraluxe’s initial stock baseline.</span>
      </label>
      <Button onClick={() => void registerAll()} disabled={busy || rows.length !== 395 || !approved}>
        {busy ? 'Registering baselines…' : 'Register 395 verified baselines'}
      </Button>
      {status && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>}
    </section>
  );
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
      <div><div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4" />Administrator review</div><h1 className="font-display text-4xl">Inventory health</h1><p className="mt-2 text-sm text-muted-foreground">{data.productCount} products checked · {data.flaggedCount} products flagged</p></div>
      <div className="space-y-2"><Button variant="outline" disabled={isFetching} onClick={() => void refetch()}><RefreshCw className={isFetching ? 'motion-safe:animate-spin' : ''} />{isFetching ? 'Checking…' : 'Refresh'}</Button><p className="text-xs text-muted-foreground">Checked {new Date(data.checkedAt).toLocaleString()}</p></div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">Refresh failed. Previous results are shown. {error.message}</p>}
    <BaselineImport onComplete={() => void refetch()} />
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
