import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, childProfilesTable, earnedBadgesTable } from "@workspace/db";
import {
  CreateProfileBody,
  DeleteProfileParams,
  GetProfileBadgesParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const BADGE_DEFINITIONS: Record<string, { emoji: string; label: string; description: string; requiredPages: number }> = {
  first_page: { emoji: "🌟", label: "First Page!", description: "Created your very first coloring page", requiredPages: 1 },
  page_5: { emoji: "🎨", label: "Colorful 5", description: "Created 5 coloring pages", requiredPages: 5 },
  page_10: { emoji: "🏆", label: "Artist 10", description: "Created 10 coloring pages", requiredPages: 10 },
  page_25: { emoji: "👑", label: "Master Artist", description: "Created 25 coloring pages", requiredPages: 25 },
};

async function checkAndAwardBadges(profileId: number, totalPages: number) {
  const existing = await db.select().from(earnedBadgesTable).where(eq(earnedBadgesTable.profileId, profileId));
  const existingKeys = new Set(existing.map((b) => b.badgeKey));
  const toAward: string[] = [];
  for (const [key, def] of Object.entries(BADGE_DEFINITIONS)) {
    if (!existingKeys.has(key) && totalPages >= def.requiredPages) {
      toAward.push(key);
    }
  }
  if (toAward.length > 0) {
    await db.insert(earnedBadgesTable).values(toAward.map((k) => ({ profileId, badgeKey: k })));
  }
  return toAward;
}

router.get("/profiles", async (req, res): Promise<void> => {
  const profiles = await db.select().from(childProfilesTable).orderBy(childProfilesTable.createdAt);
  res.json(profiles);
});

router.post("/profiles", async (req, res): Promise<void> => {
  const parsed = CreateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, ageGroup, avatarEmoji } = parsed.data;
  const [profile] = await db.insert(childProfilesTable).values({ name, ageGroup, avatarEmoji }).returning();
  res.status(201).json(profile);
});

router.delete("/profiles/:id", async (req, res): Promise<void> => {
  const parsed = DeleteProfileParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db.delete(childProfilesTable).where(eq(childProfilesTable.id, parsed.data.id)).returning();
  if (result.length === 0) {
    res.status(404).json({ error: "Profile not found" });
    return;
  }
  res.status(204).send();
});

router.get("/profiles/:id/badges", async (req, res): Promise<void> => {
  const parsed = GetProfileBadgesParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const badges = await db.select().from(earnedBadgesTable).where(eq(earnedBadgesTable.profileId, parsed.data.id));
  res.json(badges.map((b) => b.badgeKey));
});

export default router;
export { checkAndAwardBadges, BADGE_DEFINITIONS };
