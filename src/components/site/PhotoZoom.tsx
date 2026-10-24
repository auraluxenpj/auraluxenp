import { useEffect } from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

export function PhotoZoom({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Zoomed photo: ${alt}`} className="fixed inset-0 z-50 bg-background">
      <TransformWrapper minScale={1} maxScale={4} doubleClick={{ mode: "toggle", step: 1.5 }} wheel={{ step: 0.15 }} centerOnInit>
        {({ zoomIn, resetTransform }) => (
          <>
            <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full grid place-items-center">
              <div onClick={() => zoomIn(1)} className="grid h-screen w-screen cursor-zoom-in place-items-center">
              <img
                src={src}
                alt={alt}
                className="max-h-screen max-w-full object-contain"
              />
              </div>
            </TransformComponent>
            <div className="absolute right-4 top-4 flex gap-2">
              <button type="button" onClick={() => resetTransform()} className="rounded-full bg-muted px-4 py-2 text-sm text-foreground shadow">
                Reset
              </button>
              <button type="button" aria-label="Close zoom" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-muted text-xl text-foreground shadow">
                ×
              </button>
            </div>
            <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-muted px-4 py-1.5 text-xs text-muted-foreground">
              Pinch or click to zoom · drag to move
            </p>
          </>
        )}
      </TransformWrapper>
    </div>
  );
}
