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
import { generateImageBuffer } from "../lib/image-gen";

const router: IRouter = Router();

const GENRES: Record<string, string> = {
  Animals: "cute and friendly animals in a natural setting",
  Fantasy: "magical creatures like dragons, unicorns, and wizards",
  "Cars & Vehicles": "cool racing cars, trucks, and machines",
  Sports: "action-packed sports scene with players",
  "Nature & Landscapes": "trees, mountains, flowers, and rivers",
  Dinosaurs: "friendly prehistoric dinosaurs in their world",
  "Space & Planets": "rockets, astronauts, stars, and planets",
  "Princess & Fairy Tales": "castles, fairies, and enchanted forests",
  Superheroes: "brave heroes with capes and superpowers",
  "Farm Life": "barnyard animals, tractors, and rolling fields",
  "Ocean & Sea Creatures": "fish, dolphins, whales, and coral reefs",
  "Jungle Adventure": "monkeys, toucans, and tropical plants",
  "Robots & Sci-Fi": "friendly robots and futuristic technology",
  "Holiday Themes": "festive holiday decorations and characters",
  "Myths & Legends": "legendary creatures from ancient stories",
  "School & Education Scenes": "classroom, books, pencils, and learning",
  "Food & Sweets": "cakes, cupcakes, fruits, and tasty treats",
  Transportation: "trains, planes, boats, and vehicles",
  "Cute Cartoon Characters": "adorable animated characters",
  "Daily Life Scenes": "children playing, families, and everyday activities",
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
      ? "very simple, 3-4 large bold shapes, minimal details, suitable for toddlers"
      : ageGroup === "6-8"
        ? "moderate complexity, clear distinct regions, some secondary details"
        : "detailed composition, fine elements, layered scene, suitable for older children";

  const customPart = description ? ` Featuring: ${description}.` : "";

  const userRequest = `A ${genderAdjective} coloring book page with ${genreDescription} theme.${customPart} Complexity: ${ageDescription}. Age group: ${ageGroup} years old.`;

  req.log.info({ gender, genre, ageGroup, description }, "Generating coloring page");

  const imageBuffer = await generateImageBuffer(userRequest);
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

const COLOR_GUIDES: Record<string, string[]> = {
  Animals: ["Color the sky light blue", "Color the grass bright green", "Color the main animal with warm fur tones — brown, orange, or tan", "Add yellow and orange to the sunlight areas", "Color any flowers or plants with bright cheerful colors"],
  Fantasy: ["Color the sky purple and dark blue for a magical feel", "Color magical creatures with vivid colors — gold, silver, or rainbow", "Paint the castle walls light grey and the rooftop purple", "Color any stars or sparkles bright yellow", "Fill the background forest with deep greens and teals"],
  "Cars & Vehicles": ["Color the sky light blue with white clouds", "Paint the main vehicle a bold red, blue, or yellow", "Color the wheels and tires dark grey or black", "Add orange and yellow for headlights and details", "Color the road grey and add yellow road markings"],
  Sports: ["Color the sky a bright cheerful blue", "Paint the players' uniforms in your favorite team colors", "Color the ball with its classic colors — white and black for soccer, orange for basketball", "Add green for the grass or court", "Color the crowd and background with fun bright shades"],
  "Nature & Landscapes": ["Color the sky blue with fluffy white clouds", "Paint the mountains purple and grey", "Color the trees with deep and light green", "Add brown for tree trunks and paths", "Color any flowers red, yellow, orange, or pink"],
  Dinosaurs: ["Color the sky orange and yellow for a prehistoric sunrise", "Paint the main dinosaur green, with a lighter belly", "Color plants and ferns in dark and bright greens", "Add brown for rocks and the muddy ground", "Use purple and red for any berries or small details"],
  "Space & Planets": ["Color the background deep black for outer space", "Paint the planets in bold colors — blue, red, orange, or ringed Saturn yellow", "Color the rocket silver and red with yellow flames", "Add tiny white and yellow dots for the stars", "Color the astronaut suit white with gold visor"],
  "Princess & Fairy Tales": ["Color the sky pink and lavender for a fairy-tale dawn", "Paint the princess dress a beautiful blue, pink, or gold", "Color the castle light purple with glittering windows", "Add green and teal to the magical forest", "Color flowers and hearts in red, pink, and yellow"],
  Superheroes: ["Color the sky dark blue for an action-packed scene", "Paint the hero's costume in bold primary colors — red, blue, or yellow", "Color the cape a contrasting bold shade", "Add bright yellow or orange for energy blasts and stars", "Color the city buildings grey with yellow glowing windows"],
  "Farm Life": ["Color the sky a warm morning blue", "Paint the barn bright red with a brown roof", "Color the grass and fields in fresh bright green", "Add brown and white spots to the cows, pink for the pigs", "Color sunflowers yellow with brown centers"],
  "Ocean & Sea Creatures": ["Color the water in shades of blue and teal", "Paint the fish with vivid tropical colors — orange, yellow, red, and blue", "Color the coral reef pink, orange, and purple", "Add sandy yellow and tan for the ocean floor", "Color any bubbles light blue and white"],
  "Jungle Adventure": ["Color the sky a warm golden yellow peeking through leaves", "Paint the jungle leaves in many shades of green", "Color the monkey brown with a pink face", "Add bright reds and yellows for tropical flowers", "Color the tree trunks dark brown with green vines"],
  "Robots & Sci-Fi": ["Color the background dark blue or black for a sci-fi setting", "Paint the robot's body silver and grey", "Add glowing blue, green, or red for the robot's eyes and lights", "Color buttons and panels in bright contrasting colors", "Fill the background with purple and teal for a futuristic glow"],
  "Holiday Themes": ["Color the background with festive warm reds and golds", "Paint the main decorations green, red, and golden", "Color any snow bright white with light blue shadows", "Add warm yellow and orange to candles and lights", "Color stars and baubles gold, silver, red, and green"],
  "Myths & Legends": ["Color the sky deep purple and midnight blue", "Paint the legendary creature with dramatic colors — gold, silver, or fire red", "Color ancient stones and ruins in grey and mossy green", "Add golden yellow to magical auras and fire", "Color distant mountains in blue-grey tones"],
  "School & Education Scenes": ["Color the classroom walls a warm cream or light yellow", "Paint books and backpacks in a rainbow of bright colors", "Color pencils yellow and erasers pink", "Add green to the chalkboard with white writing", "Color the children's clothes in cheerful bright shades"],
  "Food & Sweets": ["Color the background in warm pastels — pink, lavender, or mint", "Paint cakes and cupcakes in vivid frosting colors — pink, blue, and yellow", "Color fruits in their natural vivid shades — red apple, orange carrot, yellow banana", "Add swirls of white for cream and frosting", "Color sprinkles with every color of the rainbow"],
  Transportation: ["Color the sky light blue with fluffy clouds", "Paint each vehicle in a bold primary color", "Color roads and tracks dark grey with yellow markings", "Add orange and yellow for lights and signals", "Color smoke or steam light grey and white"],
  "Cute Cartoon Characters": ["Color the background in a pastel or cheerful shade", "Paint the character's body in their signature bright color", "Add rosy pink circles to their cheeks", "Color eyes black with tiny white highlights", "Fill in accessories and details with fun contrasting colors"],
  "Daily Life Scenes": ["Color the sky a cheerful daytime blue", "Paint houses and buildings in warm, welcoming shades", "Color children's clothing in bright, fun colors", "Add greens for trees and grass", "Color any flowers, signs, or fun details with vivid pops of color"],
};

router.get("/coloring/color-guide/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [page] = await db.select().from(coloringPagesTable).where(eq(coloringPagesTable.id, id));
  if (!page) { res.status(404).json({ error: "Not found" }); return; }

  const guideLines = COLOR_GUIDES[page.genre] ?? [
    "Color the sky light blue",
    "Color the ground green or brown",
    "Color the main character with your favorite color",
    "Add details to the background",
    "Color any remaining areas creatively!",
  ];

  const steps = guideLines.map((line, i) => `Step ${i + 1}: ${line}.`);
  res.json({ id, steps });
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
