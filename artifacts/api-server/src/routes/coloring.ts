import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import { db, coloringPagesTable } from "@workspace/db";
import {
  GenerateColoringPageBody,
  GetColoringHistoryQueryParams,
  DeleteColoringHistoryParams,
  GenerateColoringPageResponse,
  GetColoringHistoryResponse,
  GetColoringStatsResponse,
} from "@workspace/api-zod";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router: IRouter = Router();

const GENRES: Record<string, string> = {
  Animals: "animals — cute and friendly animals in a natural setting",
  Fantasy: "fantasy — magical creatures like dragons, unicorns, and wizards",
  "Cars & Vehicles": "cars and vehicles — cool racing cars, trucks, and machines",
  Sports: "sports — action-packed sports scene with players",
  "Nature & Landscapes": "nature and landscapes — trees, mountains, flowers, and rivers",
  Dinosaurs: "dinosaurs — friendly prehistoric dinosaurs in their world",
  "Space & Planets": "space and planets — rockets, astronauts, stars, and planets",
  "Princess & Fairy Tales": "princess and fairy tales — castles, fairies, and enchanted forests",
  Superheroes: "superheroes — brave heroes with capes and superpowers",
  "Farm Life": "farm life — barnyard animals, tractors, and rolling fields",
  "Ocean & Sea Creatures": "ocean and sea creatures — fish, dolphins, whales, and coral reefs",
  "Jungle Adventure": "jungle adventure — monkeys, toucans, and tropical plants",
  "Robots & Sci-Fi": "robots and sci-fi — friendly robots and futuristic technology",
  "Holiday Themes": "holiday themes — festive holiday decorations and characters",
  "Myths & Legends": "myths and legends — legendary creatures from ancient stories",
  "School & Education Scenes": "school and education — classroom, books, pencils, and learning",
  "Food & Sweets": "food and sweets — cakes, cupcakes, fruits, and tasty treats",
  Transportation: "transportation — trains, planes, boats, and vehicles",
  "Cute Cartoon Characters": "cute cartoon characters — adorable animated characters",
  "Daily Life Scenes": "daily life scenes — children playing, families, and everyday activities",
};

router.post("/coloring/generate", async (req, res): Promise<void> => {
  const parsed = GenerateColoringPageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { gender, genre, ageGroup, description } = parsed.data;
  const genreDescription = GENRES[genre] ?? genre;
  const genderAdjective =
    gender === "Boy"
      ? "boy-friendly"
      : gender === "Girl"
        ? "girl-friendly"
        : "child-friendly";

  const ageDescription =
    ageGroup === "3-5"
      ? "very few elements, maximum 3-4 large simple objects, huge bold shapes, absolutely no fine details or small parts"
      : ageGroup === "6-8"
        ? "moderate number of elements, medium-sized shapes with some secondary details, clear distinct regions"
        : "many elements, rich scene with fine details, small intricate parts, layered composition";

  const customPart = description ? ` Specifically featuring: ${description}.` : "";

  const prompt = `A vibrant flat-color children's cartoon illustration. ${genderAdjective} ${genreDescription} theme with a full natural background and environment — sky, ground, setting — preserved and richly colored.${customPart} Detail level: ${ageDescription}. Bold thick black outlines with distinct flat color regions. No gradients, no shading, no textures. Bright cheerful saturated colors. Kid-friendly cartoon style suitable as a coloring page reference.`;

  req.log.info({ gender, genre, ageGroup, description }, "Generating coloring page");

  const imageBuffer = await generateImageBuffer(prompt, "1024x1024");
  const imageData = imageBuffer.toString("base64");

  const [page] = await db
    .insert(coloringPagesTable)
    .values({ gender, genre, ageGroup, description: description ?? null, imageData })
    .returning();

  res.json(GenerateColoringPageResponse.parse(page));
});

router.get("/coloring/history", async (req, res): Promise<void> => {
  const params = GetColoringHistoryQueryParams.safeParse(req.query);
  const limit = params.success ? params.data.limit : 20;

  const pages = await db
    .select()
    .from(coloringPagesTable)
    .orderBy(desc(coloringPagesTable.createdAt))
    .limit(limit);

  res.json(GetColoringHistoryResponse.parse(pages));
});

router.delete("/coloring/history/:id", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteColoringHistoryParams.safeParse({ id: parseInt(rawId, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(coloringPagesTable)
    .where(eq(coloringPagesTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Coloring page not found" });
    return;
  }

  res.sendStatus(204);
});

router.get("/coloring/stats", async (_req, res): Promise<void> => {
  const totalResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(coloringPagesTable);

  const total = totalResult[0]?.count ?? 0;

  const byGenreResult = await db
    .select({
      label: coloringPagesTable.genre,
      count: sql<number>`count(*)::int`,
    })
    .from(coloringPagesTable)
    .groupBy(coloringPagesTable.genre)
    .orderBy(desc(sql`count(*)`));

  const byGenderResult = await db
    .select({
      label: coloringPagesTable.gender,
      count: sql<number>`count(*)::int`,
    })
    .from(coloringPagesTable)
    .groupBy(coloringPagesTable.gender)
    .orderBy(desc(sql`count(*)`));

  res.json(
    GetColoringStatsResponse.parse({
      total,
      byGenre: byGenreResult,
      byGender: byGenderResult,
    })
  );
});

export default router;
