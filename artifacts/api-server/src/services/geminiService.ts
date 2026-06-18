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

const SYSTEM_INSTRUCTION = `You are an expert coloring book illustrator.

Generate a HIGH-QUALITY coloring book page based on the user's topic.

STRICT REQUIREMENTS:
- Create clean black-and-white line art only.
- No colors, shading, gradients, shadows, or grayscale.
- Thick, smooth, consistent outlines.
- Large open spaces suitable for coloring.
- Clear and recognizable subject.
- Simple background elements only when relevant.
- Child-friendly and family-friendly.
- Correct anatomy and proportions.
- No extra limbs, missing limbs, or distorted body parts.
- No text, captions, watermarks, logos, or signatures.
- No sketch style, pencil style, rough lines, or hand-drawn imperfections.
- Center the main subject prominently.
- Use a white background.
- Coloring book quality suitable for printing at 8.5 x 11 inches.
- Avoid excessive details that make coloring difficult.
- Ensure every object is fully visible and clearly separated.
- Use crisp vector-style line art.

QUALITY CHECK (verify before generating):
1. The subject is immediately recognizable.
2. Animals have the correct number of legs and body parts.
3. Vehicles have realistic structure and proportions.
4. The composition is balanced and uncluttered.
5. The image contains only black outlines on a white background.

OUTPUT STYLE:
Professional children's coloring book page, bold outline coloring book illustration, printable line art, vector-style black and white.

Respond ONLY with valid JSON matching this schema exactly:
{
  "style": "professional children's coloring book page, bold outline coloring book illustration, printable line art, vector-style black and white, white background",
  "subject": "<single clearly-defined main subject — animal, vehicle, character, or scene, immediately recognizable>",
  "scene_description": "<centered composition, subject occupying most of page, correct anatomy, balanced and uncluttered, simple background only if relevant>",
  "details": ["<anatomy/proportion detail>", "<pose or action>", "<background element if any>", "<line art quality note>"],
  "complexity": "simple|medium|detailed",
  "negative_prompt": ["color", "shading", "gradients", "shadows", "grayscale", "gray tones", "sketch style", "pencil style", "rough lines", "hand-drawn imperfections", "text", "captions", "watermarks", "logos", "signatures", "extra limbs", "missing limbs", "distorted body parts", "extra heads", "malformed anatomy", "unrealistic proportions", "cluttered composition", "excessive details", "blurry", "low quality", "low contrast", "messy linework", "unrecognizable subject", "dark background", "filled areas", "photorealistic", "sci-fi", "cyberpunk", "abstract", "surreal"]
}`;

const GEMINI_MODELS = ["gemini-pro", "gemini-1.0-pro", "gemini-1.5-flash", "gemini-2.0-flash"];

function extractRetryDelay(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry in\s+([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : 5000;
}

export function buildFallbackPrompt(userRequest: string): GeminiPromptResult {
  return {
    style: "professional children's coloring book page, bold outline coloring book illustration, printable line art, vector-style black and white, white background",
    subject: userRequest,
    scene_description: `Centered composition of ${userRequest}, subject occupying most of the page, correct anatomy and proportions, balanced uncluttered layout, simple background`,
    details: [
      "correct anatomy with proper number of limbs",
      "natural centered pose",
      "simple supportive background only if relevant",
      "thick smooth consistent vector-style outlines",
    ],
    complexity: "medium",
    negative_prompt: [
      "color", "shading", "gradients", "shadows", "grayscale", "gray tones",
      "sketch style", "pencil style", "rough lines", "hand-drawn imperfections",
      "text", "captions", "watermarks", "logos", "signatures",
      "extra limbs", "missing limbs", "distorted body parts", "extra heads", "malformed anatomy",
      "unrealistic proportions", "cluttered composition", "excessive details",
      "blurry", "low quality", "low contrast", "messy linework",
      "unrecognizable subject", "dark background", "filled areas", "photorealistic",
      "sci-fi", "cyberpunk", "abstract", "surreal",
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

  let prompt = `Generate a coloring book image prompt for: ${userRequest}`;

  if (previousScenes && previousScenes.length > 0) {
    prompt += `\n\nFor consistency with previous pages, maintain the same characters and art style as:\n${previousScenes.map((s, i) => `Page ${i + 1}: ${s}`).join("\n")}`;
    prompt += `\n\nThis is page ${previousScenes.length + 1}. Keep the same main characters, correct anatomy, and visual style.`;
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
    "professional children's coloring book page",
    "bold outline coloring book illustration",
    "printable line art",
    "vector-style black and white",
    "white background",
    "thick smooth consistent outlines",
    "large open coloring areas",
    "no shading",
    "no color fills",
    "no gray tones",
    "no text",
    "no watermark",
    "crisp clean lines",
    "8.5x11 printable quality",
    gemini.subject,
    gemini.scene_description,
    detailStr,
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
    "shadows",
    "grayscale",
    "gray tones",
    "sketch style",
    "pencil style",
    "rough lines",
    "hand-drawn imperfections",
    "text",
    "watermark",
    "logo",
    "signature",
    "extra limbs",
    "malformed anatomy",
    "distorted",
    "cluttered",
    "excessive details",
    "blurry",
    "low quality",
    "filled areas",
    "photorealistic",
    "realistic photo",
    "dark background",
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}
