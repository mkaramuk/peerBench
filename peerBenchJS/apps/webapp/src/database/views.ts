import { pgView, text, integer, timestamp, real } from "drizzle-orm/pg-core";

export const leaderboardView = pgView("v_leaderboard", {
  model: text("model").notNull(),
  context: text("context").notNull(),
  avgScore: real("avg_score"),
  accuracy: real("accuracy"),
  totalEvaluations: integer("total_evaluations").notNull(),
  recentEvaluation: timestamp("recent_evaluation").notNull(),
  uniquePrompts: integer("unique_prompts"),
  totalTestsPerformed: integer("total_tests_performed").notNull(),
  promptSetId: integer("prompt_set_id"),
}).existing();
