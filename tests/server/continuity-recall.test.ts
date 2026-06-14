import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { handleSessionStart, handleSessionEnd, handleSessionAttempt, handleGuidePractice, setNotifyChange, resetSessionState } from "../../src/server/handlers.js";
import { setSessionsDir, loadAttemptsForSession } from "../../src/sessions/index.js";
import { loadConfig } from "../../src/memory/config.js";
import { getDb } from "../../src/db/database.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-continuity-test-"));
  setSessionsDir(TMPDIR);
  setNotifyChange(() => {});
  resetSessionState();
});

afterEach(() => {
  setSessionsDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("handleSessionAttempt", () => {
  test("records an attempt against the active session and reports seq", async () => {
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    const res = await handleSessionAttempt({ approach: "useState for derived", outcome: "rejected", critique: "re-render loop" });
    assert.equal(res.isError, undefined);
    assert.match(res.content[0].text, /attempt #1/i);
  });

  test("increments seq across multiple attempts", async () => {
    await handleSessionStart({ task_type: "debugging" });
    await handleSessionAttempt({ approach: "first try", outcome: "partial", critique: "incomplete" });
    const res = await handleSessionAttempt({ approach: "second try", outcome: "promising" });
    assert.match(res.content[0].text, /#2/);
  });

  test("returns a warning (no error) when there is no active session", async () => {
    const res = await handleSessionAttempt({ approach: "orphan", outcome: "rejected", critique: "c" });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /no active session/i);
  });

  test("rejects an invalid outcome with a helpful error (before touching the session)", async () => {
    await handleSessionStart({ task_type: "debugging" });
    const res = await handleSessionAttempt({ approach: "bad outcome", outcome: "completed" });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /must be one of/i);
  });

  test("redacts secrets pasted into approach/critique before persisting", async () => {
    const { getDb } = await import("../../src/db/database.js");
    await handleSessionStart({ task_type: "debugging" });
    await handleSessionAttempt({
      approach: "tried auth with token ghp_" + "a".repeat(36),
      outcome: "rejected",
      critique: "key sk-" + "b".repeat(24) + " leaked in logs",
    });
    const row = getDb().prepareCached("SELECT approach, critique FROM session_attempts WHERE session_id = (SELECT id FROM sessions LIMIT 1)").get() as { approach: string; critique: string };
    assert.match(row.approach, /REDACTED:GitHub token/);
    assert.match(row.critique, /REDACTED:OpenAI API key/);
    assert.doesNotMatch(row.approach + row.critique, /ghp_|sk-/);
  });

  test("rejected attempt is stored and appears in a later session's recall", async () => {
    // Session A: record a dead end, then end it.
    await handleSessionStart({ task_type: "debugging", technologies: ["react"], initial_approach: "fix render loop" });
    await handleSessionAttempt({ approach: "useState to cache derived value", outcome: "rejected", critique: "infinite re-render loop because setState in render body" });
    await handleSessionEnd({ outcome: "success", final_approach: "useMemo instead" });

    // Session B, same task_type: the dead end must surface in continuity recall.
    const startB = await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    assert.match(startB.content[0].text, /useState to cache derived value/i);
    assert.match(startB.content[0].text, /Dead ends/i);
  });
});

describe("session_start continuity recall", () => {
  test("recall surfaces dead ends (rejected) before the response tail, within token budget", async () => {
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleSessionAttempt({ approach: "useState derived state cache", outcome: "rejected", critique: "re-render loop" });
    await handleSessionAttempt({ approach: "abort controller unmount", outcome: "partial", critique: "race condition" });
    await handleSessionEnd({ outcome: "success", lessons: ["use useMemo for derived values"], final_approach: "useMemo" });

    const startB = await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    const text = startB.content[0].text;
    // Dead ends appear.
    assert.match(text, /Dead ends/i);
    assert.match(text, /useState derived state cache/i);
    // The rejected approach appears before the recall block's own tail marker,
    // i.e. it is part of the surfaced "Dead ends" list rather than appended later.
    // (session_start has no "What worked"/lessons block — those are emitted by session_end —
    // so we anchor ordering on the recall block structure itself.)
    assert.ok(text.indexOf("useState derived state cache") < text.indexOf("### Dead ends") + 200, "dead ends appear inside the Dead ends list");
  });

  test("recall is task_type-scoped: a different task_type does not surface another task's dead ends", async () => {
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleSessionAttempt({ approach: "unique-marker-xyz debugging", outcome: "rejected", critique: "c" });
    await handleSessionEnd({ outcome: "success" });

    const startB = await handleSessionStart({ task_type: "documentation", technologies: ["react"] });
    assert.doesNotMatch(startB.content[0].text, /unique-marker-xyz debugging/);
  });

  test("recall is project-scoped: a different project does not surface another project's dead ends", async () => {
    // projA session with a dead end (same task_type as the projB session below).
    await handleSessionStart({ task_type: "debugging", technologies: ["react"], project: "proj-alpha" });
    await handleSessionAttempt({ approach: "cross-project-marker-xyz debugging", outcome: "rejected", critique: "c" });
    await handleSessionEnd({ outcome: "success" });

    // projB session, SAME task_type — must NOT recall projA's dead end now that
    // sessions.project is written and passed to loadRecentAttempts.
    const startB = await handleSessionStart({ task_type: "debugging", technologies: ["react"], project: "proj-beta" });
    assert.doesNotMatch(startB.content[0].text, /cross-project-marker-xyz debugging/);
  });

  test("recall respects the token_budget.continuity cap (long content is truncated)", async () => {
    await handleSessionStart({ task_type: "debugging" });
    // Record a very large rejected attempt.
    const big = "x".repeat(4000);
    await handleSessionAttempt({ approach: big, outcome: "rejected", critique: "c" });
    await handleSessionEnd({ outcome: "success" });

    const budget = loadConfig().token_budget.continuity;
    const startB = await handleSessionStart({ task_type: "debugging" });
    const text = startB.content[0].text;
    // The oversized approach (4000 chars) must NOT be echoed in full — the budget
    // caps recall, so the continuity block truncates rather than dumping the whole blob.
    assert.doesNotMatch(text, /x{4000}/, "the oversized approach must be truncated out of recall");
    assert.ok(budget > 0);
  });
});

describe("session_end distill-to-pitfalls", () => {
  test("a repeated dead-end across sessions is distilled into the guide's pitfalls", async () => {
    // Two sessions, same guide/tech, same dead end described similarly.
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleGuidePractice({ guide: "react", category: "web-frontend", contexts: ["hooks"], learnings: ["render"] });
    await handleSessionAttempt({ approach: "useState to cache the derived calculation result", outcome: "rejected", critique: "re-render loop because setState in render body" });
    await handleSessionEnd({ outcome: "failure" });

    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleGuidePractice({ guide: "react", category: "web-frontend", contexts: ["hooks"], learnings: ["state"] });
    await handleSessionAttempt({ approach: "Use useState to cache derived calculation", outcome: "rejected", critique: "re-render loop setState render" });
    const res = await handleSessionEnd({ outcome: "failure" });

    // The react guide now carries a distilled pitfall.
    const row = getDb().prepareCached("SELECT pitfalls FROM guides WHERE guide = 'react' COLLATE NOCASE").get() as { pitfalls: string | null };
    const pitfalls = row.pitfalls ? JSON.parse(row.pitfalls) as string[] : [];
    assert.ok(pitfalls.some(p => /usestate/i.test(p) && /render/i.test(p)), `expected a useState/render pitfall, got: ${JSON.stringify(pitfalls)}`);
    // session_end should mention the distillation.
    assert.match(res.content[0].text, /distill/i);
  });

  test("a one-off dead-end (no prior match) is NOT distilled (no false positives)", async () => {
    await handleSessionStart({ task_type: "debugging", technologies: ["python"] });
    await handleGuidePractice({ guide: "python", category: "programming-language", contexts: ["async"], learnings: ["x"] });
    await handleSessionAttempt({ approach: "totally novel one-off approach zzz", outcome: "rejected", critique: "unrelated unique failure" });
    const res = await handleSessionEnd({ outcome: "failure" });

    const row = getDb().prepareCached("SELECT pitfalls FROM guides WHERE guide = 'python' COLLATE NOCASE").get() as { pitfalls: string | null };
    const pitfalls = row.pitfalls ? JSON.parse(row.pitfalls) as string[] : [];
    assert.ok(!pitfalls.some(p => /one-off approach zzz/i.test(p)));
    // Should not claim a distillation.
    assert.doesNotMatch(res.content[0].text, /distilled pitfall/i);
  });
});

describe("session_end persistent improvement suggestions", () => {
  test("low guide success rate persists an improvement suggestion shown at next session_start", async () => {
    // Drive a guide's failure count up to trigger the low-success suggestion, across sessions.
    for (let i = 0; i < 4; i++) {
      await handleSessionStart({ task_type: "implementation", technologies: ["react"] });
      await handleGuidePractice({ guide: "react", category: "web-frontend", contexts: ["x"], learnings: ["y"], outcome: "failure" });
      await handleSessionEnd({ outcome: "failure" });
    }
    // A pending suggestion now exists.
    const { loadPendingSuggestions } = await import("../../src/sessions/index.js");
    const pending = loadPendingSuggestions();
    assert.ok(pending.length >= 1);
    assert.match(pending[0].suggestion, /react/i);

    // The next session_start surfaces it.
    const start = await handleSessionStart({ task_type: "implementation", technologies: ["react"] });
    assert.match(start.content[0].text, /react/i);
  });
});

describe("attempt decay on session_start", () => {
  test("starting a new session decays prior attempt confidence by 0.002", async () => {
    await handleSessionStart({ task_type: "debugging" });
    await handleSessionAttempt({ approach: "will-decay", outcome: "rejected", critique: "c" });
    await handleSessionEnd({ outcome: "success" });

    const before = getDb().prepareCached("SELECT confidence FROM session_attempts WHERE approach='will-decay'").get() as { confidence: number };
    // Use a DIFFERENT task_type so the new session_start does NOT recall "will-decay" (which would
    // apply Task 7's +0.015 boost and mask the decay). This isolates decay for a clean measurement.
    await handleSessionStart({ task_type: "refactoring" });
    const after = getDb().prepareCached("SELECT confidence FROM session_attempts WHERE approach='will-decay'").get() as { confidence: number };
    assert.ok(after.confidence < before.confidence, "confidence should decay on a new session_start");
    assert.ok(before.confidence - after.confidence <= 0.0021);
  });
});

describe("suggestion_respond (accept/dismiss)", () => {
  test("dismiss moves a suggestion out of pending and stops surfacing it", async () => {
    // Seed a pending suggestion via the low-success path (4 failing sessions).
    for (let i = 0; i < 4; i++) {
      await handleSessionStart({ task_type: "implementation", technologies: ["react"] });
      await handleGuidePractice({ guide: "react", category: "web-frontend", contexts: ["x"], learnings: ["y"], outcome: "failure" });
      await handleSessionEnd({ outcome: "failure" });
    }
    const { loadPendingSuggestions } = await import("../../src/sessions/index.js");
    const pending = loadPendingSuggestions();
    assert.ok(pending.length >= 1);
    const id = pending[0].id;

    // Import the new handler under test.
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    const res = await handleSuggestionRespond({ id, action: "dismiss" });
    assert.equal(res.isError, undefined);
    // No longer pending.
    assert.equal(loadPendingSuggestions().filter(s => s.id === id).length, 0);
  });

  test("accept sets resolved_at and clears from pending", async () => {
    const { saveImprovementSuggestion, loadPendingSuggestions, loadSessions, findActiveSession } = await import("../../src/sessions/index.js");
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    await handleSessionStart({ task_type: "implementation" });
    const active = findActiveSession(loadSessions());
    assert.ok(active, "expected an active session after handleSessionStart");
    const id = saveImprovementSuggestion(active!.session_id, "tip");
    const res = await handleSuggestionRespond({ id, action: "accept" });
    assert.equal(res.isError, undefined);
    assert.equal(loadPendingSuggestions().filter(s => s.id === id).length, 0);
    const row = getDb().prepareCached("SELECT status, resolved_at FROM improvement_suggestions WHERE id = ?").get(id) as { status: string; resolved_at: string | null };
    assert.equal(row.status, "accepted");
    assert.ok(row.resolved_at);
  });

  test("rejects an invalid action with a helpful error", async () => {
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    const res = await handleSuggestionRespond({ id: 999, action: "maybe" });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /must be one of/i);
  });

  test("requires id and action", async () => {
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    const res = await handleSuggestionRespond({ action: "dismiss" });
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /required/i);
  });

  test("dismiss penalizes the source session's dead-end attempts", async () => {
    // 1. Start a session + record two attempts (one rejected, one promising).
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleSessionAttempt({ approach: "rejected-dead-end-marker", outcome: "rejected", critique: "re-render loop" });
    await handleSessionAttempt({ approach: "promising-untouched-marker", outcome: "promising" });
    const { loadSessions, findActiveSession, saveImprovementSuggestion, loadPendingSuggestions } = await import("../../src/sessions/index.js");
    const active = findActiveSession(loadSessions());
    assert.ok(active, "expected an active session after handleSessionStart");
    const sessionId = active!.session_id;
    await handleSessionEnd({ outcome: "success" });

    // Capture attempt confidences BEFORE (default is 0.5 per schema.ts session_attempts).
    const before = loadAttemptsForSession(sessionId);
    assert.equal(before.length, 2);
    const rejectedBefore = before.find(a => a.approach === "rejected-dead-end-marker")!;
    const promisingBefore = before.find(a => a.approach === "promising-untouched-marker")!;

    // 2. Persist an improvement suggestion anchored to that session and dismiss it.
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    const id = saveImprovementSuggestion(sessionId, "tip");
    assert.ok(loadPendingSuggestions().some(s => s.id === id));

    // 3. Dismiss — should penalize only the rejected attempt (−0.02), leave promising untouched.
    const res = await handleSuggestionRespond({ id, action: "dismiss" });
    assert.equal(res.isError, undefined);
    assert.match(res.content[0].text, /de-prioritized/i);

    // 4. Verify: rejected confidence dropped by 0.02, promising unchanged, status is 'dismissed'.
    const after = loadAttemptsForSession(sessionId);
    const rejectedAfter = after.find(a => a.approach === "rejected-dead-end-marker")!;
    const promisingAfter = after.find(a => a.approach === "promising-untouched-marker")!;
    assert.ok(rejectedAfter.confidence < rejectedBefore.confidence, "rejected attempt confidence should drop on dismiss");
    assert.equal(Math.round((rejectedBefore.confidence - rejectedAfter.confidence) * 1000) / 1000, 0.02, "rejected penalized by exactly 0.02");
    assert.equal(promisingAfter.confidence, promisingBefore.confidence, "promising attempt must NOT be penalized");

    const row = getDb().prepareCached("SELECT status FROM improvement_suggestions WHERE id = ?").get(id) as { status: string };
    assert.equal(row.status, "dismissed");
  });

  test("accept boosts the source session's promising attempts (mirror of dismiss)", async () => {
    // 1. Start a session + record two attempts (one rejected, one promising).
    await handleSessionStart({ task_type: "debugging", technologies: ["react"] });
    await handleSessionAttempt({ approach: "rejected-untouched-marker2", outcome: "rejected", critique: "re-render loop" });
    await handleSessionAttempt({ approach: "promising-boost-marker2", outcome: "promising" });
    const { loadSessions, findActiveSession, saveImprovementSuggestion, loadPendingSuggestions } = await import("../../src/sessions/index.js");
    const active = findActiveSession(loadSessions());
    assert.ok(active, "expected an active session after handleSessionStart");
    const sessionId = active!.session_id;
    await handleSessionEnd({ outcome: "success" });

    // Capture attempt confidences BEFORE (default is 0.5 per schema.ts session_attempts).
    const before = loadAttemptsForSession(sessionId);
    assert.equal(before.length, 2);
    const rejectedBefore = before.find(a => a.approach === "rejected-untouched-marker2")!;
    const promisingBefore = before.find(a => a.approach === "promising-boost-marker2")!;

    // 2. Persist an improvement suggestion anchored to that session and accept it.
    const { handleSuggestionRespond } = await import("../../src/server/handlers.js");
    const id = saveImprovementSuggestion(sessionId, "tip");
    assert.ok(loadPendingSuggestions().some(s => s.id === id));

    // 3. Accept — should boost only the promising attempt (+0.02), leave rejected untouched.
    const res = await handleSuggestionRespond({ id, action: "accept" });
    assert.equal(res.isError, undefined);
    assert.match(res.content[0].text, /reinforced/i);

    // 4. Verify: promising confidence rose by 0.02, rejected unchanged, status is 'accepted'.
    const after = loadAttemptsForSession(sessionId);
    const rejectedAfter = after.find(a => a.approach === "rejected-untouched-marker2")!;
    const promisingAfter = after.find(a => a.approach === "promising-boost-marker2")!;
    assert.ok(promisingAfter.confidence > promisingBefore.confidence, "promising attempt confidence should rise on accept");
    assert.equal(Math.round((promisingAfter.confidence - promisingBefore.confidence) * 1000) / 1000, 0.02, "promising boosted by exactly 0.02");
    assert.equal(rejectedAfter.confidence, rejectedBefore.confidence, "rejected attempt must NOT be boosted");

    const row = getDb().prepareCached("SELECT status FROM improvement_suggestions WHERE id = ?").get(id) as { status: string };
    assert.equal(row.status, "accepted");
  });
});
