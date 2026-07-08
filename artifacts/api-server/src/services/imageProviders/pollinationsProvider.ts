import type { ImageGenerationParams, ImageGenerator } from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://image.pollinations.ai/prompt";

export const pollinationsProvider: ImageGenerator = {
  name: "pollinations",

  isConfigured(): boolean {
    // Pollinations works without a key; an API key/token is only used when available
    // (raises rate limits). It should never block this provider from being tried.
    return true;
  },

  async generate(params: ImageGenerationParams, signal: AbortSignal): Promise<Buffer> {
    const fullPrompt = params.negativePrompt ? `${params.prompt}. Avoid: ${params.negativePrompt}.` : params.prompt;
    const encodedPrompt = encodeURIComponent(fullPrompt);

    const url = new URL(`${BASE_URL}/${encodedPrompt}`);
    url.searchParams.set("width", String(params.width ?? 1024));
    url.searchParams.set("height", String(params.height ?? 1024));
    url.searchParams.set("nologo", "true");
    url.searchParams.set("model", "flux");
    if (params.seed !== undefined) url.searchParams.set("seed", String(params.seed));

    const apiKey = process.env["POLLINATIONS_API_KEY"];
    if (apiKey) url.searchParams.set("token", apiKey);

    let response: Response;
    try {
      response = await fetch(url, { signal, headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined });
    } catch (err) {
      throw new ProviderError(`Pollinations request failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(`Pollinations authentication failed (HTTP ${response.status})`, false);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ProviderError(`Pollinations request failed (HTTP ${response.status}): ${body.slice(0, 300)}`, true);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      const body = await response.text().catch(() => "");
      throw new ProviderError(`Pollinations did not return an image (content-type: ${contentType}): ${body.slice(0, 300)}`, true);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};
