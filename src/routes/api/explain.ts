import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { streamText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "@/lib/ai/run-id";

const Body = z.object({
  image: z.string().startsWith("data:image/").max(8_000_000),
  material: z.string().trim().min(1).max(200),
  zones: z.string().max(4000).optional(),
  hints: z.string().max(2000).optional(),
});


const INSTRUCTIONS = `Tu es un assistant d'aide au contrôle qualité visuel de matériaux industriels.
À partir de la photo et du matériau indiqué, réponds en français, en Markdown concis :
1. **Défauts probables** : liste chaque défaut visible plausible (type, localisation approximative, indices visuels, niveau de confiance faible/moyen/élevé).
2. **Causes possibles** pour ce matériau.
3. **Vérifications complémentaires** proposées (mesures, essais non destructifs, contrôles visuels sous autre éclairage, etc.).
4. **Limites** : qualité de la photo, éclairage, ce qui ne peut pas être conclu.
Tu ne certifies jamais un défaut : la décision appartient à l'opérateur. Si aucun défaut n'est visible, dis-le.`;

export const Route = createFileRoute("/api/explain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return Response.json({ error: "Service IA non configuré." }, { status: 500 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Photo ou matériau manquant." }, { status: 400 });
        const { image, material, zones, hints } = parsed.data;
        const runIdFetch = createLovableAiGatewayRunIdFetch(getLovableAiGatewayRunId(request));
        const provider = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
          fetch: runIdFetch.fetch,
        });
        let upstreamError: string | null = null;
        const result = streamText({
          model: provider.responses("openai/gpt-6-astra"),
          system: INSTRUCTIONS,
          maxRetries: 0,
          abortSignal: request.signal,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: `Matériau inspecté : ${material}${hints ? `\nConsignes de l'usine pour ce matériau :\n${hints}` : ""}${zones ? `\nZones repérées par l'analyse locale :\n${zones}` : ""}` },
                { type: "image", image: new URL(image) },
              ],
            },
          ],
          providerOptions: {
            openai: {
              store: false,
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              include: ["reasoning.encrypted_content"],
            },
          },
          onError: ({ error }) => {
            const e = error as { statusCode?: number };
            console.error("explain error", error);
            upstreamError =
              e.statusCode === 429 ? "Trop de demandes, réessayez dans un moment."
              : e.statusCode === 402 ? "Crédits IA épuisés : ajoutez des crédits à l'espace de travail."
              : e.statusCode === 403 ? "Accès au modèle refusé pour cet espace de travail."
              : "L'analyse IA a échoué.";
          },
        });
        const enc = new TextEncoder();
        const body = new ReadableStream({
          async start(c) {
            try {
              for await (const t of result.textStream) c.enqueue(enc.encode(t));
            } catch { /* handled below */ }
            if (upstreamError) c.enqueue(enc.encode(`\n\n⚠️ ${upstreamError}`));
            c.close();
          },
        });
        return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" } });
      },
    },
  },
});
