import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/site/SiteLayout";
import { fetchPage } from "@/lib/data";
import { useSettings } from "@/lib/store";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Auraluxe — Our Story" },
      {
        name: "description",
        content:
          "The story, mission and studio behind Auraluxe, a ladies' fashion label based in Nepalgunj, Nepal.",
      },
      { property: "og:title", content: "About Auraluxe — Our Story" },
      {
        property: "og:description",
        content: "The story and mission behind Auraluxe, a ladies' fashion label in Nepalgunj.",
      },
    ],
  }),
  component: About,
});

function About() {
  const s = useSettings();
  const { data: page } = useQuery({ queryKey: ["page", "about"], queryFn: () => fetchPage("about") });

  return (
    <SiteLayout>
      <section className="mt-8 grid gap-6 lg:grid-cols-12">
        <div className="glass-strong rounded-3xl p-8 sm:p-12 lg:col-span-7">
          <p className="eyebrow">Nepalgunj · Est. 2024</p>
          <h1 className="mt-5 font-display text-5xl leading-[1.02]">{page?.title ?? "About Auraluxe"}</h1>
          <div className="mt-5 whitespace-pre-line text-[15px] leading-relaxed text-muted-foreground">
            {page?.content}
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              to="/shop"
              className="rounded-full bg-primary px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary-foreground"
            >
              Shop the collection
            </Link>
            <Link
              to="/contact"
              className="text-[13px] uppercase tracking-[0.18em] text-foreground/70 underline decoration-accent decoration-2 underline-offset-4"
            >
              Visit the studio
            </Link>
          </div>
        </div>
        <div className="lg:col-span-5">
          <img
            src={page?.image_url ?? "/images/hero-auraluxe.jpg"}
            alt="Auraluxe atelier"
            loading="lazy"
            width={1088}
            height={1408}
            className="h-full min-h-[320px] w-full rounded-3xl object-cover"
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="glass rounded-2xl px-5 py-4">
          <p className="label-caps text-muted-foreground">Studio</p>
          <p className="mt-2 text-sm">{s["address"]}</p>
        </div>
        <div className="glass rounded-2xl px-5 py-4">
          <p className="label-caps text-muted-foreground">Hours</p>
          <p className="mt-2 text-sm">{s["store_hours"]}</p>
        </div>
        <div className="glass rounded-2xl px-5 py-4">
          <p className="label-caps text-muted-foreground">Contact</p>
          <p className="mt-2 text-sm">
            {s["phone"]}
            <br />
            {s["email"]}
          </p>
        </div>
      </section>
    </SiteLayout>
  );
}
