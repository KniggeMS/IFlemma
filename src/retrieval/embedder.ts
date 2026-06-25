/**
 * EmbedderService — wraps @xenova/transformers to produce
 * 384-dimensional sentence embeddings (all-MiniLM-L6-v2).
 *
 * Usage:
 *   const svc = EmbedderService.getInstance();
 *   const vec = await svc.embed("some text");
 */

import { logger } from "../logger.js";

const MODEL_NAME = "Xenova/all-MiniLM-L6-v2";
const EMBEDDING_DIM = 384;

export class EmbedderError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "EmbedderError";
  }
}

type PipelineFn = (texts: string | string[], opts: Record<string, unknown>) => Promise<{ data: Float32Array }[]>;

export class EmbedderService {
  private static instance: EmbedderService | null = null;
  private pipeline: PipelineFn | null = null;
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): EmbedderService {
    if (!EmbedderService.instance) {
      EmbedderService.instance = new EmbedderService();
    }
    return EmbedderService.instance;
  }

  /** Reset singleton — only for tests. */
  static _reset(): void {
    EmbedderService.instance = null;
  }

  isReady(): boolean {
    return this.pipeline !== null;
  }

  getModelName(): string {
    return MODEL_NAME;
  }

  getDim(): number {
    return EMBEDDING_DIM;
  }

  private async init(): Promise<void> {
    if (this.pipeline) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      logger.info("EmbedderService: loading model", { model: MODEL_NAME });
      try {
        // Dynamic import keeps startup fast when embeddings aren't needed.
        const { pipeline } = await import("@xenova/transformers");
        this.pipeline = (await pipeline("feature-extraction", MODEL_NAME)) as PipelineFn;
        logger.info("EmbedderService: model ready", { model: MODEL_NAME });
      } catch (err) {
        this.initPromise = null;
        throw new EmbedderError(`Failed to load embedding model ${MODEL_NAME}`, err);
      }
    })();

    return this.initPromise;
  }

  /**
   * Embed a single text string.
   * Returns a normalised Float32Array of length EMBEDDING_DIM.
   */
  async embed(text: string): Promise<Float32Array> {
    if (!text || !text.trim()) {
      throw new EmbedderError("Cannot embed empty text");
    }
    await this.init();

    try {
      const output = await this.pipeline!(text, {
        pooling: "mean",
        normalize: true,
      });
      // @xenova/transformers returns an array of Tensors; first element is our embedding.
      const raw = output[0]?.data;
      if (!raw || raw.length !== EMBEDDING_DIM) {
        throw new EmbedderError(
          `Unexpected embedding dimension: got ${raw?.length ?? 0}, expected ${EMBEDDING_DIM}`
        );
      }
      return raw instanceof Float32Array ? raw : new Float32Array(raw);
    } catch (err) {
      if (err instanceof EmbedderError) throw err;
      throw new EmbedderError("Embedding failed", err);
    }
  }

  /**
   * Embed multiple texts sequentially.
   * onProgress is called after each item: onProgress(done, total).
   */
  async embedBatch(
    texts: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<Float32Array[]> {
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      results.push(await this.embed(texts[i]));
      onProgress?.(i + 1, texts.length);
    }
    return results;
  }
}
