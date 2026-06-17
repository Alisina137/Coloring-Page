import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { generateColoringPrompt, buildHuggingFacePrompt, buildNegativePrompt, buildFallbackPrompt } from "../services/geminiService";
import { generateColoringImage } from "../services/huggingfaceService";

const imageCache = new Map<string, Buffer>();

function cacheKey(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

export interface GenerateImageOptions {
  size?: string;
  previousScenes?: string[];
}

/**
 * Generate a coloring-book line art image.
 *
 * Pipeline:
 *  1. Hugging Face SDXL is always the image generator (primary).
 *  2. Gemini optionally enhances the prompt first. If Gemini is unavailable
 *     or fails, we fall back to a direct prompt built from the user request.
 */
export async function generateImageBuffer(
  userRequest: string,
  options?: GenerateImageOptions | string
): Promise<Buffer> {
  const previousScenes = typeof options === "object" ? options.previousScenes : undefined;

  const key = cacheKey(userRequest + (previousScenes?.join("|") ?? ""));
  const cached = imageCache.get(key);
  if (cached) return cached;

  let hfPrompt: string;
  let negativePrompt: string;

  try {
    const geminiResult = await generateColoringPrompt(userRequest, previousScenes);
    hfPrompt = buildHuggingFacePrompt(geminiResult);
    negativePrompt = buildNegativePrompt(geminiResult);
  } catch {
    const fallback = buildFallbackPrompt(userRequest);
    hfPrompt = buildHuggingFacePrompt(fallback);
    negativePrompt = buildNegativePrompt(fallback);
  }

  const buf = await generateColoringImage(hfPrompt, negativePrompt);

  imageCache.set(key, buf);
  if (imageCache.size > 100) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }

  return buf;
}
