import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { generateColoringPrompt, buildHuggingFacePrompt, buildNegativePrompt } from "../services/geminiService";
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
 * Generate a coloring-book line art image using Gemini (prompt) + Hugging Face (image).
 * Gemini analyzes the user request and creates an optimized structured prompt.
 * Hugging Face generates the final black-and-white coloring page image.
 * Includes in-memory caching (by prompt hash) and retry logic for both services.
 */
export async function generateImageBuffer(
  userRequest: string,
  options?: GenerateImageOptions | string
): Promise<Buffer> {
  const previousScenes = typeof options === "object" ? options.previousScenes : undefined;

  const key = cacheKey(userRequest + (previousScenes?.join("|") ?? ""));
  const cached = imageCache.get(key);
  if (cached) return cached;

  const geminiResult = await generateColoringPrompt(userRequest, previousScenes);
  const hfPrompt = buildHuggingFacePrompt(geminiResult);
  const negativePrompt = buildNegativePrompt(geminiResult);

  const buf = await generateColoringImage(hfPrompt, negativePrompt);

  imageCache.set(key, buf);
  if (imageCache.size > 100) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }

  return buf;
}
