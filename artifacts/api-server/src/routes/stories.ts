import { Router, type IRouter } from "express";
import { desc } from "drizzle-orm";
import { db, storiesTable, storyPagesTable, childProfilesTable } from "@workspace/db";
import { GenerateStoryBody } from "@workspace/api-zod";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";
import { eq } from "drizzle-orm";

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

const STORY_TEMPLATES: Record<string, { titles: string[]; arcs: string[][] }> = {
  default: {
    titles: ["A Magical Adventure", "The Big Journey", "Friends Forever", "The Amazing Day", "A Wonderful Story"],
    arcs: [
      ["waking up and starting the adventure", "meeting a new friend along the way", "overcoming a small challenge together", "celebrating with joy"],
      ["discovering something magical", "exploring further with curiosity", "finding the treasure", "sharing with everyone"],
      ["setting off on a journey", "getting lost and finding a clue", "solving the mystery", "arriving home safely"],
    ],
  },
};

function storyArcFor(genre: string, pageCount: number): { title: string; sentences: string[]; arc: string[] } {
  const templates = STORY_TEMPLATES.default;
  const title = templates.titles[Math.floor(Math.random() * templates.titles.length)];
  const arc = templates.arcs[Math.floor(Math.random() * templates.arcs.length)].slice(0, pageCount);
  while (arc.length < pageCount) arc.push("continuing the adventure");
  const sentences = arc.map((step, i) => {
    const prefix = i === 0 ? "Our story begins with" : i === pageCount - 1 ? "And finally," : ["Next,", "Then,", "Soon,"][i % 3];
    return `${prefix} ${step}!`;
  });
  return { title, sentences, arc };
}

router.post("/stories/generate", async (req, res): Promise<void> => {
  const parsed = GenerateStoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { genre, ageGroup, gender, pageCount, profileId } = parsed.data;
  const genreDescription = GENRES[genre] ?? genre;
  const genderAdjective = gender === "Boy" ? "boy-friendly" : gender === "Girl" ? "girl-friendly" : "child-friendly";
  const ageDescription =
    ageGroup === "3-5"
      ? "very few elements, maximum 3-4 large simple objects, huge bold shapes, absolutely no fine details"
      : ageGroup === "6-8"
        ? "moderate number of elements, medium-sized shapes with some secondary details"
        : "many elements, rich scene with fine details, layered composition";

  const { title, sentences, arc } = storyArcFor(genre, pageCount);
  const theme = arc.join(" → ");

  req.log.info({ genre, ageGroup, pageCount }, "Generating story");

  const imagePromises = arc.map((step, i) =>
    generateImageBuffer(
      `A vibrant flat-color children's cartoon illustration. ${genderAdjective} ${genreDescription} theme. Scene: ${step}. This is page ${i + 1} of ${pageCount} in a connected story — same characters and setting throughout. Detail level: ${ageDescription}. Full natural background and environment. Bold thick black outlines with distinct flat color regions. No gradients, no shading. Bright cheerful saturated colors. Kid-friendly cartoon style.`,
      "1024x1024"
    )
  );

  const imageBuffers = await Promise.all(imagePromises);

  const [story] = await db.insert(storiesTable).values({
    title,
    theme,
    genre,
    profileId: profileId ?? null,
    totalPages: pageCount,
  }).returning();

  const pageInserts = imageBuffers.map((buf, i) => ({
    storyId: story.id,
    pageNumber: i + 1,
    sentence: sentences[i],
    imageData: buf.toString("base64"),
  }));

  const pages = await db.insert(storyPagesTable).values(pageInserts).returning();

  if (profileId) {
    await db.update(childProfilesTable)
      .set({ totalPages: db.$count(storyPagesTable, eq(storyPagesTable.storyId, story.id)) as any })
      .where(eq(childProfilesTable.id, profileId));
  }

  const sortedPages = pages.sort((a, b) => a.pageNumber - b.pageNumber);
  res.json({ ...story, pages: sortedPages });
});

router.get("/stories", async (req, res): Promise<void> => {
  const stories = await db.select().from(storiesTable).orderBy(desc(storiesTable.createdAt));
  const result = await Promise.all(
    stories.map(async (story) => {
      const pages = await db.select().from(storyPagesTable).where(eq(storyPagesTable.storyId, story.id)).orderBy(storyPagesTable.pageNumber);
      return { ...story, pages };
    })
  );
  res.json(result);
});

export default router;
