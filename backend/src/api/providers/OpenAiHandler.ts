import { ApiHandler, ApiHandlerOptions } from "../ApiHandler";

export class OpenAiHandler implements ApiHandler {
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(apiKey?: string, model?: string) {
    const clean = (v: string) => v.trim().replace(/^["']|["']$/g, "");
    this.apiKey = clean(apiKey || process.env.OPENAI_API_KEY || "");
    this.defaultModel = clean(model || process.env.OPENAI_MODEL || "gpt-4o-mini");
    this.baseUrl = clean(process.env.OPENAI_BASE_URL || "https://api.openai.com/v1");
  }

  async createMessage(
    systemPrompt: string,
    userPrompt: string,
    options?: ApiHandlerOptions
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key is not configured.");
    }

    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
    messages.push({ role: "user", content: userPrompt });

    const payload: any = {
      model: options?.model || this.defaultModel,
      messages,
      temperature: options?.temperature ?? (options?.jsonMode ? 0.2 : 0.7),
      max_tokens: options?.maxTokens || 4096,
    };

    if (options?.jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 429) {
        throw new Error(`OpenAI rate limit exceeded. Please wait and try again.`);
      }
      if (response.status === 401) {
        throw new Error(`OpenAI API key is invalid or expired.`);
      }
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from OpenAI");

    return this.cleanResponse(content, options?.jsonMode);
  }

  private cleanResponse(raw: string, jsonMode?: boolean): string {
    if (!jsonMode) return raw;
    let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const firstBrace = cleaned.indexOf("{");
    if (firstBrace >= 0) {
      let depth = 0;
      let end = -1;
      for (let i = firstBrace; i < cleaned.length; i++) {
        if (cleaned[i] === "{") depth++;
        if (cleaned[i] === "}") {
          depth--;
          if (depth === 0) { end = i; break; }
        }
      }
      if (end >= 0) cleaned = cleaned.slice(firstBrace, end + 1);
    }
    return cleaned;
  }
}
