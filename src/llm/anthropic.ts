import Anthropic from "@anthropic-ai/sdk";

export type GenerateOptions = {
  apiKey: string;
  model?: string;
  system: string;
  user: string;
  maxTokens?: number;
};

export type GenerateResult = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
};

/** Default lean model for cost control (Haiku-class). Override with DEVFLOW_MODEL. */
export const DEFAULT_MODEL = process.env.DEVFLOW_MODEL || "claude-haiku-4-5-20251001";

export async function generateMarkdown(opts: GenerateOptions): Promise<GenerateResult> {
  // ponytail: proxy-friendly BYOK — SDK default host is fine; ANTHROPIC_BASE_URL for gateways
  const client = new Anthropic({
    apiKey: opts.apiKey,
    ...(process.env.ANTHROPIC_BASE_URL
      ? { baseURL: process.env.ANTHROPIC_BASE_URL }
      : {}),
  });
  const model = opts.model || DEFAULT_MODEL;
  const maxTokens = opts.maxTokens ?? 4096;

  const msg = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  return {
    text,
    model,
    inputTokens: msg.usage?.input_tokens ?? null,
    outputTokens: msg.usage?.output_tokens ?? null,
  };
}

export function resolveApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || process.env.DEVFLOW_API_KEY || null;
}
