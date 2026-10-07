import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable("live_rooms", {
  code: text("code").primaryKey(), host: text("host").notNull(),
  title: text("title").notNull(), questions: text("questions").notNull(),
  phase: text("phase").notNull().default("lobby"),
  round: integer("round").notNull().default(-1),
  seconds: integer("seconds").notNull(), deadline: integer("deadline").notNull().default(0),
  expires: integer("expires").notNull(),
});
export const players = sqliteTable("live_players", {
  id: text("id").primaryKey(), room: text("room").notNull().references(() => rooms.code, {onDelete: "cascade"}),
  token: text("token").notNull(), name: text("name").notNull(),
}, t => [uniqueIndex("live_player_name").on(t.room, t.name)]);
export const answers = sqliteTable("live_answers", {
  id: integer("id").primaryKey({autoIncrement: true}),
  room: text("room").notNull().references(() => rooms.code, {onDelete: "cascade"}),
  round: integer("round").notNull(), player: text("player").notNull().references(() => players.id, {onDelete: "cascade"}),
  choice: integer("choice").notNull(), correct: integer("correct").notNull(),
  rank: integer("rank").notNull(), points: integer("points").notNull(),
}, t => [uniqueIndex("live_one_answer").on(t.room, t.round, t.player), index("live_answers_player_round").on(t.player, t.round)]);
