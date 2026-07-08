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
import { generateImageBuffer, generateColorIllustrationBuffer } from "../lib/image-gen";

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

  const { gender, genre, ageGroup, description, artStyle, background, lineThickness, quality, characterName } = parsed.data;
  const genreDescription = GENRES[genre] ?? genre;
  const genderAdjective =
    gender === "Boy"
      ? "boy-friendly"
      : gender === "Girl"
        ? "girl-friendly"
        : "child-friendly";

  const ageDescription =
    ageGroup === "3-5"
      ? "very simple, 3-4 large bold shapes, minimal details, thick lines, suitable for toddlers"
      : ageGroup === "6-8"
        ? "moderate complexity, clear distinct regions, some secondary details"
        : "detailed composition, fine elements, layered scene, suitable for older children";

  const customPart = description ? ` Featuring: ${description}.` : "";
  const artStylePart = artStyle ? ` Art style: ${artStyle}.` : "";
  const backgroundPart =
    background === "none"
      ? " No background — white space only around the subject."
      : background === "detailed"
        ? " Include a detailed scene background."
        : " Simple minimal background.";
  const thicknessPart =
    lineThickness === "thin"
      ? " Use thin delicate outlines."
      : lineThickness === "thick"
        ? " Use very thick bold outlines."
        : " Use medium-weight outlines.";
  const namePart = characterName ? ` The main character is named ${characterName}.` : "";

  // ONE master scene description shared by BOTH the color illustration and the coloring
  // page. It fully pins down the subject, composition, and background so both images
  // depict the exact same characters/pose/objects/scene — only style (color vs. outline)
  // and outline thickness (coloring-page-only) may differ below.
  const masterScene = `a ${genderAdjective} scene with ${genreDescription} theme.${customPart}${artStylePart}${backgroundPart}${namePart} Complexity: ${ageDescription}. Age group: ${ageGroup} years old.`;

  req.log.info({ gender, genre, ageGroup, description, artStyle, quality }, "Generating coloring page");

  // Use the same seed for both generations so providers that support seeding (all four in
  // our fallback chain do) produce matching diffusion noise, further reinforcing that the
  // color illustration and the coloring page depict the same scene.
  const seed = Math.floor(Math.random() * 2 ** 31);

  // Step 1: Generate the full-color illustration from the master scene. This is the
  // canonical depiction of the scene — the coloring page (step 2) must match it exactly,
  // varying only in that it is a black-outline version.
  let coloredBuffer: Buffer | null = null;
  try {
    coloredBuffer = await generateColorIllustrationBuffer(masterScene, quality ?? "balanced", seed);
  } catch (err) {
    req.log.warn({ err }, "Color hint illustration generation failed — continuing without a hint image");
  }
  const coloredImageData = coloredBuffer ? coloredBuffer.toString("base64") : null;

  // Step 2: Generate the B&W coloring page from the SAME master scene + seed, appending
  // only coloring-specific style instructions (outline thickness). Never a different scene.
  const imageBuffer = await generateImageBuffer(`${masterScene}${thicknessPart}`, {
    quality: quality ?? "balanced",
    seed,
  });
  const imageData = imageBuffer.toString("base64");

  const [page] = await db
    .insert(coloringPagesTable)
    .values({ gender, genre, ageGroup, description: description ?? null, imageData, coloredImageData })
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
  Animals: [
    "Start with the sky — fill it with a soft, light blue using long smooth strokes",
    "Color the ground or grass with bright green; add darker green patches for depth and texture",
    "Paint the main animal's body with warm fur tones — brown, golden tan, or orange",
    "Add a lighter shade (cream or beige) to the animal's belly, chest, and inner ears",
    "Color the animal's eyes dark brown or black, leaving a tiny white dot for a highlight",
    "Add details to the fur — use short strokes of a darker brown along the edges and back",
    "Color the nose and mouth area with a soft pink or dark brown",
    "Paint any flowers in the scene with red, yellow, pink, or purple — vary the colors",
    "Color tree trunks dark brown and their leaves in two or three shades of green",
    "Add final touches — color shadows on the ground with a soft grey or darker green",
  ],
  Fantasy: [
    "Fill the background sky with deep purple and dark blue for a magical atmosphere",
    "Add stars and sparkles in the sky using bright yellow and white",
    "Paint the castle walls in light grey and stone-beige, with purple rooftop towers",
    "Color castle windows with a warm golden glow to suggest light inside",
    "Paint magical creatures (dragons, unicorns) with vivid colors — gold, silver, or iridescent blues",
    "Add glowing magical auras around creatures using yellow and pale green",
    "Color the enchanted forest with deep greens, teals, and touches of neon blue",
    "Paint mushrooms red with white spots, and glowing plants in turquoise",
    "Color any water (ponds, rivers) in shimmering blue-green with white ripples",
    "Add final sparkle details — dot yellow and white along wands, wings, and magical trails",
  ],
  "Cars & Vehicles": [
    "Fill the sky with a bright light blue and add fluffy white clouds with gentle circular strokes",
    "Color the road or track dark grey, leaving thin white or yellow lines for road markings",
    "Paint the main vehicle's body in a bold primary color — racing red, electric blue, or sunny yellow",
    "Add a darker shade of the same color to the vehicle's lower panels for a shadow effect",
    "Color the windows and windshield with a light blue-grey to suggest glass reflections",
    "Paint the tires and wheels solid black, with a thin silver or grey rim ring",
    "Add orange or yellow circles for headlights and tail lights",
    "Color any engine details, exhausts, or spoilers in metallic silver or grey",
    "Paint the background buildings or scenery with warm earthy tones and bright accents",
    "Add finishing details — use a white crayon or gel pen for highlights on the vehicle's roof and hood",
  ],
  Sports: [
    "Color the sky a bright, energetic blue to set an exciting scene",
    "Paint the playing surface — green for grass/field, orange for a basketball court, or light beige for sand",
    "Add white or yellow boundary lines on the playing surface with a ruler if needed",
    "Color the main player's uniform in your favorite team's colors — be bold and bright",
    "Paint the secondary players or teammates in a contrasting team color",
    "Color the sports ball with its classic colors — black and white for soccer, orange for basketball, yellow for tennis",
    "Add skin tones to players' faces and hands using peach, tan, or warm brown",
    "Color hair in natural tones — brown, black, blonde, or red",
    "Paint any crowd or stands in the background with a colorful mix of shades",
    "Add shadows beneath players' feet using a soft grey to ground them to the surface",
  ],
  "Nature & Landscapes": [
    "Paint the sky with a gradient — lighter blue near the horizon, deeper blue higher up",
    "Add white fluffy clouds using gentle circular strokes and leave the centers slightly lighter",
    "Color the mountains in blue-grey and purple tones, with white snow caps at the peaks",
    "Paint the foreground hills and meadows in bright fresh green",
    "Color tree trunks dark brown, then fill the canopy with two or three shades of green",
    "Add flowers in the meadow — use red, yellow, pink, and purple dots or small shapes",
    "Color any river or lake with sky-blue, adding light white wavy lines for ripples",
    "Paint rocks and stones with grey and brown, adding a darker shadow on one side",
    "Color paths or dirt trails in warm tan or sandy brown",
    "Finish by adding a warm yellow sun in the corner with radiating yellow-orange rays",
  ],
  Dinosaurs: [
    "Paint the prehistoric sky with orange and yellow tones for a dramatic sunrise effect",
    "Add purple and pink clouds near the horizon to complete the ancient atmosphere",
    "Color the main dinosaur's body in bright green, olive, or teal from head to tail",
    "Paint the dinosaur's belly and underside in a lighter green or cream color",
    "Add texture to the dinosaur's skin using short darker green strokes along the spine and sides",
    "Color the dinosaur's eyes bright yellow or orange with a dark pupil in the center",
    "Paint sharp teeth or claws in white or pale yellow, adding grey shadows for depth",
    "Color large prehistoric plants and ferns in deep green with lighter green highlights",
    "Paint rocks, boulders, and ground in brown, grey, and earthy orange tones",
    "Add a volcano or distant mountains in the background using dark grey and red-orange",
  ],
  "Space & Planets": [
    "Fill the entire background with deep black for the vast emptiness of outer space",
    "Add tiny dots all across the background in white and pale yellow for distant stars",
    "Paint the main planet with your choice of bold color — blue for Earth, red for Mars, yellow for Saturn",
    "Add rings around Saturn (if present) in tan, golden yellow, and pale grey stripes",
    "Color the rocket body in silver or white, with red and blue stripe details",
    "Paint the rocket's engine flames in bright orange, yellow, and red from the bottom",
    "Color the astronaut's suit in white with gold visor and colorful mission patch details",
    "Add a blue-green glow around Earth to suggest the atmosphere",
    "Paint nearby moons in light grey with darker grey crater circles",
    "Finish with scattered colorful nebula clouds in purple, pink, and teal in the far background",
  ],
  "Princess & Fairy Tales": [
    "Fill the sky with soft pink and lavender tones for a romantic fairy-tale dawn",
    "Add golden sunbeams streaming from behind the castle using pale yellow strokes",
    "Paint the castle walls in light stone-grey and cream, with purple or pink turret rooftops",
    "Color the castle windows with warm golden yellow to suggest candlelight inside",
    "Paint the princess's dress in a beautiful blue, pink, or gold — add lighter shades for folds",
    "Color the princess's hair in golden blonde, deep brunette, or magical silver-white",
    "Add jewel details to the crown in red, blue, and green sparkle colors",
    "Paint the enchanted forest in deep green with glowing teal and purple accents",
    "Color roses, flowers, and vines in red, pink, and purple with bright green stems",
    "Add magical sparkle dots throughout the scene in white and pale gold for a dreamy finish",
  ],
  Superheroes: [
    "Color the action-packed sky in dark stormy blue to create an exciting mood",
    "Add lightning or energy bursts in bright yellow and white in the background",
    "Paint the hero's main costume in a bold primary color — red, blue, or green",
    "Add the secondary costume color (belt, boots, gloves) in a contrasting shade",
    "Color the hero's cape in a rich contrasting hue — dark red, yellow, or deep blue",
    "Paint the emblem or logo on the chest in a bright accent color with clean edges",
    "Add skin tones to the hero's face and exposed skin in warm peach, tan, or brown",
    "Color the city buildings in the background in grey and blue-grey tones",
    "Paint building windows with warm yellow-orange to suggest interior lighting",
    "Finish with energy blasts, stars, or impact lines in bright yellow, orange, and white",
  ],
  "Farm Life": [
    "Color the morning sky in warm light blue with a soft orange and pink near the horizon",
    "Add a bright yellow sun peeking over the hills with orange radiating rays",
    "Paint the barn in classic bright red with a dark brown wooden roof",
    "Color the barn doors in a darker red-brown with grey metal hinges",
    "Paint the farm fields in fresh bright green with horizontal darker lines for rows",
    "Color the farmhouse walls in white or cream with a warm brown roof",
    "Paint cows in white with black or brown spots; pigs in soft pink with darker snouts",
    "Color chickens in white, yellow, and orange; roosters in red and green feathers",
    "Paint the wooden fence in light tan and brown with grey nail details",
    "Color sunflowers in bright yellow with dark brown centers, and add green grass details",
  ],
  "Ocean & Sea Creatures": [
    "Fill the ocean water background with a gradient — deep blue at the top, teal towards the seafloor",
    "Add soft white wavy lines across the water to suggest gentle movement and light",
    "Paint the sandy seafloor with warm tan and sandy yellow tones",
    "Color the coral reef in vivid pink, orange, and red with touches of purple",
    "Paint the main fish in tropical colors — bright orange, electric blue, or neon yellow",
    "Add stripes, spots, or fin details in contrasting colors to make the fish interesting",
    "Color dolphins in smooth blue-grey with a lighter belly in cream or white",
    "Paint sea turtles green with darker green hexagonal shell patterns",
    "Add sea anemones in bright red and orange, and seaweed in flowing dark green",
    "Scatter small bubbles throughout the water using light blue circles with white highlights",
  ],
  "Jungle Adventure": [
    "Color the patches of sky visible through the tree canopy with warm golden yellow",
    "Paint large jungle leaves in multiple shades of green — bright, dark, and olive",
    "Add leaf veins using a slightly darker shade of the same green",
    "Color tree trunks in dark brown with grey and tan patches for bark texture",
    "Paint vines hanging from trees in medium green with brown woody sections",
    "Color the main monkey in warm brown with a lighter tan face, ears, and palms",
    "Paint toucans with a black body and a vivid multicolored beak — orange, yellow, red",
    "Color exotic flowers in bright red, pink, and purple with yellow centers",
    "Paint any butterflies with wings in vivid blue, orange, and yellow patterns",
    "Add ground-level details — fallen leaves in brown and yellow, mossy rocks in grey-green",
  ],
  "Robots & Sci-Fi": [
    "Fill the background with deep space black or a dark glowing sci-fi blue",
    "Add a subtle grid pattern on the floor in darker lines to suggest a futuristic setting",
    "Paint the robot's main body panels in silver and light grey for a metallic look",
    "Add a darker grey to the robot's joints, seams, and panel edges for depth",
    "Color the robot's eyes or visor in bright glowing blue, green, or red",
    "Paint control panel buttons and indicators in a rainbow of small bright dots",
    "Color mechanical arms or claws in a slightly darker metallic silver",
    "Add glowing energy lines along the robot's body in neon blue or green",
    "Paint any flying vehicles or spacecraft in the background with silver and blue",
    "Finish with glowing light effects around energy sources using pale yellow and white",
  ],
  "Holiday Themes": [
    "Paint the background sky or room wall in warm festive red or cozy deep blue",
    "Color the Christmas tree in rich dark green with lighter green highlights on branch tips",
    "Paint star or angel tree topper in bright golden yellow",
    "Color tree ornaments (baubles) in red, blue, gold, silver, and green — alternate colors",
    "Add garland or tinsel in silver and gold zigzag lines along the branches",
    "Color gift boxes in bright solid colors with white or contrasting ribbon and bow",
    "Paint snow on rooftops and ground in pure white with very light blue shadows",
    "Color the fireplace in warm brick red and orange, with yellow and red flames inside",
    "Paint candles in white or cream with a warm yellow-orange flame at the top",
    "Add final festive sparkle — gold stars, snowflakes in white, and colorful light bulbs",
  ],
  "Myths & Legends": [
    "Fill the dramatic sky with deep midnight blue and stormy purple tones",
    "Add a large full moon in pale white-grey with subtle darker grey crater details",
    "Color ancient stone ruins and pillars in grey, beige, and brown mossy tones",
    "Add moss and ivy on the ruins in dark green and olive",
    "Paint the main legendary creature with dramatic colors — golden dragon, silver phoenix, or fire-red griffin",
    "Add glowing magical aura around the creature in yellow, orange, or electric blue",
    "Color massive wings in rich jewel tones — deep purple, crimson red, or iridescent blue",
    "Paint fire breath or lightning in bright orange, red, and yellow with white core",
    "Color distant misty mountains in blue-grey with soft edges suggesting fog",
    "Finish with tiny white and gold sparkle dots scattered across the scene",
  ],
  "School & Education Scenes": [
    "Color the classroom walls in warm cream or soft yellow for a welcoming feel",
    "Paint the chalkboard or whiteboard in dark green or white with colorful writing details",
    "Color wooden desks and chairs in warm medium brown with grey metal legs",
    "Paint books and textbooks in a rainbow of different colors — red, blue, green, yellow",
    "Color backpacks and school bags in bold bright colors with contrasting zippers",
    "Paint pencils yellow with pink erasers at the top and silver metal rings",
    "Color crayons in every rainbow color — line them up with each one a different hue",
    "Paint globes in blue (oceans) and green-brown (land masses) on a dark brown stand",
    "Color children's clothing in bright, cheerful shades — each child in a different color",
    "Add final details — apples in red on the teacher's desk, a yellow sun in a student's drawing",
  ],
  "Food & Sweets": [
    "Color the background in a soft warm pastel — light pink, lavender, or mint green",
    "Paint the main cake or dessert with vivid frosting colors — pink, blue, or creamy white",
    "Add a second contrasting color for the cake layers peeking out from the sides",
    "Color swirls and rosettes of frosting in slightly darker shades of the base color",
    "Paint fresh fruit decorations in natural vivid colors — red strawberries, blueberries, yellow lemon slices",
    "Color sprinkles with every color of the rainbow — tiny dashes and dots",
    "Paint chocolate drizzle in warm dark brown flowing down the sides",
    "Color candles in multiple bright solid colors with a warm yellow-orange flame",
    "Paint macarons, cookies, and cupcakes in pastel pinks, greens, and yellows",
    "Add a soft golden shimmer to any pastry edges using yellow or metallic gold",
  ],
  Transportation: [
    "Fill the sky with cheerful light blue and add large fluffy white clouds",
    "Color the road or track in dark grey with crisp white or yellow center markings",
    "Paint the first vehicle (train, car, bus) in a bold primary color — red, blue, or yellow",
    "Add a second vehicle in a contrasting color to create visual variety",
    "Color wheels and tires solid black with a thin silver grey rim detail",
    "Paint windows and glass panels in light blue-grey to suggest reflections",
    "Color headlights and taillights in bright orange or yellow circles",
    "Add exhaust or steam in light grey and white puffs",
    "Paint background buildings, signs, or trees to add environment and depth",
    "Finish with small details — number plates in white, stripes on vehicles, signal lights in red-green",
  ],
  "Cute Cartoon Characters": [
    "Color the background in a cheerful pastel or a soft gradient sky tone",
    "Paint the character's body in their main signature color — bold and clean",
    "Add a slightly lighter shade to the character's face, belly, or inner areas",
    "Color rosy cheek circles in a bright warm pink or coral",
    "Paint eyes in solid black with one or two small white highlight dots for shine",
    "Color eyebrows, mouth, and nose details in dark brown or black",
    "Add the character's clothing or accessories in a contrasting bright color",
    "Color shoes, boots, or feet in a rich dark tone to ground the character",
    "Paint any props (wands, bags, toys) in fun accent colors",
    "Finish with small pattern details — polka dots, stars, or stripes on clothing",
  ],
  "Daily Life Scenes": [
    "Color the daytime sky in bright cheerful blue with white fluffy clouds",
    "Paint the sun in warm golden yellow with radiating orange rays at the edges",
    "Color house or building walls in warm cream, light yellow, or terracotta",
    "Paint rooftops in warm red or dark grey depending on the style",
    "Color doors in a bold accent color — red, blue, or bright green",
    "Paint windows in light blue-grey with warm yellow curtains or blinds inside",
    "Color children's clothing in bright mixed colors — each person wearing something different",
    "Paint trees in medium and dark green with brown trunks and visible root bases",
    "Color the pavement, sidewalk, or path in light grey or sandy beige",
    "Add final life details — colorful flowers in gardens, a red mailbox, or a yellow school bus",
  ],
};

router.get("/coloring/color-guide/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [page] = await db.select().from(coloringPagesTable).where(eq(coloringPagesTable.id, id));
  if (!page) { res.status(404).json({ error: "Not found" }); return; }

  const guideLines = COLOR_GUIDES[page.genre] ?? [
    "Start with the sky — fill it with a light blue using smooth even strokes",
    "Color the ground or floor with green, brown, or grey depending on the scene",
    "Paint the main character or object in a bold, bright color of your choice",
    "Add a lighter shade to the front or lit sides of the main subject",
    "Color secondary objects or background elements in complementary shades",
    "Add details to faces — skin tones, eyes, and hair in natural colors",
    "Color any clothing or accessories in contrasting bright tones",
    "Paint shadows beneath objects using a soft grey or darker version of the ground color",
    "Add small decorative details — flowers, stars, or patterns using accent colors",
    "Finish with any remaining areas — fill them creatively with your favorite colors",
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
