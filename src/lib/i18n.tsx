import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "ne";

const messages: Record<string, { en: string; ne: string }> = {
  shop: { en: "Shop", ne: "किनमेल" },
  shopAll: { en: "Shop all", ne: "सबै उत्पादन हेर्नुहोस्" },
  newArrivals: { en: "New Arrivals", ne: "नयाँ आगमन" },
  sale: { en: "Sale", ne: "छुट" },
  about: { en: "About", ne: "हाम्रो बारेमा" },
  contact: { en: "Contact", ne: "सम्पर्क" },
  search: { en: "Search products", ne: "उत्पादन खोज्नुहोस्" },
  cart: { en: "Cart", ne: "किनमेल झोला" },
  menu: { en: "Menu", ne: "मेनु" },
  trackOrder: { en: "Track Order", ne: "अर्डर ट्र्याक गर्नुहोस्" },
  shipping: { en: "Shipping", ne: "ढुवानी" },
  returns: { en: "Returns", ne: "फिर्ता नीति" },
  faq: { en: "FAQ", ne: "सामान्य प्रश्न" },
  privacy: { en: "Privacy", ne: "गोपनीयता" },
  terms: { en: "Terms", ne: "नियम तथा सर्त" },
  aiStylist: { en: "AI Stylist", ne: "एआई स्टाइलिस्ट" },
  bag: { en: "Bag", ne: "झोला" },
  checkout: { en: "Checkout", ne: "अर्डर पूरा गर्नुहोस्" },
  language: { en: "Language", ne: "भाषा" },
  findYourFit: { en: "Find your fit", ne: "आफ्नो रोजाइ छान्नुहोस्" },
  shopByCategory: { en: "Shop by Category", ne: "श्रेणी अनुसार किनमेल" },
  justLanded: { en: "Just landed", ne: "भर्खरै आएका" },
  viewAll: { en: "View all", ne: "सबै हेर्नुहोस्" },
  trending: { en: "Trending Now", ne: "अहिले लोकप्रिय" },
  bestSellers: { en: "Best Sellers", ne: "धेरै बिक्री भएका" },
  specialOffers: { en: "Special Offers", ne: "विशेष अफर" },
  customerStories: { en: "Customer Stories", ne: "ग्राहकका अनुभव" },
  ourStory: { en: "Our story", ne: "हाम्रो कथा" },
  designedNepalgunj: { en: "Designed in Nepalgunj", ne: "नेपालगञ्जमा तयार गरिएको" },
  readMore: { en: "Read more", ne: "थप पढ्नुहोस्" },
  visitUs: { en: "Visit us", ne: "हामीलाई भेट्नुहोस्" },
  nepalgunjStore: { en: "The Nepalgunj store", ne: "नेपालगञ्जको स्टोर" },
  followAlong: { en: "Follow along", ne: "हामीसँग जोडिनुहोस्" },
  orderWhatsApp: { en: "Order on WhatsApp", ne: "WhatsApp बाट अर्डर गर्नुहोस्" },
  directionsHours: { en: "Directions & hours", ne: "ठेगाना र समय" },
};

type I18nValue = { language: Language; setLanguage: (language: Language) => void; t: (key: string, fallback?: string) => string };
const I18nContext = createContext<I18nValue>({
  language: "en",
  setLanguage: () => undefined,
  t: (key, fallback) => fallback ?? messages[key]?.en ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("auraluxe-language");
      if (saved === "en" || saved === "ne") setLanguageState(saved);
    } catch {
      // Storage may be unavailable; English remains the safe default.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dataset.language = language;
    try {
      window.localStorage.setItem("auraluxe-language", language);
    } catch {
      // Language still works for the current visit without storage.
    }
  }, [language]);

  const value = useMemo<I18nValue>(() => ({
    language,
    setLanguage: setLanguageState,
    t: (key, fallback) => messages[key]?.[language] ?? fallback ?? key,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
