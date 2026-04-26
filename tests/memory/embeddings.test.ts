import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  isEmbeddingsReady,
  getEmbeddingModelName,
} from "../../src/memory/embeddings.js";

describe("Embeddings — cosine similarity", () => {
  test("identical vectors return ~1.0", () => {
    const v = [0.1, 0.2, 0.3, 0.4];
    const sim = cosineSimilarity(v, v);
    assert.ok(Math.abs(sim - 1) < 0.001, `Expected ~1.0, got ${sim}`);
  });

  test("orthogonal vectors return 0", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    const sim = cosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.001, `Expected ~0, got ${sim}`);
  });

  test("opposite vectors return -1", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    assert.equal(cosineSimilarity(a, b), -1);
  });

  test("different length vectors return 0", () => {
    const a = [1, 2, 3];
    const b = [1, 2];
    assert.equal(cosineSimilarity(a, b), 0);
  });

  test("zero vectors return 0", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    assert.equal(cosineSimilarity(a, b), 0);
  });

  test("similar vectors have high similarity", () => {
    const a = [0.1, 0.9, 0.3];
    const b = [0.15, 0.85, 0.35];
    const sim = cosineSimilarity(a, b);
    assert.ok(sim > 0.95, `Expected >0.95 similarity, got ${sim}`);
  });

  test("dissimilar vectors have low similarity", () => {
    const a = [1, 0, 0];
    const b = [0, 0, 1];
    const sim = cosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.001, `Expected ~0, got ${sim}`);
  });
});

describe("Embeddings — module state", () => {
  test("isEmbeddingsReady returns false before init", () => {
    assert.equal(isEmbeddingsReady(), false);
  });

  test("getEmbeddingModelName returns correct model", () => {
    const name = getEmbeddingModelName();
    assert.ok(name.includes("paraphrase-multilingual"));
    assert.ok(name.includes("MiniLM-L12"));
  });
});

describe("Embeddings — searchByVector with mock data", () => {
  test("ranks by cosine similarity", async () => {
    const { searchByVector } = await import("../../src/memory/embeddings.js");

    const query = [1, 0, 0];
    const fragments = [
      { fragment: "close", embedding: [0.95, 0.1, 0.05] },
      { fragment: "far", embedding: [0.1, 0.9, 0.1] },
      { fragment: "medium", embedding: [0.6, 0.4, 0.3] },
    ];

    const results = await searchByVector(query, fragments, 3);
    assert.equal(results.length, 3);
    assert.equal(fragments[results[0].index].fragment, "close");
    assert.ok(results[0].score > results[1].score);
  });

  test("skips fragments without embeddings", async () => {
    const { searchByVector } = await import("../../src/memory/embeddings.js");

    const query = [1, 0];
    const fragments = [
      { fragment: "has embedding", embedding: [0.9, 0.1] },
      { fragment: "no embedding" },
    ];

    const results = await searchByVector(query, fragments, 10);
    assert.equal(results.length, 1);
    assert.equal(fragments[results[0].index].fragment, "has embedding");
  });
});
