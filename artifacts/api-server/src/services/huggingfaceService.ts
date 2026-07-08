import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env["HF_API_TOKEN"] ?? "");

const MODEL = "stabilityai/stable-diffusion-xl-base-1.0";

// ─── B&W Coloring Page ───────────────────────────────────────────────────────

const COLORING_PROMPT_PREFIX =
  "professional children's coloring book page, bold outline coloring book illustration, printable line art, vector-style black and white, white background, thick smooth consistent outlines, large open coloring areas, crisp clean lines, 8.5x11 printable quality, no shading, no color fills, no gray tones, no text, no watermark,";

const COLORING_NEGATIVE =
  "color, shading, gradients, shadows, grayscale, gray tones, sketch style, pencil style, rough lines, hand-drawn imperfections, text, captions, watermarks, logos, signatures, extra limbs, missing limbs, distorted body parts, extra heads, malformed anatomy, unrealistic proportions, cluttered composition, excessive details, blurry, low quality, low contrast, messy linework, unrecognizable subject, dark background, filled areas, photorealistic, realistic photo, sci-fi, cyberpunk, abstract, surreal, unfinished, rough draft";

async function runSDXL(prompt: string, negativePrompt: string, steps = 30): Promise<Buffer> {
  const blob = await hf.textToImage(
    {
      model: MODEL,
      inputs: `${COLORING_PROMPT_PREFIX} ${prompt}`,
      parameters: {
        negative_prompt: `${COLORING_NEGATIVE}, ${negativePrompt}`,
        width: 1024,
        height: 1024,
        num_inference_steps: steps,
        guidance_scale: 7.5,
      },
    },
    { outputType: "blob" }
  );
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function runSDXLSimplified(prompt: string): Promise<Buffer> {
  const simplified = prompt.split(",").slice(0, 6).join(",").trim();
  const blob = await hf.textToImage(
    {
      model: MODEL,
      inputs: `${COLORING_PROMPT_PREFIX} ${simplified}`,
      parameters: {
        negative_prompt: COLORING_NEGATIVE,
        width: 1024,
        height: 1024,
        num_inference_steps: 20,
        guidance_scale: 7.5,
      },
    },
    { outputType: "blob" }
  );
  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function generateColoringImage(
  prompt: string,
  negativePrompt: string,
  steps = 30
): Promise<Buffer> {
  try {
    return await runSDXL(prompt, negativePrompt, steps);
  } catch {
    try {
      return await runSDXLSimplified(prompt);
    } catch (secondErr) {
      throw new Error(
        `Hugging Face B&W generation failed after retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`
      );
    }
  }
}

// ─── Color Illustration (Color Hint) ─────────────────────────────────────────

const COLOR_ILLUSTRATION_PREFIX =
  "professional children's book illustration, fully colored artwork, vibrant saturated colors, beautiful rich lighting, gorgeous color palette, depth and atmosphere, detailed environment, children's storybook digital painting, Pixar-quality color styling, beautiful color harmony, lush and vivid colors, cinematic composition, highly detailed,";

const COLOR_ILLUSTRATION_NEGATIVE =
  "black and white, monochrome, grayscale, line art only, coloring book outline, sketch, no color, watermark, text, blurry, low quality, ugly, distorted anatomy, extra limbs, missing limbs";

/**
 * Generate a FRESH full-color children's book illustration as the Color Hint.
 * This is a brand-new text-to-image generation — NOT img2img of the B&W page.
 */
export async function generateColorIllustrationHF(prompt: string, steps = 25): Promise<Buffer> {
  try {
    const blob = await hf.textToImage(
      {
        model: MODEL,
        inputs: `${COLOR_ILLUSTRATION_PREFIX} ${prompt}`,
        parameters: {
          negative_prompt: COLOR_ILLUSTRATION_NEGATIVE,
          width: 1024,
          height: 1024,
          num_inference_steps: steps,
          guidance_scale: 8.5,
        },
      },
      { outputType: "blob" }
    );
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    const simplified = prompt.split(",").slice(0, 8).join(",").trim();
    const blob = await hf.textToImage(
      {
        model: MODEL,
        inputs: `${COLOR_ILLUSTRATION_PREFIX} ${simplified}`,
        parameters: {
          negative_prompt: COLOR_ILLUSTRATION_NEGATIVE,
          width: 1024,
          height: 1024,
          num_inference_steps: 20,
          guidance_scale: 8.0,
        },
      },
      { outputType: "blob" }
    );
    const arrayBuffer = await blob.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
