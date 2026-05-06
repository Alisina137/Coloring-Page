import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, dailyChallengesTable } from "@workspace/db";
import { generateImageBuffer } from "../lib/image-gen";

const router: IRouter = Router();

const DAILY_GENRES = [
  "Animals", "Fantasy", "Nature & Landscapes", "Dinosaurs", "Space & Planets",
  "Ocean & Sea Creatures", "Jungle Adventure", "Farm Life", "Food & Sweets",
  "Robots & Sci-Fi", "Princess & Fairy Tales", "Superheroes",
];
const DAILY_THEMES = [
  "a happy sunny morning", "a magical forest clearing", "an underwater kingdom",
  "a friendly neighborhood", "a colorful market", "a cozy winter scene",
  "a summer picnic", "a rainy day adventure", "a moonlit night",
  "a birthday celebration", "a garden in bloom", "a snowy mountain",
];

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function deterministicPick<T>(arr: T[], seed: string): T {
  let hash = 0;
  for (const c of seed) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return arr[hash % arr.length];
}

router.get("/daily/challenge", async (req, res): Promise<void> => {
  const today = todayStr();

  const existing = await db.select().from(dailyChallengesTable).where(eq(dailyChallengesTable.challengeDate, today));
  if (existing.length > 0) {
    res.json(existing[0]);
    return;
  }

  const genre = deterministicPick(DAILY_GENRES, today + "genre");
  const theme = deterministicPick(DAILY_THEMES, today + "theme");

  req.log.info({ today, genre, theme }, "Generating daily challenge");

  const imageBuffer = await generateImageBuffer(
    `A vibrant flat-color children's cartoon illustration. ${genre} theme. Scene: ${theme}. Moderate number of elements, medium-sized shapes. Full natural background. Bold thick black outlines with distinct flat color regions. No gradients, no shading. Bright cheerful saturated colors. Kid-friendly cartoon style.`,
    "1024x1024"
  );

  const [challenge] = await db.insert(dailyChallengesTable).values({
    challengeDate: today,
    genre,
    theme,
    imageData: imageBuffer.toString("base64"),
  }).returning();

  res.json(challenge);
});

export default router;
