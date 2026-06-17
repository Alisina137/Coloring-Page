import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env["HF_API_TOKEN"] ?? "");

const MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

const COLORING_PROMPT_PREFIX =
  "professional coloring book page, clean black and white line art, white background, sharp vector-like outlines, high contrast, thick consistent line weight, no shading, no color fills, no gray tones, printable quality, clear subject separation, symmetrical balanced composition,";

const COLORING_NEGATIVE =
  "blurry, sketchy, rough draft, unfinished, low quality, low contrast, distorted anatomy, extra limbs, extra legs, extra heads, malformed body, duplicate body parts, mutated animal, unrealistic proportions, cluttered composition, tiny details, confusing background, futuristic city, sci-fi environment, cyberpunk style, abstract art, surreal art, messy linework, overlapping objects, hard-to-color areas, unreadable subject, color, shading, gradients, gray tones, realistic photo, dark background, text, watermark, filled areas, shadows, photorealistic";

async function runSDXL(prompt: string, negativePrompt: string): Promise<Buffer> {
  const blob = await hf.textToImage({
    model: MODEL,
    inputs: `${COLORING_PROMPT_PREFIX} ${prompt}`,
    parameters: {
      negative_prompt: `${COLORING_NEGATIVE}, ${negativePrompt}`,
      width: 1024,
      height: 1024,
      num_inference_steps: 30,
      guidance_scale: 7.5,
    },
  });

  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function runSDXLSimplified(prompt: string): Promise<Buffer> {
  const simplified = prompt.split(",").slice(0, 6).join(",").trim();

  const blob = await hf.textToImage({
    model: MODEL,
    inputs: `${COLORING_PROMPT_PREFIX} ${simplified}`,
    parameters: {
      negative_prompt: COLORING_NEGATIVE,
      width: 1024,
      height: 1024,
      num_inference_steps: 20,
      guidance_scale: 7.5,
    },
  });

  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Colorize an existing B&W coloring page using img2img.
 * The colorPrompt should describe the specific colors from the color guide
 * so the output matches what the guide instructs the child to use.
 */
export async function generateColoredVersion(
  bwImageBuffer: Buffer,
  colorPrompt: string
): Promise<Buffer> {
  const inputBlob = new Blob([bwImageBuffer], { type: "image/png" });

  const positivePrompt = `colorful children's book illustration, ${colorPrompt}, bright vivid colors, flat color style, cheerful, bold clean outlines, high quality`;
  const negativePrompt =
    "black and white, grayscale, monochrome, blurry, dark, scary, photorealistic, sketchy, distorted anatomy, extra limbs, low quality, watermark";

  try {
    const blob = await hf.imageToImage({
      model: MODEL,
      inputs: inputBlob,
      parameters: {
        prompt: positivePrompt,
        negative_prompt: negativePrompt,
        strength: 0.65,
        num_inference_steps: 30,
        guidance_scale: 7.5,
      },
    });
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    const blob = await hf.imageToImage({
      model: MODEL,
      inputs: inputBlob,
      parameters: {
        prompt: `colorful children's illustration, ${colorPrompt}, bright colors, cartoon style`,
        negative_prompt: "black and white, grayscale, blurry",
        strength: 0.65,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      },
    });
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export async function generateColoringImage(
  prompt: string,
  negativePrompt: string
): Promise<Buffer> {
  try {
    return await runSDXL(prompt, negativePrompt);
  } catch (firstErr) {
    try {
      return await runSDXLSimplified(prompt);
    } catch (secondErr) {
      throw new Error(
        `Hugging Face image generation failed after retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`
      );
    }
  }
}
