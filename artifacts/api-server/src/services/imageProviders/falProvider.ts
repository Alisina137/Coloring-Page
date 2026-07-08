import type { ImageGenerationParams, ImageGenerator } from "./types";
import { ProviderError } from "./types";

// FLUX schnell is fast and well suited for illustration-style output.
const MODEL_ENDPOINT = "https://fal.run/fal-ai/flux/schnell";

interface FalResponse {
  images?: { url: string }[];
  detail?: string;
}

export const falProvider: ImageGenerator = {
  name: "fal",

  isConfigured(): boolean {
    return Boolean(process.env["FAL_API_KEY"]);
  },

  async generate(params: ImageGenerationParams, signal: AbortSignal): Promise<Buffer> {
    const apiKey = process.env["FAL_API_KEY"];
    const fullPrompt = params.negativePrompt ? `${params.prompt}. Avoid: ${params.negativePrompt}.` : params.prompt;

    let response: Response;
    try {
      response = await fetch(MODEL_ENDPOINT, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Key ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          image_size: {
            width: params.width ?? 1024,
            height: params.height ?? 1024,
          },
          num_inference_steps: Math.min(params.steps ?? 4, 8),
        }),
      });
    } catch (err) {
      throw new ProviderError(`fal.ai request failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(`fal.ai authentication failed (HTTP ${response.status})`, false);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ProviderError(`fal.ai request failed (HTTP ${response.status}): ${body.slice(0, 300)}`, true);
    }

    const json = (await response.json()) as FalResponse;
    const imageUrl = json.images?.[0]?.url;
    if (!imageUrl) {
      throw new ProviderError(`fal.ai response did not contain an image URL: ${json.detail ?? JSON.stringify(json)}`, true);
    }

    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, { signal });
    } catch (err) {
      throw new ProviderError(`fal.ai image download failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }
    if (!imageResponse.ok) {
      throw new ProviderError(`fal.ai image download failed (HTTP ${imageResponse.status})`, true);
    }

    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  },
};
