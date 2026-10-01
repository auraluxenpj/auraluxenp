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
};

const STORAGE_KEY = "auraluxe-cart-v1";

const CartContext = createContext<CartContextValue | null>(null);

export const itemKey = (i: CartItem) => `${i.productId}|${i.size ?? ""}|${i.color ?? ""}`;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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

  const value = useMemo<CartContextValue>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0);
    return { items, add, remove, setQuantity, clear, count, subtotal };
  }, [items, add, remove, setQuantity, clear]);

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
  const symbol = settings["currency"] || "Rs.";
  return useCallback(
    (amount: number) => `${symbol} ${Math.round(amount).toLocaleString("en-IN")}`,
    [symbol],
  );
}

export function formatMoney(amount: number, symbol = "Rs.") {
  return `${symbol} ${Math.round(amount).toLocaleString("en-IN")}`;
}

export function whatsappLink(number: string, message: string) {
  const digits = (number || "").replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
