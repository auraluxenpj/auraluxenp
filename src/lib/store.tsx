import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSettings, type SettingsMap, DEFAULT_SETTINGS } from "./data";

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
  size: string | null;
  color: string | null;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  add: (item: CartItem) => void;
  remove: (key: string) => void;
  setQuantity: (key: string, quantity: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  wishlistIds: string[];
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
};

const STORAGE_KEY = "auraluxe-cart-v1";
const WISHLIST_STORAGE_KEY = "auraluxe-wishlist-v1";

const CartContext = createContext<CartContextValue | null>(null);

export const itemKey = (i: CartItem) => `${i.productId}|${i.size ?? ""}|${i.color ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [wishlistLoaded, setWishlistLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setItems(JSON.parse(raw) as CartItem[]);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WISHLIST_STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) setWishlistIds(parsed.filter((id): id is string => typeof id === "string"));
      }
    } catch {
      /* ignore malformed local wishlist data */
    } finally {
      setWishlistLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!wishlistLoaded) return;
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      /* ignore unavailable storage */
    }
  }, [wishlistIds, wishlistLoaded]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const key = itemKey(item);
      const existing = prev.find((p) => itemKey(p) === key);
      if (existing) {
        return prev.map((p) =>
          itemKey(p) === key ? { ...p, quantity: p.quantity + item.quantity } : p,
        );
      }
      return [...prev, item];
    });
  }, []);

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((p) => itemKey(p) !== key));
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) =>
      prev.map((p) => (itemKey(p) === key ? { ...p, quantity: Math.max(1, quantity) } : p)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);
  const toggleWishlist = useCallback((productId: string) => {
    setWishlistIds((prev) => prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]);
  }, []);
  const isWishlisted = useCallback((productId: string) => wishlistIds.includes(productId), [wishlistIds]);

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    return { items, add, remove, setQuantity, clear, count, subtotal, wishlistIds, toggleWishlist, isWishlisted };
  }, [items, add, remove, setQuantity, clear, wishlistIds, toggleWishlist, isWishlisted]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}

export function useSettings(): SettingsMap {
  const { data } = useQuery({
    queryKey: ["site_settings"],
    queryFn: fetchSettings,
    staleTime: 60_000,
  });
  return data ?? DEFAULT_SETTINGS;
}

export function useMoney() {
  const settings = useSettings();
  const symbol = settings["currency"] || "NPR";
  return useCallback(
    (amount: number) => `${symbol} ${Math.round(amount).toLocaleString("en-IN")}`,
    [symbol],
  );
}

export function formatMoney(amount: number, symbol = "NPR") {
  return `${symbol} ${Math.round(amount).toLocaleString("en-IN")}`;
}

export function whatsappLink(number: string, message: string) {
  const digits = (number || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
