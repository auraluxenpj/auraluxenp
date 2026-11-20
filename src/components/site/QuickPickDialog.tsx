import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { effectivePrice, productImage, type StorefrontProduct } from "@/lib/data";
import { requiredOptionLabels } from "@/lib/product-options";
import { useCart, useMoney } from "@/lib/store";
import { localizedContent, useLanguage } from "@/lib/i18n";

const pill = (active: boolean) =>
  `rounded-full border px-3.5 py-2 text-[11px] uppercase tracking-[0.12em] transition sm:px-4 sm:text-[12px] ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-foreground/70 hover:border-brand/60"
  }`;

/**
 * Quick chooser shown before an item goes into the bag. The shopper must
 * pick a size and a colour whenever the piece offers more than one of each.
 */
export function QuickPickDialog({
  product,
  open,
  onOpenChange,
}: {
  product: StorefrontProduct;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const money = useMoney();
  const { language, t } = useLanguage();
  const productName = localizedContent(product.name, product.name_ne, language);
  const { add } = useCart();
  const price = effectivePrice(product);
  const sizes = product.sizes ?? [];
  const colors = product.colors ?? [];
  const [size, setSize] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSize(null);
      setColor(null);
    }
  }, [open, product.id]);

  const missing = requiredOptionLabels(product, size, color);
  const canAdd = missing.length === 0;

  const confirm = () => {
    if (!canAdd) return;
    add({
      productId: product.id,
      slug: product.slug,
      name: productName,
      image: productImage(product),
      price,
      size: size ?? sizes[0] ?? null,
      color: color ?? colors[0] ?? null,
      quantity: 1,
    });
    toast.success(`${productName} ${t("addedToBag")}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{t("chooseOptionsTitle")}</DialogTitle>
          <DialogDescription>
            {t("chooseOptionsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3">
          <img
            src={productImage(product)}
            alt={productName}
            width={72}
            height={96}
            className="h-24 w-18 shrink-0 rounded-xl bg-muted object-cover"
          />
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-display text-sm leading-tight sm:text-base">
              {productName}
            </h3>
            <p className="mt-1 font-display text-sm text-primary sm:text-base">{money(price)}</p>
          </div>
        </div>

        {sizes.length > 1 ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t("size")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={`${pill(size === s)} min-h-11`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {colors.length > 1 ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{t("colour")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {colors.map((c) => (
                <button key={c} type="button" aria-pressed={color === c} onClick={() => setColor(c)} className={`${pill(color === c)} min-h-11`}>
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {missing.length ? (
          <p className="text-xs text-destructive">{t("pleaseSelect")} {missing.map((v) => ["colour", "color"].includes(v.toLowerCase()) ? t("colour") : t("size")).join(` ${t("and")} `)}</p>
        ) : null}

        <button
          type="button"
          onClick={confirm}
          disabled={!canAdd}
          className="w-full rounded-full bg-primary py-3 text-[12px] uppercase tracking-[0.18em] text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("addToBag")}
        </button>
      </DialogContent>
    </Dialog>
  );
}
