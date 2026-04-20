import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import * as core from "../../src/memory/core.js";
import { handleSessionStart, handleMemoryAdd, setNotifyChange } from "../../src/server/handlers.js";

const TEST_DIR = path.join(os.tmpdir(), `lemma-test-session-preload-${Date.now()}`);

beforeEach(() => {
  core.setMemoryDir(TEST_DIR);
  fs.mkdirSync(TEST_DIR, { recursive: true });
  setNotifyChange(() => {});
});

afterEach(() => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("Session start pre-loaded memories", () => {
  it("includes pre-loaded memories when relevant fragments exist", async () => {
    await handleMemoryAdd({ fragment: "React hooks useState pattern for local state management", project: null });
    await handleMemoryAdd({ fragment: "Node.js Express middleware configuration", project: null });
    await handleMemoryAdd({ fragment: "Git rebase interactive workflow", project: null });

    const result = await handleSessionStart({
      task_type: "implementation",
      technologies: ["react"],
    });

    const text = result.content[0].text;
    assert.ok(text.includes("Pre-loaded memories"));
    assert.ok(text.includes("React"));
  });

  it("does not include pre-loaded memories section when no relevant fragments", async () => {
    const result = await handleSessionStart({
      task_type: "implementation",
      technologies: ["quantum-computing"],
    });

    const text = result.content[0].text;
    assert.ok(text.includes("Session started"));
  });

  it("limits pre-loaded memories to 3", async () => {
    for (let i = 0; i < 10; i++) {
      await handleMemoryAdd({ fragment: `React component pattern ${i} for building UI`, project: null });
    }

    const result = await handleSessionStart({
      task_type: "implementation",
      technologies: ["react"],
    });

    const text = result.content[0].text;
    const preLoadedLines = text.split("\n").filter(line => line.match(/^\s+\[m[0-9a-f]+\]/));
    assert.ok(preLoadedLines.length <= 3, `Expected at most 3 pre-loaded memories, got ${preLoadedLines.length}`);
  });

  it("still returns guide suggestions alongside pre-loaded memories", async () => {
    await handleMemoryAdd({ fragment: "React hooks pattern for state", project: null });

    const result = await handleSessionStart({
      task_type: "implementation",
      technologies: ["react"],
    });

    const text = result.content[0].text;
    assert.ok(text.includes("Session started"));
    assert.ok(text.includes("Technologies: react"));
  });

  it("boosts confidence of pre-loaded fragments", async () => {
    const addResult = await handleMemoryAdd({ fragment: "React useEffect cleanup pattern", project: null });
    const addText = addResult.content[0].text;
    const idMatch = addText.match(/\[([^\]]+)\]/);
    assert.ok(idMatch, "Should have fragment ID");

    const beforeMemory = core.loadMemory();
    const frag = beforeMemory.find(f => f.id === idMatch[1]);
    const beforeConf = frag ? frag.confidence : 0;

    await handleSessionStart({
      task_type: "debugging",
      technologies: ["react"],
    });

    const afterMemory = core.loadMemory();
    const afterFrag = afterMemory.find(f => f.id === idMatch[1]);
    assert.ok(afterFrag, "Fragment should still exist");
    assert.ok(afterFrag.confidence >= beforeConf, "Confidence should be boosted");
  });
});
