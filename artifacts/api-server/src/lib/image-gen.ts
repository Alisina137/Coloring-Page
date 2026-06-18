import crypto from "node:crypto";
import { Buffer } from "node:buffer";
import { generateColoringPrompt, buildHuggingFacePrompt, buildNegativePrompt, buildFallbackPrompt } from "../services/geminiService";
import { generateColoringImage } from "../services/huggingfaceService";
import { generateWithDalle } from "../services/openaiService";

const imageCache = new Map<string, Buffer>();

function cacheKey(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

export interface GenerateImageOptions {
  size?: string;
  previousScenes?: string[];
}

/**
 * Image generation pipeline:
 *  1. Gemini enhances the prompt (optional — falls back to built-in prompt builder).
 *  2. OpenAI DALL-E 3 is tried first (best quality).
 *  3. If OpenAI hits a quota/rate-limit error, HuggingFace SDXL is used.
 *  4. If HuggingFace also fails, the error is thrown.
 */
export async function generateImageBuffer(
  userRequest: string,
  options?: GenerateImageOptions | string
): Promise<Buffer> {
  const previousScenes = typeof options === "object" ? options.previousScenes : undefined;

  const key = cacheKey(userRequest + (previousScenes?.join("|") ?? ""));
  const cached = imageCache.get(key);
  if (cached) return cached;

  // Step 1 — Gemini prompt enhancement
  let hfPrompt: string;
  let negativePrompt: string;
  let dalleSubject: string;

  try {
    const geminiResult = await generateColoringPrompt(userRequest, previousScenes);
    hfPrompt = buildHuggingFacePrompt(geminiResult);
    negativePrompt = buildNegativePrompt(geminiResult);
    dalleSubject = `${geminiResult.subject}. ${geminiResult.scene_description}`;
  } catch {
    const fallback = buildFallbackPrompt(userRequest);
    hfPrompt = buildHuggingFacePrompt(fallback);
    negativePrompt = buildNegativePrompt(fallback);
    dalleSubject = userRequest;
  }

  // Step 2 — Try OpenAI DALL-E 3
  let buf: Buffer | null = null;
  let provider = "openai";

  if (process.env["OPENAI_API_KEY"]) {
    try {
      buf = await generateWithDalle(dalleSubject);
    } catch (err) {
      const isQuota = (err as { isQuota?: boolean }).isQuota;
      console.warn(
        isQuota
          ? "OpenAI quota/rate limit hit — falling back to HuggingFace"
          : `OpenAI generation failed (${err instanceof Error ? err.message : err}) — falling back to HuggingFace`
      );
      buf = null;
    }
  }

  // Step 3 — HuggingFace SDXL fallback
  if (!buf) {
    provider = "huggingface";
    buf = await generateColoringImage(hfPrompt, negativePrompt);
  }

  console.info(`Image generated via ${provider}`);

  imageCache.set(key, buf);
  if (imageCache.size > 100) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }

  return buf;
}
