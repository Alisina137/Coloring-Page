import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { generateImage } from "../services/imageProviders";
import { logger } from "./logger";

const imageCache = new Map<string, Buffer>();
const MAX_CACHE_ENTRIES = 100;

function cacheKey(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function cacheSet(key: string, buffer: Buffer): void {
  imageCache.set(key, buffer);
  if (imageCache.size > MAX_CACHE_ENTRIES) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
}

export type ImageQuality = "fast" | "balanced" | "premium";

export interface GenerateImageOptions {
  previousScenes?: string[];
  quality?: ImageQuality;
}

const STEPS_BY_QUALITY: Record<ImageQuality, number> = { fast: 15, balanced: 25, premium: 35 };

const COLORING_NEGATIVE_PROMPT =
  "No shadows, no gradients, no textures, no cross hatching, no background clutter, no realistic lighting, no fill colors.";

function buildColoringPrompt(subject: string): { prompt: string; negativePrompt: string } {
  const prompt = `A cute ${subject}, coloring book page, black outline only, clean thick line art, no shading, no grayscale, no color, white background, closed shapes, printable, vector-style illustration, suitable for children, centered composition, high contrast.`;
  return { prompt, negativePrompt: COLORING_NEGATIVE_PROMPT };
}

/**
 * Generates a black-and-white coloring book page. Runs through the provider chain
 * (Hugging Face -> Cloudflare Workers AI -> Pollinations -> fal.ai) via ImageGenerationService,
 * with automatic failover. Results are cached in-memory by prompt/quality.
 */
export async function generateImageBuffer(
  userRequest: string,
  options?: GenerateImageOptions | string
): Promise<Buffer> {
  const quality = (typeof options === "object" ? options.quality : undefined) ?? "balanced";
  const previousScenes = typeof options === "object" ? options.previousScenes : undefined;
  const steps = STEPS_BY_QUALITY[quality];

  const key = cacheKey(userRequest + (previousScenes?.join("|") ?? "") + quality);
  const cached = imageCache.get(key);
  if (cached) return cached;

  const subject =
    previousScenes && previousScenes.length > 0
      ? `${userRequest}. For visual consistency, keep the same main characters and art style as previous pages: ${previousScenes.join(" | ")}.`
      : userRequest;

  const { prompt, negativePrompt } = buildColoringPrompt(subject);

  const { buffer, provider } = await generateImage({ prompt, negativePrompt, steps });
  logger.info({ provider, quality, steps }, "Coloring page image generated");

  cacheSet(key, buffer);
  return buffer;
}

const COLOR_ILLUSTRATION_NEGATIVE_PROMPT =
  "No black and white, no monochrome, no line art only, no coloring book outline, no grayscale, no sketch style, no watermark.";

function buildColorIllustrationPrompt(subject: string): { prompt: string; negativePrompt: string } {
  const prompt = `A cute ${subject}, full color children's book illustration, vibrant saturated colors, warm inviting lighting, detailed and beautiful, high quality digital painting, suitable for children, centered composition.`;
  return { prompt, negativePrompt: COLOR_ILLUSTRATION_NEGATIVE_PROMPT };
}

/**
 * Generates a FRESH full-color children's book illustration (the "Color Hint") —
 * not a recoloring of the B&W page. Uses the same provider chain as the coloring page.
 */
export async function generateColorIllustrationBuffer(
  sceneDescription: string,
  quality: ImageQuality = "balanced"
): Promise<Buffer> {
  const steps = STEPS_BY_QUALITY[quality];
  const { prompt, negativePrompt } = buildColorIllustrationPrompt(sceneDescription);

  const { buffer, provider } = await generateImage({ prompt, negativePrompt, steps });
  logger.info({ provider, quality, steps }, "Color hint illustration generated");

  return buffer;
}
