import { logger } from "../../lib/logger";
import { huggingfaceProvider } from "./huggingfaceProvider";
import { cloudflareProvider } from "./cloudflareProvider";
import { pollinationsProvider } from "./pollinationsProvider";
import { falProvider } from "./falProvider";
import type { ImageGenerationParams, ImageGenerationResult, ImageGenerator } from "./types";
import { ProviderError } from "./types";

// Priority order: Hugging Face (primary) -> Cloudflare Workers AI -> Pollinations -> fal.ai
const PROVIDERS: ImageGenerator[] = [huggingfaceProvider, cloudflareProvider, pollinationsProvider, falProvider];

const PROVIDER_TIMEOUT_MS = 60_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Attempts a single provider, retrying once on transient (retryable) failures. */
async function tryProvider(
  provider: ImageGenerator,
  params: ImageGenerationParams
): Promise<ImageGenerationResult | null> {
  const maxAttempts = 2; // 1 initial attempt + 1 retry for transient errors

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
    const startedAt = Date.now();

    logger.info({ provider: provider.name, attempt }, "Image generation request started");

    try {
      const buffer = await provider.generate(params, controller.signal);
      logger.info(
        { provider: provider.name, attempt, generationTimeMs: Date.now() - startedAt },
        "Image generation request completed"
      );
      return { buffer, provider: provider.name };
    } catch (err) {
      const retryable = !(err instanceof ProviderError) || err.retryable;
      logger.warn(
        { provider: provider.name, attempt, retryable, reason: errorMessage(err) },
        "Image generation provider failed"
      );

      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      // Transient error and attempts remain — retry this same provider once before failing over.
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return null;
}

/**
 * Generates an image by trying each configured provider in priority order:
 * Hugging Face -> Cloudflare Workers AI -> Pollinations -> fal.ai.
 *
 * Each provider gets one retry on transient failures (timeout, rate limit, 5xx, network
 * error) before failing over to the next provider. Invalid/missing credentials skip
 * straight to the next provider without retrying. Throws only if every provider fails.
 */
export async function generateImage(params: ImageGenerationParams): Promise<ImageGenerationResult> {
  const attemptedProviders: string[] = [];

  for (let i = 0; i < PROVIDERS.length; i++) {
    const provider = PROVIDERS[i];

    if (!provider.isConfigured()) {
      logger.info({ provider: provider.name }, "Skipping image generation provider — not configured");
      continue;
    }

    attemptedProviders.push(provider.name);
    const result = await tryProvider(provider, params);
    if (result) return result;

    const nextProvider = PROVIDERS.slice(i + 1).find((p) => p.isConfigured());
    if (nextProvider) {
      logger.warn(
        { failedProvider: provider.name, fallingBackTo: nextProvider.name },
        "Automatic fallback activated"
      );
    }
  }

  throw new Error(
    attemptedProviders.length > 0
      ? `All image generation providers failed: ${attemptedProviders.join(", ")}`
      : "No image generation providers are configured. Set HUGGINGFACE_API_KEY, CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN, or FAL_API_KEY."
  );
}
