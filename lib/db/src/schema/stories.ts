import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";

export const storiesTable = pgTable("stories", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  theme: text("theme").notNull(),
  genre: text("genre").notNull(),
  profileId: integer("profile_id"),
  totalPages: integer("total_pages").notNull().default(3),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const storyPagesTable = pgTable("story_pages", {
  id: serial("id").primaryKey(),
  storyId: integer("story_id").notNull(),
  pageNumber: integer("page_number").notNull(),
  sentence: text("sentence").notNull(),
  imageData: text("image_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Story = typeof storiesTable.$inferSelect;
export type StoryPage = typeof storyPagesTable.$inferSelect;
