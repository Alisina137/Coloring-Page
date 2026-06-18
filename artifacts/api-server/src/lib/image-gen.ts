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
  quality?: "fast" | "balanced" | "premium";
}

/**
 * Image generation pipeline with quality tiers:
 *
 * fast     — skip Gemini, use fallback prompt, try DALL-E standard → HF (15 steps)
 * balanced — Gemini + DALL-E standard → HF (25 steps)  [default]
 * premium  — Gemini + DALL-E HD → HF (40 steps)
 */
export async function generateImageBuffer(
  userRequest: string,
  options?: GenerateImageOptions | string
): Promise<Buffer> {
  const q = (typeof options === "object" ? options.quality : undefined) ?? "balanced";
  const previousScenes = typeof options === "object" ? options.previousScenes : undefined;

  const stepsMap: Record<string, number> = { fast: 15, balanced: 25, premium: 40 };
  const steps = stepsMap[q] ?? 25;

  const key = cacheKey(userRequest + (previousScenes?.join("|") ?? "") + q);
  const cached = imageCache.get(key);
  if (cached) return cached;

  let hfPrompt: string;
  let negativePrompt: string;
  let dalleSubject: string;

  if (q === "fast") {
    const fallback = buildFallbackPrompt(userRequest);
    hfPrompt = buildHuggingFacePrompt(fallback);
    negativePrompt = buildNegativePrompt(fallback);
    dalleSubject = userRequest;
  } else {
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
  }

  const dalleQuality = q === "premium" ? "hd" : "standard";
  let buf: Buffer | null = null;
  let provider = "openai";

  if (process.env["OPENAI_API_KEY"]) {
    try {
      buf = await generateWithDalle(dalleSubject, dalleQuality);
    } catch (err) {
      const isQuota = (err as { isQuota?: boolean }).isQuota;
      console.warn(
        isQuota
          ? "OpenAI quota/rate limit hit — falling back to HuggingFace"
          : `OpenAI generation failed — falling back to HuggingFace`
      );
      buf = null;
    }
  }

  if (!buf) {
    provider = "huggingface";
    buf = await generateColoringImage(hfPrompt, negativePrompt, steps);
  }

  console.info(`Image generated via ${provider} (quality: ${q}, steps: ${steps})`);

  imageCache.set(key, buf);
  if (imageCache.size > 100) {
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }

  return buf;
}
