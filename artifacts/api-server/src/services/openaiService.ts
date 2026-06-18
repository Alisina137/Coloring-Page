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
export async function generateWithDalle(prompt: string): Promise<Buffer> {
  const fullPrompt = `${prompt}. ${DALLE_STYLE_SUFFIX}`;

  let response;
  try {
    response = await client.images.generate({
      model: "dall-e-3",
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
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

/**
 * Colorize an existing B&W image using DALL-E edit (img variation approach).
 * Prompt is built from the color guide steps.
 * Falls back gracefully; throws with isQuota on quota errors.
 */
export async function colorizeWithDalle(
  bwImageBuffer: Buffer,
  colorPrompt: string
): Promise<Buffer> {
  const editPrompt = `Add bright, vivid colors to this coloring book page. ${colorPrompt}. Keep the same composition, outlines and shapes. Flat color children's book illustration style. No new elements.`;

  try {
    const file = await OpenAI.toFile(bwImageBuffer, "coloring-page.png", { type: "image/png" });

    const response = await client.images.edit({
      model: "dall-e-2",
      image: file,
      prompt: editPrompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("DALL-E edit returned no image data");

    return Buffer.from(b64, "base64");
  } catch (err) {
    if (isQuotaOrRateError(err)) {
      const quotaErr = new Error("OpenAI quota/rate limit reached") as Error & { isQuota: boolean };
      quotaErr.isQuota = true;
      throw quotaErr;
    }
    throw err;
  }
}
