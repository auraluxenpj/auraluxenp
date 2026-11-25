import { useEffect, useState } from "react";

const GOOGLE_REVIEW_URL = "https://g.page/r/CRhVfGTy1ekzEBM/review";

type GoogleReview = {
  rating: number;
  text: string;
  authorName: string;
  authorPhoto?: string;
  authorUrl?: string;
  published: string;
  googleMapsUrl?: string;
};

type GoogleReviewsData = {
  configured: boolean;
  rating?: number;
  totalReviews?: number;
  googleMapsUrl?: string;
  reviews?: GoogleReview[];
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="tracking-[0.16em] text-[#bd8730]" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(Math.max(0, Math.min(5, Math.round(rating))))}
      <span className="text-[#d9cfc4]">{"★".repeat(5 - Math.max(0, Math.min(5, Math.round(rating))))}</span>
    </span>
  );
}

export function GoogleReviews() {
  const [data, setData] = useState<GoogleReviewsData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/google-reviews", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Google reviews unavailable");
        return (await response.json()) as GoogleReviewsData;
      })
      .then(setData)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setData({ configured: false });
      });
    return () => controller.abort();
  }, []);

  const reviews = data?.reviews ?? [];
  const mapsUrl = data?.googleMapsUrl || GOOGLE_REVIEW_URL;

  return (
    <section
      className="mt-16 overflow-hidden rounded-3xl border border-[#eadfd5] bg-[#f7f1e9] px-5 py-9 text-[#422d2a] sm:px-10 sm:py-12"
      aria-labelledby="google-reviews-heading"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[#762b3b]">AURALUXE · CUSTOMER LOVE</p>
        <h2 id="google-reviews-heading" className="mt-3 font-display text-3xl sm:text-4xl">
          Loved by Our Customers
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#76666a]">
          Real experiences from people who have shopped with Auraluxe.
        </p>

        {data?.rating != null ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <span className="font-display text-3xl">{data.rating.toFixed(1)}</span>
            <span className="flex flex-col items-start gap-0.5">
              <Stars rating={data.rating} />
              <span className="text-[11px] text-[#76666a]">
                {data.totalReviews?.toLocaleString() ?? "Google"} Google reviews
              </span>
            </span>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-2 text-sm">
            <span className="text-xl tracking-[0.12em] text-[#bd8730]">★★★★★</span>
            <span className="text-[#76666a]">Find us on Google</span>
          </div>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-2">
          {reviews.slice(0, 5).map((review, index) => (
            <article key={`${review.authorName}-${index}`} className="rounded-2xl border border-[#eee5dc] bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {review.authorPhoto ? (
                    <img src={review.authorPhoto} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f3e8e9] text-sm font-medium text-[#762b3b]">
                      {review.authorName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    {review.authorUrl ? (
                      <a href={review.authorUrl} target="_blank" rel="noreferrer" className="block truncate text-sm font-medium hover:underline">
                        {review.authorName}
                      </a>
                    ) : (
                      <p className="truncate text-sm font-medium">{review.authorName}</p>
                    )}
                    <p className="text-[11px] text-[#96878a]">{review.published}</p>
                  </div>
                </div>
                <Stars rating={review.rating} />
              </div>
              {review.text ? <p className="mt-4 text-sm leading-6 text-[#514449]">{review.text}</p> : null}
              {review.googleMapsUrl ? (
                <a href={review.googleMapsUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-[10px] uppercase tracking-[0.15em] text-[#762b3b] underline underline-offset-4">
                  View on Google Maps
                </a>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mx-auto mt-7 max-w-lg text-center text-xs leading-5 text-[#8c7b7e]">
          Visit our Google profile to read genuine customer feedback and share your own experience.
        </p>
      )}

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-full bg-[#762b3b] px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.17em] text-white transition hover:bg-[#5f2030] sm:w-auto">
          Write a Google Review
        </a>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center rounded-full border border-[#762b3b]/25 bg-white px-7 py-3.5 text-[11px] font-medium uppercase tracking-[0.17em] text-[#762b3b] transition hover:bg-[#fbf7f3] sm:w-auto">
          Read All Reviews on Google
        </a>
      </div>
      {reviews.length > 0 ? (
        <p className="mx-auto mt-5 max-w-3xl text-center text-[10px] leading-5 text-[#8c7b7e]">
          Reviews are shown in Google's relevance order. Google checks for and removes fake content when identified. Google reviews are not individually verified.
        </p>
      ) : null}
      <p className="mt-4 text-center text-[10px] tracking-wide text-[#8c7b7e]">Google Reviews</p>
    </section>
  );
}
