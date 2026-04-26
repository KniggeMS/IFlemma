import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findTopicOverlaps, createFragment } from "../../src/memory/core.js";

function makeFragment(text: string, project: string | null = null): any {
  return createFragment(text, "ai", null, project);
}

describe("findTopicOverlaps", () => {
  it("finds topic-related fragments in 40-65% similarity range", async () => {
    const fragments = [
      makeFragment("Next.js 15 uses App Router as the default routing system"),
      makeFragment("React Server Components render on the server side"),
      makeFragment("Git rebase interactive workflow for clean commit history"),
    ];

    const overlaps = await findTopicOverlaps(fragments, "Next.js App Router is the recommended approach", null);
    assert.ok(overlaps.length >= 1, "Should find at least 1 topic overlap");
    assert.ok(overlaps.some((o: any) => o.fragment.includes("Next.js")), "Should match Next.js fragment");
  });

  it("does not return fragments below 40% similarity", async () => {
    const fragments = [
      makeFragment("Completely unrelated topic about cooking recipes"),
      makeFragment("Another unrelated topic about gardening"),
    ];

    const overlaps = await findTopicOverlaps(fragments, "React hooks state management patterns", null);
    assert.equal(overlaps.length, 0);
  });

  it("returns empty for empty memory", async () => {
    const overlaps = await findTopicOverlaps([], "React hooks", null);
    assert.equal(overlaps.length, 0);
  });

  it("respects project scoping", async () => {
    const fragments = [
      makeFragment("React hooks for state management", "projectA"),
      makeFragment("React hooks for state management", null),
    ];

    const overlaps = await findTopicOverlaps(fragments, "React state patterns", "projectA");
    assert.ok(overlaps.length >= 1);
    assert.ok(overlaps.every((o: any) => o.project === "projectA" || o.project === null));
  });

  it("respects limit parameter", async () => {
    const fragments = [];
    for (let i = 0; i < 20; i++) {
      fragments.push(makeFragment(`React component pattern ${i} for building user interfaces`));
    }

    const overlaps = await findTopicOverlaps(fragments, "React component architecture", null, 3);
    assert.ok(overlaps.length <= 3);
  });
});
