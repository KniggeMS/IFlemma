import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { TOOLS } from "../../src/server/tools.js";

// The complete, canonical list of tool names. Any change to the tool set MUST
// update this list — the tests below lock the contract and prevent silent
// regressions (lost lemma_ prefix, dropped annotation, removed outputSchema).
const ALLOWED_NAMES = [
  "lemma_session_start",
  "lemma_session_end",
  "lemma_session_attempt",
  "lemma_suggestion_respond",
  "lemma_memory_read",
  "lemma_memory_add",
  "lemma_memory_update",
  "lemma_memory_forget",
  "lemma_memory_feedback",
  "lemma_memory_merge",
  "lemma_memory_relate",
  "lemma_memory_stats",
  "lemma_memory_audit",
  "lemma_memory_library",
  "lemma_guide_get",
  "lemma_guide_practice",
  "lemma_guide_create",
  "lemma_guide_distill",
  "lemma_guide_update",
  "lemma_guide_forget",
  "lemma_guide_merge",
  "lemma_session_stats",
  "lemma_conflict_scan",
  "lemma_proactive_analysis",
  "lemma_project_analytics",
  "lemma_semantic_search",
];

const READ_ONLY = new Set([
  "lemma_memory_read",
  "lemma_memory_stats",
  "lemma_memory_audit",
  "lemma_memory_library",
  "lemma_semantic_search",
  "lemma_conflict_scan",
  "lemma_proactive_analysis",
  "lemma_project_analytics",
  "lemma_guide_get",
  "lemma_session_stats",
]);

const DESTRUCTIVE = new Set([
  "lemma_memory_forget",
  "lemma_memory_merge",
  "lemma_guide_forget",
  "lemma_guide_merge",
]);

const IDEMPOTENT = new Set([
  "lemma_session_start",
  "lemma_suggestion_respond",
  "lemma_memory_update",
  "lemma_memory_feedback",
  "lemma_memory_relate",
  "lemma_guide_update",
]);

describe("TOOLS registry", () => {
  test("exposes exactly the 26 lemma_-prefixed tools", () => {
    const names = TOOLS.map(t => t.name).sort();
    assert.deepEqual(names, [...ALLOWED_NAMES].sort());
  });

  test("has no duplicate names", () => {
    const names = TOOLS.map(t => t.name);
    assert.equal(new Set(names).size, names.length, "Duplicate tool names detected");
  });

  test("every tool name carries the lemma_ prefix", () => {
    for (const tool of TOOLS) {
      assert.ok(tool.name.startsWith("lemma_"), `Tool missing lemma_ prefix: ${tool.name}`);
    }
  });

  test("every tool carries an outputSchema", () => {
    for (const tool of TOOLS) {
      assert.ok(tool.outputSchema, `Tool missing outputSchema: ${tool.name}`);
      assert.equal(tool.outputSchema!.type, "object", `outputSchema must be object: ${tool.name}`);
    }
  });

  test("every tool carries annotations with openWorldHint:false (local DB)", () => {
    for (const tool of TOOLS) {
      assert.ok(tool.annotations, `Tool missing annotations: ${tool.name}`);
      assert.equal(tool.annotations!.openWorldHint, false, `openWorldHint must be false: ${tool.name}`);
    }
  });

  test("read-only tools are annotated readOnlyHint:true", () => {
    for (const tool of TOOLS) {
      if (READ_ONLY.has(tool.name)) {
        assert.equal(tool.annotations!.readOnlyHint, true, `${tool.name} must be readOnlyHint:true`);
        assert.equal(tool.annotations!.idempotentHint, true, `${tool.name} must be idempotentHint:true`);
      }
    }
  });

  test("destructive tools are annotated destructiveHint:true", () => {
    for (const tool of TOOLS) {
      if (DESTRUCTIVE.has(tool.name)) {
        assert.equal(tool.annotations!.destructiveHint, true, `${tool.name} must be destructiveHint:true`);
      }
    }
  });

  test("idempotent tools are annotated idempotentHint:true", () => {
    for (const tool of TOOLS) {
      if (IDEMPOTENT.has(tool.name)) {
        assert.equal(tool.annotations!.idempotentHint, true, `${tool.name} must be idempotentHint:true`);
      }
    }
  });
});
