import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { analysisSessions, programs, users } from "./schema";

describe("db schema stubs", () => {
  it("defines the three Phase 0 tables", () => {
    expect([users, programs, analysisSessions].map((t) => getTableConfig(t).name)).toEqual(["users", "programs", "analysis_sessions"]);
  });

  it("scopes programs and analysis sessions to a user", () => {
    for (const t of [programs, analysisSessions]) {
      expect(getTableConfig(t).foreignKeys).toHaveLength(1);
    }
  });
});
