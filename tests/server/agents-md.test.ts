import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";

import { removeAgentsMd } from "../../src/server/agents-md.js";

let TMPDIR: string;

beforeEach(() => {
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-agents-test-"));
});

afterEach(() => {
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

describe("removeAgentsMd", () => {
  test("removes marked Lemma block, keeps surrounding content", () => {
    const p = path.join(TMPDIR, "AGENTS.md");
    fs.writeFileSync(
      p,
      "My project rules.\n\n<!-- lemma:start -->\n## Lemma\nold block\n<!-- lemma:end -->\n\nMore rules.\n"
    );
    const removed = removeAgentsMd(TMPDIR);
    assert.ok(removed);
    const after = fs.readFileSync(p, "utf-8");
    assert.ok(!after.includes("lemma:start"));
    assert.ok(!after.includes("old block"));
    assert.ok(after.includes("My project rules."));
    assert.ok(after.includes("More rules."));
  });

  test("returns false when no marker present", () => {
    const p = path.join(TMPDIR, "AGENTS.md");
    fs.writeFileSync(p, "Just my rules.\n");
    const removed = removeAgentsMd(TMPDIR);
    assert.strictEqual(removed, false);
    assert.strictEqual(fs.readFileSync(p, "utf-8"), "Just my rules.\n");
  });

  test("returns false when no AGENTS.md exists", () => {
    const removed = removeAgentsMd(TMPDIR);
    assert.strictEqual(removed, false);
  });

  test("deletes the file if only the Lemma block existed", () => {
    const p = path.join(TMPDIR, "AGENTS.md");
    fs.writeFileSync(p, "<!-- lemma:start -->\n## Lemma\nonly lemma\n<!-- lemma:end -->\n");
    const removed = removeAgentsMd(TMPDIR);
    assert.ok(removed);
    assert.ok(!fs.existsSync(p));
  });
});
