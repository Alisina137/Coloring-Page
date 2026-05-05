import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const earnedBadgesTable = pgTable("earned_badges", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  badgeKey: text("badge_key").notNull(),
  earnedAt: timestamp("earned_at").defaultNow().notNull(),
});

export type EarnedBadge = typeof earnedBadgesTable.$inferSelect;
