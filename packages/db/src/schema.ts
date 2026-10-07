// Phase 0 schema stubs (M0). Lane L2 owns this file from Phase 1 on; schema changes are one owner at a time.
// Domain payloads (programs, reports) are stored as JSONB typed by the Zod contracts in @optimass/types,
// so contract changes don't force a migration for every field.
import type { DiagnosticReport, PoseSequence, Program } from "@optimass/types";
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  // Auth provider fields are added in M9 once the auth library is chosen.
  ...timestamps,
});

export const programs = pgTable(
  "programs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Full Program document, validated with Program from @optimass/types before write. */
    data: jsonb("data").$type<Program>().notNull(),
    ...timestamps,
  },
  (t) => [index("programs_user_id_idx").on(t.userId)],
);

export const cameraView = pgEnum("camera_view", ["sagittal", "frontal"]);
export const analysisStatus = pgEnum("analysis_status", ["pending", "processing", "complete", "failed"]);

export const analysisSessions = pgTable(
  "analysis_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id").notNull(),
    cameraView: cameraView("camera_view").notNull(),
    status: analysisStatus("status").notNull().default("pending"),
    durationMs: integer("duration_ms"),
    /** Optional stored landmarks (video itself is not stored server-side by default). */
    poseSequence: jsonb("pose_sequence").$type<PoseSequence>(),
    /** DiagnosticReport from @optimass/types once analysis completes. */
    report: jsonb("report").$type<DiagnosticReport>(),
    ...timestamps,
  },
  (t) => [index("analysis_sessions_user_id_idx").on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ProgramRow = typeof programs.$inferSelect;
export type NewProgramRow = typeof programs.$inferInsert;
export type AnalysisSessionRow = typeof analysisSessions.$inferSelect;
export type NewAnalysisSessionRow = typeof analysisSessions.$inferInsert;
