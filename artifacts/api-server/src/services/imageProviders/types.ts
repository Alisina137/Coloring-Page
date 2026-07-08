export type ProviderName = "huggingface" | "cloudflare" | "pollinations" | "fal";

export interface ImageGenerationParams {
  /** Positive prompt describing what to generate. */
  prompt: string;
  /** Negative prompt describing what to avoid. Not all providers support this. */
  negativePrompt?: string;
  width?: number;
  height?: number;
  /** Diffusion steps, where supported by the provider/model. */
  steps?: number;
}

export interface ImageGenerationResult {
  buffer: Buffer;
  provider: ProviderName;
}

/**
 * Thrown by providers to signal failure.
 * `retryable: false` means the error is permanent for this provider (e.g. invalid/missing
 * API key) and the service should skip straight to the next provider without retrying.
 */
export class ProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable = true) {
    super(message);
    this.name = "ProviderError";
    this.retryable = retryable;
  }
}

export interface ImageGenerator {
  readonly name: ProviderName;
  /** Whether the required environment variables/secrets are present for this provider. */
  isConfigured(): boolean;
  generate(params: ImageGenerationParams, signal: AbortSignal): Promise<Buffer>;
}
