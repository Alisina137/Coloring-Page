import { pgTable, text, serial, timestamp, date } from "drizzle-orm/pg-core";

export const dailyChallengesTable = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  challengeDate: date("challenge_date").notNull().unique(),
  genre: text("genre").notNull(),
  theme: text("theme").notNull(),
  imageData: text("image_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DailyChallenge = typeof dailyChallengesTable.$inferSelect;
