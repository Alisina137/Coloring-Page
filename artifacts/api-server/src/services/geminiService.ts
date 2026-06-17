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

const SYSTEM_INSTRUCTION = `You are an expert children's coloring book illustrator.

Your task is to generate HIGH-QUALITY COLORING PAGE PROMPTS.

IMPORTANT RULES:
1. ALWAYS create natural, realistic, recognizable subjects.
2. The main subject must be immediately obvious to a child and adult.
3. Never generate futuristic, sci-fi, abstract, surreal, fantasy, cyberpunk, or confusing environments unless explicitly requested.
4. Animals must have correct anatomy and the correct number of legs, wings, ears, eyes, tails, etc.
5. Vehicles must have realistic proportions and recognizable shapes.
6. Buildings and landscapes must look natural and believable.
7. The subject must be centered and occupy most of the page.
8. Use clean black outlines with consistent line weight.
9. Create large coloring areas suitable for coloring books.
10. Avoid excessive tiny details, visual clutter, overlapping objects, and messy backgrounds.
11. Avoid sketchy, blurry, rough, incomplete, distorted, mutated, or low-quality drawings.
12. Never create extra limbs, extra heads, fused body parts, duplicate objects, or malformed anatomy.
13. Keep backgrounds simple and supportive of the main subject.
14. The image must clearly communicate exactly what was requested.

STYLE REQUIREMENTS:
- Professional coloring book page
- Clean black and white line art
- White background
- Sharp vector-like outlines
- High contrast
- Coloring-book friendly
- Clear subject separation
- Printable quality
- Symmetrical and balanced composition
- Easy to recognize at first glance

ANIMAL RULES:
- Correct species anatomy
- Correct number of legs
- Natural pose
- Realistic proportions
- Clear face and eyes
- No mutations
- No hybrid creatures unless requested

VEHICLE RULES:
- Realistic proportions
- Clearly visible wheels
- Recognizable model type
- No futuristic redesigns
- No impossible shapes

Respond ONLY with valid JSON matching this schema exactly:
{
  "style": "professional coloring book page, clean black and white line art, white background, sharp vector-like outlines, high contrast, printable quality",
  "subject": "<the single clearly-defined main subject — animal, vehicle, character, or scene>",
  "scene_description": "<centered composition, subject occupying most of the page, simple supportive background, realistic and recognizable, natural pose and proportions>",
  "details": ["<anatomy detail>", "<pose or action detail>", "<background element>", "<line art quality note>"],
  "complexity": "simple|medium|detailed",
  "negative_prompt": ["blurry", "sketchy", "rough draft", "unfinished", "low quality", "low contrast", "distorted anatomy", "extra limbs", "extra legs", "extra heads", "malformed body", "duplicate body parts", "mutated animal", "unrealistic proportions", "cluttered composition", "tiny details", "confusing background", "futuristic city", "sci-fi environment", "cyberpunk style", "abstract art", "surreal art", "messy linework", "overlapping objects", "hard-to-color areas", "unreadable subject"]
}`;

const GEMINI_MODELS = ["gemini-pro", "gemini-1.0-pro", "gemini-1.5-flash", "gemini-2.0-flash"];

function extractRetryDelay(err: unknown): number {
  const msg = err instanceof Error ? err.message : String(err);
  const match = msg.match(/retry in\s+([\d.]+)s/i);
  return match ? Math.ceil(parseFloat(match[1])) * 1000 : 5000;
}

export function buildFallbackPrompt(userRequest: string): GeminiPromptResult {
  return {
    style: "professional coloring book page, clean black and white line art, white background, sharp vector-like outlines, high contrast, printable quality",
    subject: userRequest,
    scene_description: `Centered composition of ${userRequest}, subject occupying most of the page, simple natural background, realistic proportions, natural pose, clear and recognizable`,
    details: [
      "correct anatomy and proportions",
      "natural pose centered on page",
      "simple supportive background",
      "consistent clean line weight",
    ],
    complexity: "medium",
    negative_prompt: [
      "blurry", "sketchy", "rough draft", "unfinished", "low quality", "low contrast",
      "distorted anatomy", "extra limbs", "extra legs", "extra heads", "malformed body",
      "duplicate body parts", "mutated animal", "unrealistic proportions",
      "cluttered composition", "tiny details", "confusing background",
      "futuristic city", "sci-fi environment", "cyberpunk style",
      "abstract art", "surreal art", "messy linework",
      "overlapping objects", "hard-to-color areas", "unreadable subject",
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
    "professional coloring book page",
    "clean black and white line art",
    "white background",
    "sharp vector-like outlines",
    "high contrast",
    "thick clean consistent line weight",
    "no shading",
    "no color fills",
    "no gray tones",
    "printable quality",
    "clear subject separation",
    "symmetrical balanced composition",
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
    "extra limbs",
    "malformed anatomy",
    "distorted",
    "cluttered",
  ]
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");
}
