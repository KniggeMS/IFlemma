import path from "path";
import os from "os";
import fs from "fs";
import { logger } from "../logger.js";

const MODEL_NAME = "Xenova/paraphrase-multilingual-MiniLM-L12-v2";
const CACHE_DIR = path.join(os.homedir(), ".lemma", "models");
const MODEL_DIM = 384;

let pipeline: any = null;
let initPromise: Promise<void> | null = null;
let isReady = false;
let isInitializing = false;

export function isEmbeddingsReady(): boolean {
  return isReady && pipeline !== null;
}

export function getEmbeddingModelName(): string {
  return MODEL_NAME;
}

export async function initEmbeddings(): Promise<void> {
  if (isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      isInitializing = true;
      fs.mkdirSync(CACHE_DIR, { recursive: true });

      const { pipeline: createPipeline, env } = await import("@huggingface/transformers");

      env.cacheDir = CACHE_DIR;
      env.allowLocalModels = true;
      env.allowRemoteModels = true;

      const isFirstTime = !isModelCached(CACHE_DIR, MODEL_NAME);

      if (isFirstTime) {
        logger.info("Downloading semantic search model (~470MB, first time only)...");
      } else {
        logger.info("Loading cached semantic search model...");
      }

      pipeline = await createPipeline("feature-extraction", MODEL_NAME, {
        dtype: "fp32",
      });

      isReady = true;
      isInitializing = false;
      logger.flow("embeddings", "ready", { model: MODEL_NAME, firstTime: isFirstTime });

      if (isFirstTime) {
        logger.info("Model downloaded. Please restart MCP to activate semantic search.");
      } else {
        logger.info(`Semantic search active (${MODEL_NAME})`);
      }
    } catch (error) {
      isInitializing = false;
      isReady = false;
      pipeline = null;
      logger.warn("Embeddings init failed, using Fuse.js fallback", (error as Error).message);
      logger.flow("embeddings", "failed", { error: (error as Error).message });
    }
  })();

  return initPromise;
}

function isModelCached(cacheDir: string, modelName: string): boolean {
  const modelDir = modelName.replace("/", path.sep);

  const directPath = path.join(cacheDir, modelDir);
  if (fs.existsSync(directPath)) {
    try {
      const files = fs.readdirSync(directPath);
      if (files.length > 0) return true;
    } catch {}
  }

  const dashedName = modelName.replace("/", "--");
  const cachePaths = [
    path.join(cacheDir, ".cache", "huggingface", "transformers", dashedName),
    path.join(cacheDir, dashedName),
    path.join(os.homedir(), ".cache", "huggingface", "hub", `models--${dashedName}`),
  ];

  for (const p of cachePaths) {
    if (fs.existsSync(p)) return true;
  }

  return false;
}

export async function embed(text: string): Promise<number[] | null> {
  if (!pipeline) return null;

  try {
    const output = await pipeline(text, { pooling: "mean", normalize: true });
    const data = output.data as Float32Array;
    return Array.from(data);
  } catch (error) {
    logger.warn("Embedding failed", (error as Error).message);
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;

  return dot / denom;
}

export async function searchByVector(
  queryVector: number[],
  fragments: { fragment: string; embedding?: number[] }[],
  topK: number = 30
): Promise<{ index: number; score: number }[]> {
  const results: { index: number; score: number }[] = [];

  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    if (!frag.embedding) continue;
    const score = cosineSimilarity(queryVector, frag.embedding);
    results.push({ index: i, score });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

export async function hybridSearch(
  query: string,
  fragments: any[],
  fuseResults: any[],
  topK: number = 30
): Promise<any[]> {
  if (!isReady || !pipeline) {
    return fuseResults;
  }

  const queryVector = await embed(query);
  if (!queryVector) {
    logger.flow("embeddings", "query_embed_failed");
    return fuseResults;
  }

  const scored = new Map<number, number>();

  for (const result of fuseResults) {
    const idx = fragments.indexOf(result.item !== undefined ? result.item : result);
    if (idx >= 0) {
      const fuseScore = 1 - (result.score || 0);
      scored.set(idx, fuseScore * 0.4);
    }
  }

  const vectorResults = await searchByVector(queryVector, fragments, topK * 2);
  for (const vr of vectorResults) {
    const existing = scored.get(vr.index) || 0;
    scored.set(vr.index, existing + vr.score * 0.6);
  }

  const ranked = [...scored.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK);

  const result = ranked.map(([idx, score]) => ({
    item: fragments[idx],
    score,
    index: idx,
  }));

  logger.flow("embeddings", "hybrid_search", {
    query: query.slice(0, 50),
    fuse_count: fuseResults.length,
    vector_count: vectorResults.length,
    merged_count: result.length,
  });

  return result;
}
