import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { recommendProducts, type StylistResult } from "@/lib/stylist.functions";
import { StylistPickCard } from "@/components/site/StylistPickCard";
import { useCart } from "@/lib/store";
import { stylistCartItems } from "@/lib/stylist-cart";


export const Route = createFileRoute("/stylist")({
  head: () => ({
    meta: [
      { title: "AI Stylist — Auraluxe Nepalgunj" },
      {
        name: "description",
        content:
          "Tell us your occasion, style and budget and our AI stylist recommends matching AURALUXE pieces from the live collection.",
      },
      { property: "og:title", content: "AI Stylist — Auraluxe Nepalgunj" },
      {
        property: "og:description",
        content: "Describe your occasion, style and budget for personalised AURALUXE picks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StylistPage,
});

function StylistPage() {
  const recommend = useServerFn(recommendProducts);
  const { add } = useCart();

  const [occasion, setOccasion] = useState("");
  const [style, setStyle] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StylistResult | null>(null);
  const [selections, setSelections] = useState<Record<string, { size: string | null; color: string | null }>>({});

  const noteSelection = (productId: string, sel: { size: string | null; color: string | null }) =>
    setSelections((prev) => ({ ...prev, [productId]: sel }));

  const addAll = () => {
    const items = stylistCartItems(result?.picks ?? [], selections);
    if (!items.length) {
      toast.error("These pieces are no longer available — please try again.");
      return;
    }
    items.forEach((item) => add(item));
    toast.success(
      `${items.length} ${items.length === 1 ? "piece" : "pieces"} added to your bag`,
    );
  };


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const parsedBudget = budget.trim() ? Math.max(0, Math.round(Number(budget))) : null;
      if (budget.trim() && !Number.isFinite(parsedBudget)) throw new Error("Budget must be a number.");
      const res = await recommend({
        data: { occasion, style, budget: parsedBudget },
      });
      setSelections({});
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl">
      <header className="text-center">
        <p className="text-[11px] uppercase tracking-[0.3em] text-brand">Personal shopping</p>
        <h1 className="mt-2 font-display text-3xl sm:text-5xl">AI Stylist</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Tell us the occasion, your style and your budget — we'll suggest pieces from the live
          AURALUXE collection.
        </p>
      </header>

      <form onSubmit={submit} className="glass mt-8 grid gap-4 rounded-3xl p-5 sm:grid-cols-3 sm:p-8">
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Occasion</span>
          <input
            required
            value={occasion}
            onChange={(e) => setOccasion(e.target.value)}
            placeholder="Wedding, office, festive…"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Style</span>
          <input
            required
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="Elegant, casual, bold colours…"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Budget (Rs., optional)</span>
          <input
            inputMode="numeric"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="e.g. 3000"
            className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-brand"
          />
        </label>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[12px] uppercase tracking-[0.2em] text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? "Finding your pieces…" : "Get recommendations"}
          </button>
        </div>
      </form>

      {error ? (
        <p className="mt-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="mt-10">
          <p className="text-center font-display text-xl">{result.summary}</p>
          {result.picks.length ? (
            <>
              <div className="mt-5 flex justify-center">
                <button
                  type="button"
                  onClick={addAll}
                  className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-secondary px-5 py-2.5 text-[11px] uppercase tracking-[0.16em] text-primary transition hover:bg-primary hover:text-primary-foreground"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Add all {result.picks.length} to bag
                </button>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
                {result.picks.map(({ product, reason }) => (
                  <StylistPickCard key={product.id} product={product} reason={reason} onSelectionChange={noteSelection} />
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

    </main>
  );
}
