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

const SYSTEM_INSTRUCTION = `You are an expert coloring book designer specializing in creating prompts for black and white line art suitable for KDP coloring books.

When given a user's coloring book request, generate a structured JSON prompt optimized for AI image generation.

Rules:
- Images must be BLACK AND WHITE line art ONLY
- Clean thick outlines, no shading, no gradients, no gray tones
- White background with empty spaces ready to be colored
- Suitable for printing, age-appropriate complexity
- No text inside images, no photorealistic elements

Respond ONLY with valid JSON:
{
  "style": "clean black and white coloring book line art",
  "subject": "<main character or object>",
  "scene_description": "<detailed scene description>",
  "details": ["<detail 1>", "<detail 2>", "<detail 3>"],
  "complexity": "simple|medium|detailed",
  "negative_prompt": ["color", "shading", "shadows", "photorealistic", "grayscale", "blurry", "filled areas", "dark background"]
}`;

const GEMINI_MODELS = ["gemini-pro", "gemini-1.0-pro", "gemini-1.5-flash", "gemini-2.0-flash"];

function extractRetryDelay(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry in\s+([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : 5000;
}

export function buildFallbackPrompt(userRequest: string): GeminiPromptResult {
  return {
    style: "clean black and white coloring book line art",
    subject: userRequest,
    scene_description: `A detailed coloring book scene featuring ${userRequest} with clear empty spaces for coloring`,
    details: [
      "thick bold outlines",
      "white background",
      "printable quality",
      "child-friendly design",
    ],
    complexity: "medium",
    negative_prompt: [
      "color",
      "shading",
      "shadows",
      "photorealistic",
      "grayscale",
      "blurry",
      "filled areas",
      "dark background",
      "text",
      "watermark",
    ],
  };
}

async function callGemini(
  model: string,
  userRequest: string,
  previousScenes?: string[]
): Promise<GeminiPromptResult> {
  const geminiModel = genAI.getGenerativeModel({
    model,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  let prompt = `Create a coloring book image prompt for: ${userRequest}`;

  if (previousScenes && previousScenes.length > 0) {
    prompt += `\n\nFor consistency with previous pages, maintain the same characters and art style as:\n${previousScenes.map((s, i) => `Page ${i + 1}: ${s}`).join("\n")}`;
    prompt += `\n\nThis is page ${previousScenes.length + 1}. Keep the same main characters and visual style.`;
  }

  const result = await geminiModel.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Gemini did not return valid JSON");

  return JSON.parse(jsonMatch[0]) as GeminiPromptResult;
}

export async function generateColoringPrompt(
  userRequest: string,
  previousScenes?: string[]
): Promise<GeminiPromptResult> {
  for (const model of GEMINI_MODELS) {
    try {
      return await callGemini(model, userRequest, previousScenes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
        const delay = extractRetryDelay(err);
        await new Promise((r) => setTimeout(r, delay));
        try {
          return await callGemini(model, userRequest, previousScenes);
        } catch {
          continue;
        }
      }

      if (
        msg.includes("404") ||
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("not supported")
      ) {
        continue;
      }

      continue;
    }
  }

  console.warn("All Gemini models failed — using fallback prompt builder");
  return buildFallbackPrompt(userRequest);
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
