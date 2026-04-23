import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Fuse from "fuse.js";
import type { MemoryFragment, MemoryRelation, MemoryStats, AuditResult } from "../types.js";
import { logger } from "../logger.js";

let MEMORY_DIR = path.join(os.homedir(), ".lemma");
let MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");

export function setMemoryDir(dir: string): void {
  MEMORY_DIR = dir;
  MEMORY_FILE = path.join(MEMORY_DIR, "memory.jsonl");
}

export function generateId(): string {
  return "m" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
}

export function detectProject(): string | null {
  try {
    const cwd = process.cwd();
    const projectName = path.basename(cwd);
    const result = projectName || null;
    logger.flow("detect", "project", { project: result });
    return result;
  } catch {
    return null;
  }
}

function generateDescription(fragment: string, title: string): string {
  if (fragment.length <= 80) {
    return fragment;
  }

  const firstSentence = fragment.split(/[.!?\n]/)[0];
  if (firstSentence && firstSentence.length <= 100) {
    return firstSentence.trim() + (firstSentence.endsWith('.') ? '' : '...');
  }

  return fragment.substring(0, 80).trim() + '...';
}

export function createFragment(fragment: string, source: "user" | "ai", title: string | null = null, project: string | null = null, description: string | null = null): MemoryFragment {
  const autoTitle = title || (fragment.length > 40 ? fragment.substring(0, 40) + "..." : fragment);
  const autoDescription = description || generateDescription(fragment, autoTitle);

  const now = new Date();
  const id = generateId();

  logger.flow("fragment", "create", { id, title: autoTitle, project });

  return {
    id: id,
    title: autoTitle,
    description: autoDescription,
    fragment: fragment,
    project: project,
    confidence: 1.0,
    source: source,
    created: now.toISOString().split("T")[0] ?? "",
    lastAccessed: now.toISOString(),
    accessed: 0,
    tags: [],
    associatedWith: [],
    relations: [],
    negativeHits: 0,
    quality_score: null,
    refinement_count: 0,
    parent_id: null,
    child_ids: [],
    session_id: null,
    task_type: null,
    outcome: null,
    positive_feedback: 0,
    negative_feedback: 0,
    last_refined: null
  };
}

export function findSimilarFragment(fragments: MemoryFragment[], fragmentText: string, project: string | null, threshold = 0.65): MemoryFragment | null {
  const scopedFragments = filterByProject(fragments, project);
  if (scopedFragments.length === 0) return null;

  logger.flow("dedup", "checking", { threshold, scopedCount: scopedFragments.length });

  const fuse = new Fuse(scopedFragments, {
    keys: ['fragment', 'title'],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
  });

  const fuseResults = fuse.search(fragmentText, { limit: 3 });

  for (const result of fuseResults) {
    const similarity = 1 - (result.score || 1);
    if (similarity >= threshold) {
      logger.flow("dedup", "found_similar", { id: result.item.id, similarity });
      return result.item;
    }
  }

  logger.flow("dedup", "no_similar");
  return null;
}

export function findTopicOverlaps(fragments: MemoryFragment[], fragmentText: string, project: string | null, limit = 5): MemoryFragment[] {
  const scopedFragments = filterByProject(fragments, project);
  if (scopedFragments.length === 0) return [];

  logger.flow("overlap", "searching", { scopedCount: scopedFragments.length });

  const fuse = new Fuse(scopedFragments, {
    keys: ['fragment', 'title'],
    threshold: 0.6,
    includeScore: true,
    ignoreLocation: true,
  });

  const fuseResults = fuse.search(fragmentText, { limit });
  const overlaps: MemoryFragment[] = [];

  for (const result of fuseResults) {
    const similarity = 1 - (result.score || 1);
    if (similarity >= 0.4 && similarity < 0.65) {
      overlaps.push(result.item);
    }
  }

  logger.flow("overlap", "found", { count: overlaps.length });
  return overlaps;
}

export function boostOnAccess(fragment: MemoryFragment, context: string | null = null): MemoryFragment {
  const boosted = { ...fragment };
  boosted.confidence = Math.min(1.0, boosted.confidence + 0.015);
  boosted.accessed++;
  boosted.lastAccessed = new Date().toISOString();

  logger.flow("confidence", "boost", { id: fragment.id, from: fragment.confidence, to: boosted.confidence });

  if (context && typeof context === "string") {
    const tags = boosted.tags || [];
    const newTag = context.trim().toLowerCase();
    if (newTag && !tags.includes(newTag)) {
      boosted.tags = [...tags, newTag];
    }
  }

  return boosted;
}

export function recordNegativeHit(fragment: MemoryFragment): MemoryFragment {
  const result = {
    ...fragment,
    confidence: Math.max(0, fragment.confidence - 0.02),
    negativeHits: (fragment.negativeHits || 0) + 1,
    lastAccessed: new Date().toISOString()
  };
  logger.flow("confidence", "penalize", { id: fragment.id, from: fragment.confidence, to: result.confidence });
  return result;
}

export function trackAssociations(fragments: MemoryFragment[], accessedId: string, sessionIds: string[]): void {
  if (!sessionIds || sessionIds.length === 0) return;

  const target = fragments.find(f => f.id === accessedId);
  if (!target) return;

  const existing = new Set(target.associatedWith || []);
  for (const id of sessionIds) {
    if (id !== accessedId && !existing.has(id)) {
      existing.add(id);
      const other = fragments.find(f => f.id === id);
      if (other) {
        const otherAssoc = new Set(other.associatedWith || []);
        otherAssoc.add(accessedId);
        other.associatedWith = [...otherAssoc];
      }
    }
  }
  target.associatedWith = [...existing];
}

export function addRelation(fragments: MemoryFragment[], sourceId: string, targetId: string, type: MemoryRelation["type"], note?: string): boolean {
  const source = fragments.find(f => f.id === sourceId);
  const target = fragments.find(f => f.id === targetId);
  if (!source || !target) return false;

  source.relations = source.relations || [];
  const exists = source.relations.find(r => r.id === targetId && r.type === type);
  if (exists) {
    logger.flow("relation", "duplicate", { sourceId, targetId, type });
    return false;
  }

  logger.flow("relation", "add", { sourceId, targetId, type });

  source.relations.push({
    id: targetId,
    type,
    note: note || undefined,
    created: new Date().toISOString().split("T")[0] || "",
  });

  target.relations = target.relations || [];
  const reverseExists = target.relations.find(r => r.id === sourceId);
  if (!reverseExists) {
    target.relations.push({
      id: sourceId,
      type: "related_to",
      note: `Reverse of ${type}`,
      created: new Date().toISOString().split("T")[0] || "",
    });
  }

  return true;
}

export function loadMemory(): MemoryFragment[] {
  logger.data("memory.jsonl", "load_start");
  try {
    if (!fs.existsSync(MEMORY_FILE)) {
      return [];
    }
    const content = fs.readFileSync(MEMORY_FILE, "utf-8");
    if (!content.trim()) {
      return [];
    }
    const fragments = content
      .trim()
      .split("\n")
      .map(line => JSON.parse(line));
    logger.data("memory.jsonl", "loaded", { count: fragments.length });
    return fragments;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Failed to load memory", msg);
    return [];
  }
}

export function saveMemory(fragments: MemoryFragment[], options: { force?: boolean } = {}): void {
  try {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if ((!fragments || fragments.length === 0) && !options.force) {
      logger.warn("Aborted save of empty memory array");
      return;
    }

    logger.data("memory.jsonl", "save_start", { count: fragments?.length ?? 0, force: options.force });

    const jsonl = fragments && fragments.length > 0 ? fragments.map(f => JSON.stringify(f)).join("\n") : "";

    const backupFile = MEMORY_FILE + ".bak";
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, "utf-8");
        const backupEntries = backupContent.trim().split("\n").filter(Boolean).map(l => JSON.parse(l));
        const backupIds = new Set(backupEntries.map((e: MemoryFragment) => e.id));
        const newEntries = fragments.filter(f => !backupIds.has(f.id));
        if (newEntries.length > 0) {
          const merged = [...backupEntries, ...newEntries];
          fs.writeFileSync(backupFile, merged.map(f => JSON.stringify(f)).join("\n"), "utf-8");
          logger.data("memory.jsonl.bak", "backup_merge", { newEntries: newEntries.length });
        }
      } catch {
        fs.writeFileSync(backupFile, jsonl, "utf-8");
      }
    } else {
      fs.writeFileSync(backupFile, jsonl, "utf-8");
    }

    fs.writeFileSync(MEMORY_FILE, jsonl, "utf-8");
    logger.data("memory.jsonl", "saved", { count: fragments?.length ?? 0 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error("Failed to save memory", msg);
    throw error;
  }
}

let writeLock = false;
let writeQueue: Array<() => void> = [];

function acquireLock(): Promise<void> {
  return new Promise((resolve) => {
    if (!writeLock) {
      writeLock = true;
      resolve();
    } else {
      writeQueue.push(resolve);
    }
  });
}

function releaseLock(): void {
  writeLock = false;
  if (writeQueue.length > 0) {
    writeLock = true;
    const next = writeQueue.shift()!;
    next();
  }
}

export async function saveMemorySafe(fragments: MemoryFragment[], options: { force?: boolean } = {}): Promise<void> {
  logger.data("memory.jsonl", "acquiring_lock");
  await acquireLock();
  try {
    saveMemory(fragments, options);
  } finally {
    releaseLock();
    logger.data("memory.jsonl", "released_lock");
  }
}

export function applySessionDecay(): MemoryFragment[] {
  logger.flow("decay", "session_start");
  const memory = loadMemory();
  const decayed = decayConfidence(memory);
  saveMemory(decayed);
  logger.flow("decay", "session_complete", { count: memory.length });
  return decayed;
}

export function migrateConfidenceFloor(): number {
  logger.flow("migration", "confidence_floor");
  const memory = loadMemory();
  let migrated = 0;
  const updated = memory.map(frag => {
    if (frag.confidence < 0.3) {
      migrated++;
      return { ...frag, confidence: 0.3 };
    }
    return frag;
  });
  if (migrated > 0) {
    saveMemory(updated);
  }
  logger.flow("migration", "migrated", { count: migrated });
  return migrated;
}

export function filterByProject(fragments: MemoryFragment[], currentProject: string | null): MemoryFragment[] {
  const project = (typeof currentProject === 'string')
    ? currentProject.trim().toLowerCase() || null
    : null;

  if (!project) {
    return fragments.filter(f => f.project === null || f.project === undefined);
  }
  return fragments.filter(f =>
    (f.project && f.project.toLowerCase() === project) ||
    (f.project === null || f.project === undefined)
  );
}

export function decayConfidence(fragments: MemoryFragment[]): MemoryFragment[] {
  const DECAY_RATE = 0.002;

  return fragments
    .map(frag => {
      if (frag.accessed > 0) {
        return {
          ...frag,
          accessed: 0,
          negativeHits: 0
        };
      }

      const newConfidence = frag.confidence - DECAY_RATE;

      return {
        ...frag,
        confidence: Math.max(0, newConfidence),
        accessed: 0,
        negativeHits: 0
      };
    });
}

function injectionScore(fragment: MemoryFragment): number {
  const confidence = fragment.confidence;
  const daysSinceCreated = (Date.now() - new Date(fragment.created).getTime()) / 86400000;
  const recency = Math.max(0, 1 - daysSinceCreated / 180);
  return confidence * 0.7 + recency * 0.3;
}

export function searchAndSortFragments(fragments: MemoryFragment[], query: string | null = null, topK = 30): MemoryFragment[] {
  logger.flow("search", "start", { query: query?.slice(0, 50), topK, totalFragments: fragments.length });
  const nowDate = new Date().toISOString();

  if (!query) {
    const sorted = [...fragments]
      .sort((a, b) => injectionScore(b) - injectionScore(a))
      .slice(0, topK);

    sorted.forEach(frag => { frag.lastAccessed = nowDate; });
    return sorted;
  }

  const fuseOptions = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'fragment', weight: 0.6 }
    ],
    threshold: 0.3,
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true
  };

  const fuse = new Fuse(fragments, fuseOptions);
  const fuseResults = fuse.search(query, { limit: topK });

  if (fuseResults.length > 0) {
    logger.flow("search", "fuse_results", { count: fuseResults.length });
    const topResults = fuseResults.map(r => r.item);
    topResults.sort((a, b) => injectionScore(b) - injectionScore(a));
    topResults.forEach(frag => { frag.lastAccessed = nowDate; });
    return topResults;
  }

  logger.flow("search", "fallback");
  const fallback = [...fragments]
    .sort((a, b) => injectionScore(b) - injectionScore(a))
    .slice(0, topK);

  fallback.forEach(frag => { frag.lastAccessed = nowDate; });
  return fallback;
}

export function filterFragments(
  fragments: MemoryFragment[],
  options: {
    minConfidence?: number;
    afterDate?: string;
    beforeDate?: string;
  } = {}
): MemoryFragment[] {
  let result = fragments;

  if (options.minConfidence !== undefined && options.minConfidence !== null) {
    result = result.filter(f => f.confidence >= options.minConfidence!);
  }

  if (options.afterDate) {
    const after = new Date(options.afterDate);
    if (!isNaN(after.getTime())) {
      result = result.filter(f => {
        const created = new Date(f.created);
        return !isNaN(created.getTime()) && created >= after;
      });
    }
  }

  if (options.beforeDate) {
    const before = new Date(options.beforeDate);
    if (!isNaN(before.getTime())) {
      result = result.filter(f => {
        const created = new Date(f.created);
        return !isNaN(created.getTime()) && created <= before;
      });
    }
  }

  return result;
}

export function formatMemoryForLLM(fragments: MemoryFragment[], currentProject: string | null = null): string {
  const projectHeader = currentProject ? ` (${currentProject})` : "";

  if (fragments.length === 0) {
    return `## Memory Fragments${projectHeader}\n---\n(no fragments)\n---`;
  }

  const lines = fragments.map(frag => {
    const scopeTag = frag.project || "global";
    const summary = frag.description || frag.title;
    return `[${frag.id}] [${scopeTag}] ${frag.title} — ${summary}`;
  });

  return `## Memory Fragments${projectHeader}\n---\n${lines.join("\n")}\n---`;
}

export function formatMemoryDetail(fragment: MemoryFragment | null): string {
  if (!fragment) {
    return "Fragment not found.";
  }

  const barCount = Math.round(fragment.confidence / 0.2);
  const confidenceBar = "█".repeat(barCount) + "░".repeat(5 - barCount);
  const sourceIcon = fragment.source === "ai" ? "🤖" : "👤";
  const scopeTag = fragment.project ? `[${fragment.project}]` : "[global]";

  let detail = `=== MEMORY FRAGMENT DETAIL ===\n`;
  detail += `ID: [${fragment.id}] ${confidenceBar} (${sourceIcon}) ${scopeTag}\n`;
  detail += `Title: ${fragment.title}\n`;
  if (fragment.description && fragment.description !== fragment.title) {
    detail += `Summary: ${fragment.description}\n`;
  }
  detail += `Created: ${fragment.created} | Confidence: ${fragment.confidence.toFixed(2)}\n`;
  if (fragment.tags && fragment.tags.length > 0) {
    detail += `Tags: ${fragment.tags.join(", ")}\n`;
  }
  if (fragment.associatedWith && fragment.associatedWith.length > 0) {
    detail += `Related: ${fragment.associatedWith.join(", ")}\n`;
  }
  if (fragment.relations && fragment.relations.length > 0) {
    detail += `Relations:\n`;
    for (const rel of fragment.relations) {
      detail += `  ${rel.type} → [${rel.id}]${rel.note ? ` — ${rel.note}` : ""}\n`;
    }
  }
  if (fragment.positive_feedback > 0 || fragment.negative_feedback > 0) {
    detail += `Feedback: ${fragment.positive_feedback || 0} positive, ${fragment.negative_feedback || 0} negative\n`;
  }
  if (fragment.refinement_count > 0) {
    detail += `Refinements: ${fragment.refinement_count}\n`;
  }
  if (fragment.parent_id) {
    detail += `Refined from: [${fragment.parent_id}]\n`;
  }
  if (fragment.child_ids && fragment.child_ids.length > 0) {
    detail += `Refined into: ${fragment.child_ids.map(id => `[${id}]`).join(", ")}\n`;
  }
  detail += `--- CONTENT ---\n${fragment.fragment}\n==============`;

  return detail;
}

export function calculateStats(fragments: MemoryFragment[], project: string | null = null): MemoryStats {
  const filtered = project
    ? filterByProject(fragments, project)
    : fragments;

  if (filtered.length === 0) {
    return {
      total: 0,
      avg_confidence: 0,
      by_source: {},
      by_project: {},
      low_confidence: 0,
      high_confidence: 0,
    };
  }

  const avgConf = filtered.reduce((sum, f) => sum + f.confidence, 0) / filtered.length;
  const bySource: Record<string, number> = {};
  const byProject: Record<string, number> = {};

  for (const f of filtered) {
    bySource[f.source] = (bySource[f.source] || 0) + 1;
    const scope = f.project || "global";
    byProject[scope] = (byProject[scope] || 0) + 1;
  }

  return {
    total: filtered.length,
    avg_confidence: Math.round(avgConf * 100) / 100,
    by_source: bySource,
    by_project: byProject,
    low_confidence: filtered.filter(f => f.confidence < 0.3).length,
    high_confidence: filtered.filter(f => f.confidence > 0.8).length,
  };
}

export function formatStats(stats: MemoryStats): string {
  let output = `## Memory Stats\n`;
  output += `Total: ${stats.total} fragments | Avg confidence: ${stats.avg_confidence}\n`;
  if (stats.total > 0) {
    output += `High confidence (>0.8): ${stats.high_confidence} | Low (<0.3): ${stats.low_confidence}\n`;
    const sources = Object.entries(stats.by_source).map(([k, v]) => `${k}: ${v}`).join(", ");
    output += `Sources: ${sources}\n`;
    const projects = Object.entries(stats.by_project).map(([k, v]) => `${k}: ${v}`).join(", ");
    output += `Projects: ${projects}\n`;
  }
  return output;
}

export function auditMemory(fragments: MemoryFragment[]): AuditResult {
  const issues: string[] = [];
  const ids = new Set<string>();
  const duplicates: string[] = [];

  for (const f of fragments) {
    if (ids.has(f.id)) {
      duplicates.push(f.id);
    }
    ids.add(f.id);

    if (typeof f.confidence !== "number" || f.confidence < 0 || f.confidence > 1) {
      issues.push(`Fragment [${f.id}] has invalid confidence: ${f.confidence}`);
    }

    if (!f.fragment || typeof f.fragment !== "string") {
      issues.push(`Fragment [${f.id}] has missing or invalid fragment text`);
    }

    if (f.associatedWith) {
      for (const assocId of f.associatedWith) {
        if (!ids.has(assocId) && !fragments.find(x => x.id === assocId)) {
          issues.push(`Fragment [${f.id}] references non-existent associated fragment [${assocId}]`);
        }
      }
    }

    if (f.relations) {
      for (const rel of f.relations) {
        if (!ids.has(rel.id) && !fragments.find(x => x.id === rel.id)) {
          issues.push(`Fragment [${f.id}] has relation to non-existent fragment [${rel.id}]`);
        }
      }
    }
  }

  if (duplicates.length > 0) {
    issues.push(`Duplicate IDs found: ${duplicates.join(", ")}`);
  }

  return {
    total_fragments: fragments.length,
    issues_found: issues.length,
    issues,
    healthy: issues.length === 0,
  };
}

export function formatAuditReport(result: AuditResult): string {
  let output = `## Memory Audit\n`;
  output += `Total fragments: ${result.total_fragments} | Issues: ${result.issues_found}\n`;
  if (result.issues.length > 0) {
    for (const issue of result.issues) {
      output += `  ! ${issue}\n`;
    }
  } else {
    output += `All clear — no issues found.\n`;
  }
  return output;
}
