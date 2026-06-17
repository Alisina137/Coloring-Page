import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env["HF_API_TOKEN"] ?? "");

const MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

const COLORING_PROMPT_PREFIX =
  "black and white coloring book page, clean thick outlines, no shading, no color fills, white background, printable quality, line art only,";

const COLORING_NEGATIVE =
  "color, shading, gradients, gray tones, realistic photo, blurry, dark background, text, watermark, filled areas, shadows, photorealistic";

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
