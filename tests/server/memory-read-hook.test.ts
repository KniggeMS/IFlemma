import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as core from "../../src/memory/index.js";
import * as guides from "../../src/guides/index.js";
import * as sessions from "../../src/sessions/index.js";
import { setNotifyChange, handleMemoryRead, handleSessionStart, resetSessionState } from "../../src/server/handlers.js";
import type { MemoryFragment } from "../../src/types.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-mhook-"));
  core.setMemoryDir(TMPDIR);
  guides.setGuidesDir(TMPDIR);
  sessions.setSessionsDir(TMPDIR);
  resetSessionState();
  setNotifyChange(() => {});
});

afterEach(() => {
  resetSessionState();
  core.setMemoryDir(path.join(os.homedir(), ".lemma"));
  guides.setGuidesDir(path.join(os.homedir(), ".lemma"));
  sessions.setSessionsDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

function seedFragments(texts: string[]): MemoryFragment[] {
  const frags = texts.map(t => core.createFragment(t, "ai", null, null));
  core.saveMemory(frags);
  return frags;
}

describe("memory_read response hooks", () => {
  test("includes Auto-linked when search returns multiple fragments", async () => {
    seedFragments([
      "React hooks useState pattern for local state",
      "React hooks useEffect cleanup on unmount",
      "React hooks useRef for mutable references",
    ]);
    const result = await handleMemoryRead({ query: "React hooks" });
    assert.ok(!result.isError);
    assert.ok(result.content[0].text.includes("Auto-linked"));
  });

  test("does NOT include SUGGESTED ACTIONS when single fragment returned by ID", async () => {
    const [frag] = seedFragments(["A single unique fragment about quantum computing"]);
    const result = await handleMemoryRead({ id: frag.id });
    assert.ok(!result.isError);
    assert.ok(!result.content[0].text.includes("SUGGESTED ACTIONS"));
  });

  test("does NOT include SUGGESTED ACTIONS when multiple fragments read via batch ids", async () => {
    const frags = seedFragments([
      "First fragment about alpha particle physics",
      "Second fragment about beta decay processes",
    ]);
    const result = await handleMemoryRead({ ids: [frags[0].id, frags[1].id] });
    assert.ok(!result.isError);
    assert.ok(!result.content[0].text.includes("SUGGESTED ACTIONS"));
  });

  test("populates associatedWith after reading multiple fragments via search", async () => {
    seedFragments([
      "React component lifecycle methods overview",
      "React component mounting and unmounting phases",
      "React component rendering optimization techniques",
    ]);
    await handleMemoryRead({ query: "React component" });
    const loaded = core.loadMemory();
    const withAssoc = loaded.filter(f => f.associatedWith.length > 0);
    assert.ok(withAssoc.length >= 2);
  });
});

describe("memory_read project scope (query mode)", () => {
  test("query mode filters results by project — no cross-project leakage", async () => {
    const projA = core.createFragment("Alpha deployment pipeline for project A", "ai", null, "projA");
    const projB = core.createFragment("Alpha build steps for project B", "ai", null, "projB");
    core.saveMemory([projA, projB]);

    const result = await handleMemoryRead({ query: "Alpha", project: "projA" });
    const text = result.content[0].text;
    assert.ok(!result.isError);
    assert.ok(text.includes(projA.id), "projA fragment should appear in scoped query");
    assert.ok(!text.includes(projB.id), "projB fragment must NOT appear in projA-scoped query");
  });

  test("query mode does NOT auto-link cross-project fragments (no permanent pollution)", async () => {
    const projA = core.createFragment("Gamma config setup for project A", "ai", null, "projA");
    const projA2 = core.createFragment("Gamma tuning knobs for project A", "ai", null, "projA");
    const projB = core.createFragment("Gamma config setup for project B", "ai", null, "projB");
    core.saveMemory([projA, projA2, projB]);

    // Scoped query to projA — projB must not be pulled in and permanently linked.
    await handleMemoryRead({ query: "Gamma config", project: "projA" });

    const loaded = core.loadMemory();
    const projBFrag = loaded.find(f => f.id === projB.id);
    assert.ok(projBFrag, "projB fragment should exist");
    const assocB = projBFrag!.associatedWith || [];
    assert.ok(!assocB.includes(projA.id), "projB must NOT be associatedWith projA after scoped query");
    assert.ok(!assocB.includes(projA2.id), "projB must NOT be associatedWith projA2 after scoped query");
  });

  test("records read fragment IDs into the active session's memories_read", async () => {
    const frag = core.createFragment("Single fragment to be read by id", "ai", null, null);
    core.saveMemory([frag]);

    await handleSessionStart({ task_type: "implementation" });
    await handleMemoryRead({ id: frag.id });

    const all = sessions.loadSessions();
    const active = all.find(s => s.status === "active");
    assert.ok(active, "an active session should exist after session_start");
    assert.ok(
      active!.memories_read.includes(frag.id),
      "memories_read must contain the fragment id read during the active session"
    );
  });
});
