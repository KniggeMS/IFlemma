import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import type { SuggestionStatus } from "../../src/types.js";

import {
  setSessionsDir,
  createSession,
  recordAttempt,
  loadAttemptsForSession,
  loadRecentAttempts,
  decayAttempts,
  boostAttempt,
  penalizeAttempt,
  saveImprovementSuggestion,
  loadPendingSuggestions,
  updateSuggestionStatus,
} from "../../src/sessions/index.js";
import { getDb } from "../../src/db/database.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-attempts-test-"));
  setSessionsDir(TMPDIR);
});

afterEach(() => {
  setSessionsDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("Attempt persistence", () => {
  test("recordAttempt inserts with incrementing seq", () => {
    const s = createSession("debugging", ["react"]);
    recordAttempt(s.session_id, { approach: "useState for derived", outcome: "rejected", critique: "re-render loop" });
    recordAttempt(s.session_id, { approach: "useMemo", outcome: "promising" });
    const attempts = loadAttemptsForSession(s.session_id);
    assert.equal(attempts.length, 2);
    assert.equal(attempts[0].seq, 1);
    assert.equal(attempts[1].seq, 2);
    assert.equal(attempts[1].outcome, "promising");
  });

  test("loadRecentAttempts filters by task_type and outcome, orders by confidence", () => {
    const a = createSession("debugging", ["react"]);
    const b = createSession("implementation", ["react"]);
    recordAttempt(a.session_id, { approach: "approach A rejected", outcome: "rejected", critique: "c" });
    recordAttempt(b.session_id, { approach: "approach B rejected", outcome: "rejected", critique: "c" });

    // Same task_type as a; b has a different task_type and must be excluded.
    const recent = loadRecentAttempts({ task_type: "debugging", limit: 10, minConfidence: 0 });
    assert.equal(recent.length, 1);
    assert.equal(recent[0].approach, "approach A rejected");
  });

  test("loadRecentAttempts respects minConfidence threshold", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "low conf", outcome: "rejected", critique: "c" });
    const db = getDb();
    db.prepareCached("UPDATE session_attempts SET confidence = 0.1 WHERE approach = 'low conf'").run();
    const recent = loadRecentAttempts({ task_type: "debugging", limit: 10, minConfidence: 0.3 });
    assert.equal(recent.length, 0);
  });

  test("loadRecentAttempts orders matching attempts by confidence descending", () => {
    const a = createSession("debugging", ["react"]);
    const b = createSession("debugging", ["react"]);
    recordAttempt(a.session_id, { approach: "low confidence approach", outcome: "rejected", critique: "c" });
    recordAttempt(b.session_id, { approach: "high confidence approach", outcome: "rejected", critique: "c" });
    const db = getDb();
    db.prepareCached("UPDATE session_attempts SET confidence = 0.3 WHERE approach = 'low confidence approach'").run();
    db.prepareCached("UPDATE session_attempts SET confidence = 0.9 WHERE approach = 'high confidence approach'").run();
    const recent = loadRecentAttempts({ task_type: "debugging", limit: 10, minConfidence: 0 });
    assert.equal(recent.length, 2);
    assert.equal(recent[0].approach, "high confidence approach");
    assert.equal(recent[1].approach, "low confidence approach");
  });

  test("decayAttempts lowers confidence by 0.002 per call, floored at 0", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "decaying", outcome: "rejected", critique: "c" });
    decayAttempts();
    let row = getDb().prepareCached("SELECT confidence FROM session_attempts WHERE approach='decaying'").get() as { confidence: number };
    assert.equal(row.confidence, 0.498);
    // Decay many times to force the floor.
    for (let i = 0; i < 500; i++) decayAttempts();
    row = getDb().prepareCached("SELECT confidence FROM session_attempts WHERE approach='decaying'").get() as { confidence: number };
    assert.equal(row.confidence, 0);
  });

  test("boostAttempt increases confidence and access_count", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "boost me", outcome: "rejected", critique: "c" });
    const before = getDb().prepareCached("SELECT confidence, access_count FROM session_attempts WHERE approach='boost me'").get() as { confidence: number; access_count: number };
    boostAttempt(s.session_id, 1, 0.015);
    const after = getDb().prepareCached("SELECT confidence, access_count FROM session_attempts WHERE approach='boost me'").get() as { confidence: number; access_count: number };
    assert.equal(after.confidence, before.confidence + 0.015);
    assert.equal(after.access_count, before.access_count + 1);
  });

  test("penalizeAttempt lowers confidence (floored at 0) and bumps access_count", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "penalize me", outcome: "rejected", critique: "c" });
    const before = getDb().prepareCached("SELECT confidence, access_count FROM session_attempts WHERE approach='penalize me'").get() as { confidence: number; access_count: number };
    penalizeAttempt(s.session_id, 1, 0.02);
    const after = getDb().prepareCached("SELECT confidence, access_count FROM session_attempts WHERE approach='penalize me'").get() as { confidence: number; access_count: number };
    assert.equal(after.confidence, before.confidence - 0.02);
    assert.equal(after.access_count, before.access_count + 1);
    // Force the floor at 0.
    for (let i = 0; i < 500; i++) penalizeAttempt(s.session_id, 1, 0.02);
    const floored = getDb().prepareCached("SELECT confidence FROM session_attempts WHERE approach='penalize me'").get() as { confidence: number };
    assert.equal(floored.confidence, 0);
  });

  test("attempts cascade-delete when session is deleted", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "doomed", outcome: "rejected", critique: "c" });
    getDb().prepareCached("DELETE FROM sessions WHERE id = ?").run(s.session_id);
    const count = getDb().prepareCached("SELECT count(*) as c FROM session_attempts WHERE session_id = ?").get(s.session_id) as { c: number };
    assert.equal(count.c, 0);
  });
});

describe("Improvement-suggestion persistence", () => {
  test("saveImprovementSuggestion + loadPendingSuggestions round-trip", () => {
    const s = createSession("debugging");
    saveImprovementSuggestion(s.session_id, "Consider guide_distill for the react pattern.");
    saveImprovementSuggestion(s.session_id, "Guide 'react' low success — refine it.");
    const pending = loadPendingSuggestions();
    assert.equal(pending.length, 2);
    assert.equal(pending[0].status, "offered");
    assert.equal(pending[0].session_id, s.session_id);
  });

  test("updateSuggestionStatus moves a suggestion out of pending", () => {
    const s = createSession("debugging");
    const id = saveImprovementSuggestion(s.session_id, "tip one");
    updateSuggestionStatus(id, "dismissed" as SuggestionStatus);
    const pending = loadPendingSuggestions();
    assert.equal(pending.length, 0);
  });

  test("updateSuggestionStatus accepted sets resolved_at", () => {
    const s = createSession("debugging");
    const id = saveImprovementSuggestion(s.session_id, "tip two");
    updateSuggestionStatus(id, "accepted" as SuggestionStatus);
    const row = getDb().prepareCached("SELECT status, resolved_at FROM improvement_suggestions WHERE id = ?").get(id) as { status: string; resolved_at: string | null };
    assert.equal(row.status, "accepted");
    assert.ok(row.resolved_at);
  });

  test("updateSuggestionStatus re-offer clears resolved_at (idempotent)", () => {
    const s = createSession("debugging");
    const id = saveImprovementSuggestion(s.session_id, "tip three");
    updateSuggestionStatus(id, "accepted" as SuggestionStatus);
    // Move back to offered → resolved_at must be cleared and it re-enters pending.
    updateSuggestionStatus(id, "offered" as SuggestionStatus);
    const row = getDb().prepareCached("SELECT status, resolved_at FROM improvement_suggestions WHERE id = ?").get(id) as { status: string; resolved_at: string | null };
    assert.equal(row.status, "offered");
    assert.equal(row.resolved_at, null);
    assert.equal(loadPendingSuggestions().length, 1);
  });
});
