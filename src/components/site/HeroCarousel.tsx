import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { Banner } from "@/lib/data";
import { useLanguage } from "@/lib/i18n";

const AUTOPLAY_MS = 6000;
const SWIPE_THRESHOLD_PX = 45;

function SlideImage({ banner, priority }: { banner: Banner; priority: boolean }) {
  const desktop = banner.image_url ?? "/images/hero-auraluxe.jpg";
  const mobile = (banner as Banner & { mobile_image_url?: string | null }).mobile_image_url;

  // Automatic product slides (built from in-stock products) use portrait photos:
  // show the whole photo over a blurred copy of itself instead of cropping it.
  const isProductSlide = banner.id.startsWith("product-hero-");
  if (isProductSlide) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-muted">
        <img
          src={desktop}
          alt=""
          aria-hidden="true"
          loading={priority ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
        />
        <img
          src={desktop}
          alt={banner.title ?? "Auraluxe product"}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          className="relative h-full w-full object-contain sm:object-[78%_center]"
        />
      </div>
    );
  }

  return (
    <picture>
      {mobile ? <source media="(max-width: 767px)" srcSet={mobile} /> : null}
      <img
        src={desktop}
        alt={banner.title ?? "Auraluxe campaign"}
        width={1920}
        height={960}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        className="h-full w-full object-cover"
      />
    </picture>
  );
}

export function HeroCarousel({ banners }: { banners: Banner[] }) {
  const { t } = useLanguage();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useRef(false);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const count = banners.length;

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    if (count < 2 || paused || reduced.current) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTOPLAY_MS);
    return () => window.clearInterval(timer);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  const handlePointerDown = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "touch" || count < 2) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLElement>) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start || event.pointerType !== "touch") return;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX || Math.abs(deltaX) < Math.abs(deltaY) * 1.2) return;
    go(deltaX < 0 ? 1 : -1);
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label={t("featuredCampaigns")}
      className="relative -mx-5 -mt-2 touch-pan-y overflow-hidden sm:-mx-8 lg:-mx-12 2xl:-mx-16"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        swipeStart.current = null;
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStart.current = null;
      }}
    >
      <h1 className="sr-only">{t("homeSeoTitle")}</h1>
      <div className="relative aspect-[3/4] w-full sm:aspect-[16/9] lg:aspect-[2/1]">
        {banners.map((b, i) => (
          <div
            key={b.id}
            aria-hidden={i !== index}
            className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
              i === index ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <SlideImage banner={b} priority={i === 0} />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-12">
              <div className="max-w-xl">
                {b.title ? (
                  <h2 className="font-display text-4xl leading-[1.05] text-primary-foreground drop-shadow sm:text-6xl">
                    {b.title}
                  </h2>
                ) : null}
                {b.subtitle ? (
                  <p className="mt-3 max-w-md text-[15px] leading-relaxed text-primary-foreground/90 drop-shadow">
                    {b.subtitle}
                  </p>
                ) : null}
                {b.button_text && b.button_link ? (
                  b.button_link.startsWith("/") ? (
                    <Link
                      to={b.button_link as "/shop"}
                      className="mt-6 inline-block rounded-full bg-primary-foreground px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary transition hover:bg-accent"
                    >
                      {b.button_text}
                    </Link>
                  ) : (
                    <a
                      href={b.button_link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 inline-block rounded-full bg-primary-foreground px-7 py-3.5 text-[13px] uppercase tracking-[0.18em] text-primary transition hover:bg-accent"
                    >
                      {b.button_text}
                    </a>
                  )
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>

      {count > 1 ? (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`${t("goToBanner")} ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-6 bg-primary-foreground" : "w-2 bg-primary-foreground/50"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
