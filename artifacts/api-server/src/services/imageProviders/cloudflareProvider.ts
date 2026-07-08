import type { ImageGenerationParams, ImageGenerator } from "./types";
import { ProviderError } from "./types";

// Fast, illustration-capable Workers AI text-to-image model.
const MODEL = "@cf/black-forest-labs/flux-1-schnell";

export const cloudflareProvider: ImageGenerator = {
  name: "cloudflare",

  isConfigured(): boolean {
    return Boolean(process.env["CLOUDFLARE_ACCOUNT_ID"] && process.env["CLOUDFLARE_API_TOKEN"]);
  },

  async generate(params: ImageGenerationParams, signal: AbortSignal): Promise<Buffer> {
    const accountId = process.env["CLOUDFLARE_ACCOUNT_ID"];
    const apiToken = process.env["CLOUDFLARE_API_TOKEN"];
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: params.negativePrompt ? `${params.prompt}. Avoid: ${params.negativePrompt}.` : params.prompt,
          width: params.width ?? 1024,
          height: params.height ?? 1024,
          num_steps: Math.min(params.steps ?? 25, 20), // Workers AI caps num_steps at 20
          ...(params.seed !== undefined ? { seed: params.seed } : {}),
        }),
      });
    } catch (err) {
      throw new ProviderError(`Cloudflare request failed: ${err instanceof Error ? err.message : String(err)}`, true);
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderError(`Cloudflare authentication failed (HTTP ${response.status})`, false);
    }
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new ProviderError(`Cloudflare request failed (HTTP ${response.status}): ${body.slice(0, 300)}`, true);
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.startsWith("image/")) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    // Some Workers AI models return JSON with a base64-encoded image instead of raw bytes.
    const json = (await response.json()) as {
      success?: boolean;
      errors?: unknown[];
      result?: { image?: string };
    };

    if (json.success === false || (json.errors && json.errors.length > 0)) {
      throw new ProviderError(`Cloudflare returned an error: ${JSON.stringify(json.errors)}`, true);
    }

    const base64Image = json.result?.image;
    if (!base64Image) {
      throw new ProviderError("Cloudflare response did not contain image data", true);
    }

    return Buffer.from(base64Image, "base64");
  },
};
