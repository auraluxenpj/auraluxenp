import { createFileRoute } from "@tanstack/react-router";

const PLACE_ID = "ChIJxVLVWjhnmDkRGFV8ZPLV6TM";
const REVIEW_LINK = "https://g.page/r/CRhVfGTy1ekzEBM/review";

type GooglePlaceResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: Array<{
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
    googleMapsUri?: string;
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
      uri?: string;
    };
  }>;
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export const Route = createFileRoute("/api/google-reviews")({
  server: {
    handlers: {
      GET: async () => {
        const apiKey = process.env["GOOGLE_MAPS_API_KEY"];
        if (!apiKey) return json({ configured: false, googleMapsUrl: REVIEW_LINK });

        try {
          const response = await fetch(`https://places.googleapis.com/v1/places/${PLACE_ID}`, {
            headers: {
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "rating,userRatingCount,googleMapsUri,reviews",
            },
            signal: AbortSignal.timeout(8000),
          });
          if (!response.ok) {
            console.error("[google-reviews] Places API returned", response.status);
            return json({ configured: false, googleMapsUrl: REVIEW_LINK }, 503);
          }

          const place = (await response.json()) as GooglePlaceResponse;
          return json({
            configured: true,
            rating: place.rating,
            totalReviews: place.userRatingCount,
            googleMapsUrl: place.googleMapsUri || REVIEW_LINK,
            reviews: (place.reviews ?? []).map((review) => ({
              rating: review.rating ?? 0,
              text: review.text?.text ?? "",
              authorName: review.authorAttribution?.displayName ?? "Google customer",
              authorPhoto: review.authorAttribution?.photoUri,
              authorUrl: review.authorAttribution?.uri,
              published: review.relativePublishTimeDescription ?? "",
              googleMapsUrl: review.googleMapsUri,
            })),
          });
        } catch (error) {
          console.error("[google-reviews] Request failed", error);
          return json({ configured: false, googleMapsUrl: REVIEW_LINK }, 503);
        }
      },
    },
  },
});
