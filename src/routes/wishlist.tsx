import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { fetchProducts } from "@/lib/data";
import { useCart } from "@/lib/store";
import { useLanguage } from "@/lib/i18n";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "My Wishlist — Auraluxe Nepalgunj" }, { name: "description", content: "Your saved Auraluxe styles." }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { wishlistIds } = useCart();
  const { language } = useLanguage();
  const { data: products = [], isLoading, isError } = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const saved = products.filter((product) => wishlistIds.includes(product.id) && product.is_published);

  return (
    <SiteLayout>
      <main className="mx-auto min-h-[55vh] max-w-7xl py-10 sm:py-16">
        <p className="auraluxe-kicker">{language === "ne" ? "तपाईंको छनोट" : "YOUR EDIT"}</p>
        <h1 className="mt-2 font-display text-4xl text-[#422d2a] sm:text-5xl">{language === "ne" ? "मनपर्ने" : "My Wishlist"}</h1>
        <p className="mt-3 text-sm text-stone-500">{language === "ne" ? "पछि हेर्न मन परेका शैलीहरू यहाँ सुरक्षित हुन्छन्।" : "The pieces you love, saved in one place on this device."}</p>
        {isLoading ? <p className="py-12 text-sm text-muted-foreground">{language === "ne" ? "लोड हुँदैछ…" : "Loading your saved pieces…"}</p> : null}
        {isError ? <p role="alert" className="py-12 text-sm text-destructive">{language === "ne" ? "उत्पादनहरू लोड गर्न सकिएन।" : "We couldn't load the catalogue. Please try again."}</p> : null}
        {!isLoading && !isError && saved.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-[#eee5dd] bg-[#faf7f3] px-6 py-14 text-center">
            <p className="font-display text-2xl text-[#422d2a]">{language === "ne" ? "अहिलेसम्म कुनै मनपर्ने वस्तु छैन" : "Your wishlist is waiting"}</p>
            <p className="mt-2 text-sm text-stone-500">{language === "ne" ? "मनपर्ने वस्तुमा मुटु थिचेर सुरक्षित गर्नुहोस्।" : "Tap the heart on any product to save it here."}</p>
            <a href="/shop" className="mt-6 inline-flex rounded-full bg-[#762b3b] px-6 py-3 text-xs font-semibold uppercase tracking-[.16em] text-white">{language === "ne" ? "किनमेल गर्नुहोस्" : "Explore the collection"}</a>
          </div>
        ) : null}
        {saved.length > 0 ? <section aria-label="Saved products" className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">{saved.map((product) => <ProductCard key={product.id} product={product} />)}</section> : null}
      </main>
    </SiteLayout>
  );
}
