import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { handleSessionStart, handleSessionEnd, handleSessionAttempt, setNotifyChange, resetSessionState } from "../../src/server/handlers.js";
import { setSessionsDir } from "../../src/sessions/index.js";

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
