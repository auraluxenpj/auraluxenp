import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type { Product } from "./data";

const inputSchema = z.object({
  occasion: z.string().trim().min(2).max(200),
  style: z.string().trim().min(2).max(200),
  budget: z.number().int().min(0).max(1_000_000).nullable(),
});

export type StylistPick = { product: Product; reason: string };
export type StylistResult = { summary: string; picks: StylistPick[] };

// AI stylist: describes live published products to the model and only ever
// returns products that actually exist in the catalog (model picks by id).
export const recommendProducts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<StylistResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("The stylist is not configured yet. Please try again later.");

    const dbKey = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const db = createClient<Database>(process.env["SUPABASE_URL"]!, dbKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (dbKey.startsWith("sb_") && h.get("Authorization") === `Bearer ${dbKey}`) h.delete("Authorization");
          h.set("apikey", dbKey);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const [{ data: products, error: pErr }, { data: categories }] = await Promise.all([
      db
        .from("products")
        .select("*")
        .eq("is_published", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false })
        .limit(80),
      db.from("categories").select("id, name"),
    ]);
    if (pErr) throw new Error("Could not load the catalog right now.");
    if (!products?.length) return { summary: "Our catalog is being restocked — please check back soon.", picks: [] };

    const catName = new Map((categories ?? []).map((c) => [c.id, c.name]));
    const catalog = products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category_id ? (catName.get(p.category_id) ?? null) : null,
      price: p.sale_price != null && Number(p.sale_price) > 0 ? Number(p.sale_price) : Number(p.price),
      fabric: p.fabric,
      colors: p.colors,
      sizes: p.sizes,
      description: p.description?.slice(0, 240) ?? null,
    }));

    const budgetLine =
      data.budget != null && data.budget > 0
        ? `The shopper's budget is Rs. ${data.budget}. Prefer items at or under it; only exceed it if an item is an exceptional match, and say so in the reason.`
        : "No budget was given.";

    const schema = {
      name: "stylist_picks",
      strict: true,
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          picks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                product_id: { type: "string" },
                reason: { type: "string" },
              },
              required: ["product_id", "reason"],
              additionalProperties: false,
            },
          },
        },
        required: ["summary", "picks"],
        additionalProperties: false,
      },
    } as const;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        reasoning_effort: "low",
        stream: true,
        max_completion_tokens: 4000,
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          {
            role: "system",
            content:
              "You are the in-store stylist for AURALUXE, a ladies' fashion boutique in Nepalgunj, Nepal. " +
              "Recommend products ONLY from the provided live catalog, chosen by their exact product_id. " +
              "Pick up to 6 items, best matches first. Give each a warm, specific one-sentence reason. " +
              "The summary is one friendly sentence about the overall selection. Never invent products, prices or stock.",
          },
          {
            role: "user",
            content:
              `Occasion: ${data.occasion}\nStyle preferences: ${data.style}\n${budgetLine}\n\nLive catalog (JSON):\n` +
              JSON.stringify(catalog),
          },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("The stylist is busy right now — please try again in a minute.");
      if (res.status === 402 || res.status === 403) throw new Error("The stylist is temporarily unavailable. Please browse the shop instead.");
      throw new Error(`The stylist could not answer just now (${res.status}).`);
    }

    // Consume the SSE stream server-side and accumulate the final answer.
    const reader = res.body?.getReader();
    let answer = "";
    if (reader) {
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const chunk = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
              const piece = chunk.choices?.[0]?.delta?.content;
              if (piece) answer += piece;
            } catch {
              /* partial frame */
            }
          }
        }
      }
    }

    let parsed: { summary?: string; picks?: { product_id: string; reason: string }[] } = {};
    try {
      parsed = JSON.parse(answer);
    } catch {
      throw new Error("The stylist gave an unclear answer — please try rephrasing.");
    }

    const byId = new Map(products.map((p) => [p.id, p]));
    const picks: StylistPick[] = (parsed.picks ?? [])
      .filter((pick) => byId.has(pick.product_id))
      .slice(0, 6)
      .map((pick) => ({ product: byId.get(pick.product_id)!, reason: String(pick.reason ?? "").slice(0, 300) }));

    if (!picks.length) {
      return {
        summary: "Nothing in the current collection matched that closely — try a broader style or budget.",
        picks: [],
      };
    }
    return { summary: String(parsed.summary ?? "Here are our picks for you.").slice(0, 300), picks };
  });
