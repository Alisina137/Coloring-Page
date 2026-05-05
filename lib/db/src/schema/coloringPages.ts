import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coloringPagesTable = pgTable("coloring_pages", {
  id: serial("id").primaryKey(),
  gender: text("gender").notNull(),
  genre: text("genre").notNull(),
  ageGroup: text("age_group").notNull().default("6-8"),
  imageData: text("image_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertColoringPageSchema = createInsertSchema(coloringPagesTable).omit({ id: true, createdAt: true });
export type InsertColoringPage = z.infer<typeof insertColoringPageSchema>;
export type ColoringPage = typeof coloringPagesTable.$inferSelect;
