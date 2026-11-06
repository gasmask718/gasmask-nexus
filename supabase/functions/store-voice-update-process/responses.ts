import { createOpenAI } from "npm:@ai-sdk/openai";
import { streamText, Output, type ModelMessage } from "npm:ai";
import type { ZodType } from "npm:zod";
import { createLovableAiGatewayRunIdFetch, getLovableAiGatewayRunId } from "./run-id.ts";

export function createResponsesCall(request: Request, config: { baseURL: string; apiKey: string; model: string }, messages: ModelMessage[], instructions: string, schema: ZodType, initialRunId?: string) {
  const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId || getLovableAiGatewayRunId(request));
  const provider = createOpenAI({
    baseURL: `${config.baseURL.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`,
    apiKey: config.apiKey,
    headers: { "Lovable-API-Key": config.apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  const result = streamText({
    model: provider.responses(config.model),
    instructions,
    messages,
    output: Output.object({ schema }),
    abortSignal: request.signal,
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  return { result, getRunId: runIdFetch.getRunId };
}
