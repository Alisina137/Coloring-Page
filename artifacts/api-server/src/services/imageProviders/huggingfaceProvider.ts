import { HfInference } from "@huggingface/inference";
import type { ImageGenerationParams, ImageGenerator } from "./types";
import { ProviderError } from "./types";

// Prefer FLUX, a fast/high-quality model widely available on HF Inference Providers.
// Fall back to Stable Diffusion XL if FLUX isn't available for the account/provider.
const MODEL_PRIMARY = "black-forest-labs/FLUX.1-schnell";
const MODEL_FALLBACK = "stabilityai/stable-diffusion-xl-base-1.0";

function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number; httpResponse?: { status?: number } })?.status;
  const httpStatus = (err as { httpResponse?: { status?: number } })?.httpResponse?.status;
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    httpStatus === 401 ||
    httpStatus === 403 ||
    msg.includes("invalid credentials") ||
    msg.includes("invalid token") ||
    msg.includes("unauthorized") ||
    msg.includes("insufficient permissions")
  );
}

async function runModel(
  hf: HfInference,
  model: string,
  params: ImageGenerationParams,
  signal: AbortSignal
): Promise<Buffer> {
  const blob = await hf.textToImage(
    {
      model,
      inputs: params.prompt,
      parameters: {
        negative_prompt: params.negativePrompt,
        width: params.width ?? 1024,
        height: params.height ?? 1024,
        num_inference_steps: params.steps ?? 25,
      },
    },
    { outputType: "blob", signal }
  );
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export const huggingfaceProvider: ImageGenerator = {
  name: "huggingface",

  isConfigured(): boolean {
    return Boolean(process.env["HUGGINGFACE_API_KEY"]);
  },

  async generate(params, signal) {
    const hf = new HfInference(process.env["HUGGINGFACE_API_KEY"]);

    try {
      return await runModel(hf, MODEL_PRIMARY, params, signal);
    } catch (primaryErr) {
      if (isAuthError(primaryErr)) {
        throw new ProviderError(
          primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
          false
        );
      }

      try {
        return await runModel(hf, MODEL_FALLBACK, params, signal);
      } catch (fallbackErr) {
        if (isAuthError(fallbackErr)) {
          throw new ProviderError(
            fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
            false
          );
        }
        throw new ProviderError(
          fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
          true
        );
      }
    }
  },
};
