import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import {
  setSessionsDir,
  createSession,
  recordAttempt,
  loadAttemptsForSession,
  loadRecentAttempts,
  decayAttempts,
  boostAttempt,
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

  test("attempts cascade-delete when session is deleted", () => {
    const s = createSession("debugging");
    recordAttempt(s.session_id, { approach: "doomed", outcome: "rejected", critique: "c" });
    getDb().prepareCached("DELETE FROM sessions WHERE id = ?").run(s.session_id);
    const count = getDb().prepareCached("SELECT count(*) as c FROM session_attempts WHERE session_id = ?").get(s.session_id) as { c: number };
    assert.equal(count.c, 0);
  });
});
