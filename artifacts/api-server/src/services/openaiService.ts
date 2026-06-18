import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] ?? "" });

const DALLE_STYLE_SUFFIX =
  "Professional children's coloring book page. Bold outline coloring book illustration. Printable line art. Vector-style black and white. White background. Thick smooth consistent outlines. Large open coloring areas. Crisp clean lines. Printable at 8.5x11 inches. No shading, no color fills, no gray tones, no text, no watermark, no signatures. Correct anatomy.";

export type OpenAIQuotaError = { isQuota: true };

function isQuotaOrRateError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number }).status;
  return (
    status === 429 ||
    msg.toLowerCase().includes("insufficient_quota") ||
    msg.toLowerCase().includes("rate limit") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("billing")
  );
}

/**
 * Generate a coloring book page using DALL-E 3.
 * Returns a Buffer with the PNG image.
 * Throws with `isQuota: true` property when the daily limit / quota is hit
 * so the caller can fall back to another provider.
 */
export async function generateWithDalle(
  prompt: string,
  quality: "standard" | "hd" = "standard"
): Promise<Buffer> {
  const fullPrompt = `${prompt}. ${DALLE_STYLE_SUFFIX}`;

  let response;
  try {
    response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality,
      response_format: "b64_json",
    });
  } catch (err) {
    if (isQuotaOrRateError(err)) {
      const quotaErr = new Error("OpenAI quota/rate limit reached") as Error & { isQuota: boolean };
      quotaErr.isQuota = true;
      throw quotaErr;
    }
    throw err;
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("DALL-E returned no image data");

  return Buffer.from(b64, "base64");
}

const COLOR_HINT_STYLE_SUFFIX =
  "Professional children's book illustration, fully colored artwork. Vibrant saturated colors. Rich dynamic lighting and beautiful shadows. Gorgeous color palette with depth and atmosphere. Pixar-quality digital painting. Highly detailed environment. Cinematic composition. Lush vivid colors with beautiful color harmony. Children's illustration quality. Full color only — no outlines-only, no black and white, no line art.";

/**
 * Generate a full-color children's book illustration for the Color Hint.
 * This is a FRESH text-to-image generation — NOT an edit of the B&W page.
 * Produces vibrant, fully colored artwork from the same scene description.
 */
export async function generateColorIllustration(
  sceneDescription: string,
  quality: "standard" | "hd" = "standard"
): Promise<Buffer> {
  const fullPrompt = `${sceneDescription}. ${COLOR_HINT_STYLE_SUFFIX}`;

  let response;
  try {
    response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality,
      response_format: "b64_json",
    });
  } catch (err) {
    if (isQuotaOrRateError(err)) {
      const quotaErr = new Error("OpenAI quota/rate limit reached") as Error & { isQuota: boolean };
      quotaErr.isQuota = true;
      throw quotaErr;
    }
    throw err;
  }

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) throw new Error("DALL-E returned no image data for color illustration");
  return Buffer.from(b64, "base64");
}
