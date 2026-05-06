import Replicate from "replicate";
import crypto from "node:crypto";
import { Buffer } from "node:buffer";

const replicate = new Replicate({
  auth: process.env["REPLICATE_API_TOKEN"],
});

const COLORING_SUFFIX =
  "black and white coloring page, outline only, no shading, thick bold outlines, simple clean line art, white background, printable, for kids, no color fills, no gray tones";

const imageCache = new Map<string, Buffer>();

function cacheKey(prompt: string): string {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

async function runReplicate(prompt: string): Promise<Buffer> {
  const enhancedPrompt = `${prompt}, ${COLORING_SUFFIX}`;
  const negativePrompt =
    "color, shading, gradients, watermark, text, realistic photo, blurry, dark background";

  const output = await replicate.run("stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e0ccecfc10ca9131e42b6dce" as `${string}/${string}:${string}`, {
    input: {
      prompt: enhancedPrompt,
      negative_prompt: negativePrompt,
      width: 1024,
      height: 1024,
      num_outputs: 1,
      scheduler: "K_EULER",
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  });

  const urls = output as string[];
  const imageUrl = urls[0];
  if (!imageUrl) throw new Error("Replicate returned no image URL");

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch Replicate image: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Generate a coloring-page-optimized image using Replicate SDXL.
 * Prompt is automatically enhanced with coloring-page instructions.
 * Includes in-memory caching (by prompt hash) and one retry on failure.
 */
export async function generateImageBuffer(
  prompt: string,
  _size?: string
): Promise<Buffer> {
  const key = cacheKey(prompt);

  const cached = imageCache.get(key);
  if (cached) return cached;

  try {
    const buf = await runReplicate(prompt);
    imageCache.set(key, buf);
    if (imageCache.size > 100) {
      const firstKey = imageCache.keys().next().value;
      if (firstKey) imageCache.delete(firstKey);
    }
    return buf;
  } catch (firstErr) {
    try {
      const buf = await runReplicate(prompt);
      imageCache.set(key, buf);
      return buf;
    } catch (secondErr) {
      throw new Error(
        `Image generation failed after retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`
      );
    }
  }
}
