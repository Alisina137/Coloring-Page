import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env["GEMINI_API_KEY"] ?? "");

export interface GeminiPromptResult {
  style: string;
  subject: string;
  scene_description: string;
  details: string[];
  complexity: string;
  negative_prompt: string[];
}

const SYSTEM_INSTRUCTION = `You are an expert coloring book designer specializing in creating prompts for black and white line art suitable for KDP (Kindle Direct Publishing) coloring books.

When given a user's coloring book request, you generate a structured JSON prompt optimized for AI image generation.

Rules:
- Images must be BLACK AND WHITE line art ONLY
- Clean thick outlines, no shading, no gradients, no gray tones
- White background with empty spaces ready to be colored
- Suitable for printing
- Age-appropriate complexity
- No text inside images
- No photorealistic elements

Respond ONLY with valid JSON matching this schema exactly:
{
  "style": "clean black and white coloring book line art",
  "subject": "<main character or object>",
  "scene_description": "<detailed scene description>",
  "details": ["<detail 1>", "<detail 2>", "<detail 3>"],
  "complexity": "simple|medium|detailed",
  "negative_prompt": ["color", "shading", "shadows", "photorealistic", "grayscale", "blurry", "filled areas", "dark background"]
}`;

async function callGemini(
  userRequest: string,
  previousScenes?: string[]
): Promise<GeminiPromptResult> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  let prompt = `Create a coloring book image prompt for: ${userRequest}`;

  if (previousScenes && previousScenes.length > 0) {
    prompt += `\n\nFor consistency with previous pages in this coloring book, maintain the same characters and art style as these previous scenes:\n${previousScenes.map((s, i) => `Page ${i + 1}: ${s}`).join("\n")}`;
    prompt += `\n\nThis is page ${previousScenes.length + 1}. Keep the same main characters and overall visual style.`;
  }

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Gemini did not return valid JSON");
  }

  return JSON.parse(jsonMatch[0]) as GeminiPromptResult;
}

export async function generateColoringPrompt(
  userRequest: string,
  previousScenes?: string[]
): Promise<GeminiPromptResult> {
  try {
    return await callGemini(userRequest, previousScenes);
  } catch (firstErr) {
    try {
      return await callGemini(userRequest, previousScenes);
    } catch (secondErr) {
      throw new Error(
        `Gemini prompt generation failed after retry: ${secondErr instanceof Error ? secondErr.message : String(secondErr)}`
      );
    }
  }
}

export function buildHuggingFacePrompt(gemini: GeminiPromptResult): string {
  const detailStr = gemini.details.join(", ");
  return [
    "coloring book page",
    "black and white line art",
    "thick clean outlines",
    "no shading",
    "no color fills",
    "white background",
    "printable quality",
    gemini.subject,
    gemini.scene_description,
    detailStr,
    gemini.style,
  ]
    .filter(Boolean)
    .join(", ");
}

export function buildNegativePrompt(gemini: GeminiPromptResult): string {
  return [
    ...gemini.negative_prompt,
    "color",
    "shading",
    "gradients",
    "gray tones",
    "realistic photo",
    "blurry",
    "dark background",
    "text",
    "watermark",
    "filled areas",
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}
