import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const childProfilesTable = pgTable("child_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ageGroup: text("age_group").notNull().default("6-8"),
  avatarEmoji: text("avatar_emoji").notNull().default("🎨"),
  totalPages: integer("total_pages").notNull().default(0),
  totalMinutes: integer("total_minutes").notNull().default(0),
  currentDifficulty: integer("current_difficulty").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ChildProfile = typeof childProfilesTable.$inferSelect;
