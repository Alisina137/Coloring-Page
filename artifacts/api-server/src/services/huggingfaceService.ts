import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env["HF_API_TOKEN"] ?? "");

const MODEL = "black-forest-labs/FLUX.1-schnell";

async function runHuggingFace(
  prompt: string,
  _negativePrompt: string
): Promise<Buffer> {
  const blob = await hf.textToImage({
    model: MODEL,
    inputs: prompt,
    parameters: {
      width: 1024,
      height: 1024,
      num_inference_steps: 4,
    },
  });

  const arrayBuffer = await blob.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function runHuggingFaceSimplified(prompt: string): Promise<Buffer> {
  const simplified = prompt
    .split(",")
    .slice(0, 8)
    .join(",")
    .trim();

  const blob = await hf.textToImage({
    model: MODEL,
    inputs: `coloring book page, black and white line art, thick outlines, ${simplified}`,
    parameters: {
      width: 1024,
      height: 1024,
      num_inference_steps: 4,
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
    return await runHuggingFace(prompt, negativePrompt);
  } catch (firstErr) {
    try {
      return await runHuggingFaceSimplified(prompt);
    } catch (secondErr) {
      throw new Error(
        `Hugging Face image generation failed after retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`
      );
    }
  }
}
