import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sanitizeSmartDraft, type SmartDraft } from "./smart-upload";

const inputSchema = z.object({
  name: z.string().trim().min(2).max(150),
  notes: z.string().trim().max(600).optional(),
  photoCount: z.number().int().min(0).max(20),
});

// Smart product upload: an admin gives a product name (plus optional notes and
// photo count) and the model drafts the description, SEO fields, fabric,
// category, sizes, colours and SKU garment type. The admin always reviews and
// edits before anything is saved.
export const generateProductDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }): Promise<SmartDraft> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Only store admins can use smart upload.");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Smart upload is not configured yet. Please try again later.");

    const { data: categories, error: cErr } = await context.supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (cErr) throw new Error("Could not load categories right now.");

    const schema = {
      name: "product_draft",
      strict: true,
      schema: {
        type: "object",
        properties: {
          description: { type: "string" },
          meta_title: { type: "string" },
          meta_description: { type: "string" },
          fabric: { type: "string" },
          category_id: { type: ["string", "null"] },
          sizes: { type: "array", items: { type: "string" } },
          colors: { type: "array", items: { type: "string" } },
          sku_kind: { type: "string" },
        },
        required: [
          "description",
          "meta_title",
          "meta_description",
          "fabric",
          "category_id",
          "sizes",
          "colors",
          "sku_kind",
        ],
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
        max_completion_tokens: 3000,
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          {
            role: "system",
            content:
              "You write catalogue copy for AURALUXE, a premium ladies' fashion boutique in Nepalgunj, Nepal " +
              "(kurtis, co-ord sets, suits, dresses, party wear, sarees, gowns). " +
              "Given a product name and optional notes, draft: a warm 2-4 sentence description (no prices, no stock claims), " +
              "an SEO title under 60 characters, an SEO description under 155 characters, the likely fabric, " +
              "the best matching category_id from the provided list (null if none fits), typical sizes " +
              "(choose from S, M, L, XL, XXL or Free Size as appropriate), likely colours, and the SKU garment " +
              "kind (one of PW, CO, S, K, SU, D, G, PZ, SH, T, OTH). Never invent brand names or claims of authenticity.",
          },
          {
            role: "user",
            content:
              `Product name: ${data.name}\n` +
              (data.notes ? `Notes from the shop owner: ${data.notes}\n` : "") +
              (data.photoCount > 0 ? `The owner is attaching ${data.photoCount} photo(s).\n` : "") +
              `Categories (JSON):\n` +
              JSON.stringify(categories ?? []),
          },
        ],
      }),
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error("Smart upload is busy right now — please try again in a minute.");
      if (res.status === 402 || res.status === 403)
        throw new Error("Smart upload is temporarily unavailable. You can still add the product manually.");
      throw new Error(`Smart upload could not answer just now (${res.status}).`);
    }

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

    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(answer);
    } catch {
      throw new Error("Smart upload gave an unclear answer — please try again.");
    }

    return sanitizeSmartDraft(parsed, categories ?? []);
  });
