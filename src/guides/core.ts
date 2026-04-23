import os from "os";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import Fuse from "fuse.js";
import { TASK_GUIDE_MAP } from "./task-map.js";
import { logger } from "../logger.js";
import type { Guide, GuideSuggestion, SuggestResult } from "../types.js";

interface GuideUpdates {
  guide?: string;
  category?: string;
  description?: string;
  add_anti_patterns?: string[];
  add_pitfalls?: string[];
  superseded_by?: string;
  deprecated?: boolean;
}

let MEMORY_DIR: string = path.join(os.homedir(), ".lemma");
let GUIDES_FILE: string = path.join(MEMORY_DIR, "guides.jsonl");

export function setGuidesDir(dir: string): void {
  MEMORY_DIR = dir;
  GUIDES_FILE = path.join(MEMORY_DIR, "guides.jsonl");
}

export function generateGuideId(): string {
  return "g" + crypto.randomUUID().replace(/-/g, "").substring(0, 12);
}

export function getToday(): string {
  return new Date().toISOString().split("T")[0] ?? "";
}

export function createGuide(
  guide: string,
  category: string,
  description: string = "",
  contexts: string[] = [],
  learnings: string[] = []
): Guide {
  logger.flow("guide_create", "start", { guide, category });
  const result: Guide = {
    id: generateGuideId(),
    guide: guide.toLowerCase().trim(),
    category: category.toLowerCase().trim(),
    description: description.trim(),
    usage_count: 1,
    last_used: getToday(),
    contexts: contexts.map(c => c.toLowerCase().trim()).filter(Boolean),
    learnings: learnings.map(l => l.trim()).filter(Boolean),
    success_count: 0,
    failure_count: 0,
    anti_patterns: [],
    known_pitfalls: [],
    last_refined: null,
    depends_on: [],
    enables: [],
    superseded_by: null,
    deprecated: false
  };
  logger.flow("guide_create", "created", { id: result.id });
  return result;
}

export function loadGuides(): Guide[] {
  logger.data("guides.jsonl", "load_start");
  try {
    if (!fs.existsSync(GUIDES_FILE)) {
      logger.data("guides.jsonl", "loaded", { count: 0 });
      return [];
    }
    const content = fs.readFileSync(GUIDES_FILE, "utf-8");
    if (!content.trim()) {
      logger.data("guides.jsonl", "loaded", { count: 0 });
      return [];
    }
    const guides = content
      .trim()
      .split("\n")
      .map((line: string) => JSON.parse(line));
    logger.data("guides.jsonl", "loaded", { count: guides.length });
    return guides;
  } catch (error: unknown) {
    logger.error("Error loading guides:", { error: (error as Error).message });
    return [];
  }
}

export function saveGuides(guides: Guide[], options: { force?: boolean } = {}): void {
  logger.data("guides.jsonl", "save_start", { count: guides?.length ?? 0 });
  try {
    const dir = path.dirname(GUIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if ((!guides || guides.length === 0) && !options.force) {
      logger.warn("Attempted to save empty guides array - ABORTED to prevent data loss");
      return;
    }

    const jsonl = guides && guides.length > 0 ? guides.map(g => JSON.stringify(g)).join("\n") : "";

    const backupFile = GUIDES_FILE + ".bak";
    if (fs.existsSync(backupFile)) {
      try {
        const backupContent = fs.readFileSync(backupFile, "utf-8");
        const backupEntries = backupContent.trim().split("\n").filter(Boolean).map((l: string) => JSON.parse(l));
        const backupIds = new Set(backupEntries.map((e: { id: string }) => e.id));
        const newEntries = guides.filter(g => !backupIds.has(g.id));
        if (newEntries.length > 0) {
          const merged = [...backupEntries, ...newEntries];
          logger.data("guides.jsonl", "backup_merge", { existing: backupEntries.length, newEntries: newEntries.length, merged: merged.length });
          fs.writeFileSync(backupFile, merged.map((g: { id: string }) => JSON.stringify(g)).join("\n"), "utf-8");
        } else {
          logger.data("guides.jsonl", "backup_unchanged", { existing: backupEntries.length });
        }
      } catch {
        fs.writeFileSync(backupFile, jsonl, "utf-8");
      }
    } else {
      fs.writeFileSync(backupFile, jsonl, "utf-8");
    }

    fs.writeFileSync(GUIDES_FILE, jsonl, "utf-8");
    logger.data("guides.jsonl", "saved", { count: guides?.length ?? 0 });
  } catch (error: unknown) {
    logger.error("Error saving guides:", { error: (error as Error).message });
    throw error;
  }
}

export function promoteToGuide(
  guides: Guide[],
  guideName: string,
  category: string,
  knowledge: string,
  context: string = ""
): Guide {
  logger.flow("guide_distill", "start", { guideName, memoryId: context });
  let guide = findGuide(guides, guideName);

  if (!guide) {
    guide = createGuide(guideName, category, `Created via distillation from memory.`, [context], [knowledge]);
    guides.push(guide);
    logger.flow("guide_distill", "created", { guide: guideName });
  } else {
    if (!guide.learnings.includes(knowledge)) {
      guide.learnings.push(knowledge);
    }
    if (context && !guide.contexts.includes(context)) {
      guide.contexts.push(context.toLowerCase().trim());
    }
    guide.usage_count += 1;
    guide.last_used = getToday();
    logger.flow("guide_distill", "updated", { guide: guideName });
  }

  return guide;
}

export function findGuide(guides: Guide[], guideName: string): Guide | null {
  const normalized = guideName.toLowerCase().trim();
  return guides.find(g => g.guide === normalized) || null;
}

export function findSimilarGuide(guides: Guide[], guideName: string): Guide | null {
  logger.flow("guide_find", "searching", { guideName });
  const normalized = guideName.toLowerCase().trim();

  const exact = guides.find(g => g.guide === normalized);
  if (exact) {
    logger.flow("guide_find", "found", { guideName, method: "exact" });
    return exact;
  }

  if (guides.length === 0) {
    logger.flow("guide_find", "not_found", { guideName, reason: "empty_guides" });
    return null;
  }

  const fuse = new Fuse<Guide>(guides, {
    keys: ['guide'],
    threshold: 0.3,
    includeScore: true,
    ignoreLocation: true,
  });

  const results = fuse.search(normalized, { limit: 1 });
  const topResult = results[0];
  if (topResult && (topResult.score ?? 1) < 0.25) {
    logger.flow("guide_find", "found", { guideName, method: "fuzzy", score: topResult.score });
    return topResult.item;
  }

  logger.flow("guide_find", "not_found", { guideName });
  return null;
}

export function updateGuide(guides: Guide[], guideName: string, updates: GuideUpdates): Guide | null {
  logger.flow("guide_update", "start", { guideName });
  const guide = findGuide(guides, guideName);
  if (!guide) {
    logger.flow("guide_update", "not_found", { guideName });
    return null;
  }

  const fieldsUpdated: string[] = [];
  if (updates.guide) { guide.guide = updates.guide.toLowerCase().trim(); fieldsUpdated.push("guide"); }
  if (updates.category) { guide.category = updates.category.toLowerCase().trim(); fieldsUpdated.push("category"); }
  if (updates.description) { guide.description = updates.description.trim(); fieldsUpdated.push("description"); }
  if (updates.add_anti_patterns) {
    guide.anti_patterns = [...(guide.anti_patterns || []), ...updates.add_anti_patterns];
    fieldsUpdated.push("anti_patterns");
  }
  if (updates.add_pitfalls) {
    guide.known_pitfalls = [...(guide.known_pitfalls || []), ...updates.add_pitfalls];
    fieldsUpdated.push("pitfalls");
  }
  if (updates.superseded_by) {
    guide.superseded_by = updates.superseded_by;
    fieldsUpdated.push("superseded_by");
  }
  if (updates.deprecated === true) {
    guide.deprecated = true;
    fieldsUpdated.push("deprecated");
  }

  logger.flow("guide_update", "complete", { guideName, fields: fieldsUpdated });
  return guide;
}

export function deleteGuide(guides: Guide[], guideName: string): boolean {
  logger.flow("guide_delete", "start", { guideName });
  const normalized = guideName.toLowerCase().trim();
  const initialLength = guides.length;
  const filtered = guides.filter(g => g.guide !== normalized);

  if (filtered.length === initialLength) {
    logger.flow("guide_delete", "not_found", { guideName });
    return false;
  }

  guides.length = 0;
  guides.push(...filtered);
  logger.flow("guide_delete", "deleted", { guideName });
  return true;
}

export function practiceGuide(
  guides: Guide[],
  guideName: string,
  category: string,
  description: string = "",
  newContexts: string[] = [],
  newLearnings: string[] = [],
  outcome: string | null = null
): Guide {
  logger.flow("guide_practice", "start", { guide: guideName, category });
  let guide = findSimilarGuide(guides, guideName);

  if (!guide) {
    guide = createGuide(guideName, category, description, newContexts, newLearnings);
    guides.push(guide);
    logger.flow("guide_practice", "created_new", { guide: guideName });
    logger.flow("guide_practice", "complete", { guide: guideName, usageCount: guide.usage_count, learningsCount: guide.learnings.length });
    return guide;
  }

  guide.usage_count += 1;
  guide.last_used = getToday();
  logger.flow("guide_practice", "updated", { guide: guideName, usageCount: guide.usage_count });

  if (!guide.description && description) {
    guide.description = description.trim();
  }

  const existingContexts = new Set(guide.contexts.map(c => c.toLowerCase()));
  for (const ctx of newContexts) {
    const normalized = ctx.toLowerCase().trim();
    if (normalized && !existingContexts.has(normalized)) {
      guide.contexts.push(normalized);
      existingContexts.add(normalized);
    }
  }

  const existingLearnings = new Set(guide.learnings);
  for (const learning of newLearnings) {
    const trimmed = learning.trim();
    if (trimmed && !existingLearnings.has(trimmed)) {
      guide.learnings.push(trimmed);
      existingLearnings.add(trimmed);
    }
  }

  if (outcome === "success") {
    guide.success_count = (guide.success_count || 0) + 1;
  } else if (outcome === "failure") {
    guide.failure_count = (guide.failure_count || 0) + 1;
  }

  logger.flow("guide_practice", "complete", { guide: guideName, usageCount: guide.usage_count, learningsCount: guide.learnings.length });
  return guide;
}

export function getTopGuides(guides: Guide[], limit: number = 20): Guide[] {
  return [...guides]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, limit);
}

export function getGuidesByCategory(guides: Guide[], category: string): Guide[] {
  const normalized = category.toLowerCase().trim();
  return guides.filter(g => g.category === normalized);
}

export function formatGuidesForLLM(guides: Guide[]): string {
  if (guides.length === 0) {
    return `## Guides\n---\n(no guides tracked yet)\n---`;
  }

  const sorted = getTopGuides(guides, 30);

  const lines = sorted.map(guide => {
    return `[${guide.category}] ${guide.guide} — ${guide.usage_count}x usage, ${guide.learnings.length} learnings`;
  });

  return `## Guides\n---\n${lines.join("\n")}\n---`;
}

function tokenize(str: string): Set<string> {
  if (!str) return new Set();
  const tokens = str.toLowerCase()
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2);
  return new Set(tokens);
}

function hasTokenMatch(text: string, target: string): boolean {
  const textTokens = tokenize(text);
  const targetTokens = tokenize(target);

  for (const token of textTokens) {
    if (targetTokens.has(token)) return true;
  }

  for (const textToken of textTokens) {
    for (const targetToken of targetTokens) {
      if (textToken.includes(targetToken) || targetToken.includes(textToken)) {
        return true;
      }
    }
  }

  return false;
}

export function suggestGuides(taskDescription: string, existingGuides: Guide[] = []): SuggestResult {
  logger.flow("guide_suggest", "start", { task: taskDescription?.slice(0, 50) });
  const suggestions: GuideSuggestion[] = [];
  const seen = new Set<string>();

  const fuseOptions = {
    keys: ['guide', 'keywords', 'contexts', 'learnings', 'description'],
    threshold: 0.45,
    distance: 100,
    minMatchCharLength: 2,
    includeScore: true,
    ignoreLocation: true,
    findAllMatches: true
  };

  const allGuideDefs = Object.values(TASK_GUIDE_MAP).flat().map(def => ({
    ...def,
    keywords: def.keywords || []
  }));

  const staticFuse = new Fuse(allGuideDefs, {
    ...fuseOptions,
    keys: ['guide', 'keywords']
  });

  const staticResults = staticFuse.search(taskDescription, { limit: 20 });
  logger.flow("guide_suggest", "static_results", { count: staticResults.length });

  for (const result of staticResults) {
    const guideDef = result.item;
    if (seen.has(guideDef.guide)) continue;
    seen.add(guideDef.guide);

    const existing = existingGuides.find(g => g.guide === guideDef.guide);
    suggestions.push({
      ...guideDef,
      tracked: !!existing,
      usage_count: existing?.usage_count || 0,
      last_used: existing?.last_used || null,
      learnings: existing?.learnings || [],
      contexts: existing?.contexts || [],
    });
  }

  if (existingGuides.length > 0) {
    const trackedFuse = new Fuse(existingGuides, {
      ...fuseOptions,
      keys: ['guide', 'contexts', 'learnings', 'description']
    });

    const trackedResults = trackedFuse.search(taskDescription, { limit: 20 });
    logger.flow("guide_suggest", "tracked_results", { count: trackedResults.length });

    for (const result of trackedResults) {
      const existing = result.item;
      if (seen.has(existing.guide)) continue;
      seen.add(existing.guide);

      suggestions.push({
        guide: existing.guide,
        category: existing.category,
        keywords: existing.contexts,
        tracked: true,
        usage_count: existing.usage_count,
        last_used: existing.last_used,
        learnings: existing.learnings,
        contexts: existing.contexts,
        description: existing.description,
      });
    }
  }

  const desc = taskDescription.toLowerCase();
  for (const existing of existingGuides) {
    if (seen.has(existing.guide)) continue;

    if (hasTokenMatch(desc, existing.guide) ||
      existing.contexts.some(ctx => hasTokenMatch(desc, ctx)) ||
      existing.learnings.some(l => hasTokenMatch(desc, l))) {
      seen.add(existing.guide);
      suggestions.push({
        guide: existing.guide,
        category: existing.category,
        keywords: existing.contexts,
        tracked: true,
        usage_count: existing.usage_count,
        last_used: existing.last_used,
        learnings: existing.learnings,
        contexts: existing.contexts,
        description: existing.description,
      });
    }
  }

  const tracked = suggestions.filter(s => s.tracked);
  const missing = suggestions.filter(s => !s.tracked);

  logger.flow("guide_suggest", "complete", { total: suggestions.length, tracked: tracked.length, missing: missing.length });

  return {
    relevant: tracked,
    missing: missing,
    suggested: suggestions,
    summary: `Found ${suggestions.length} relevant guides (${tracked.length} tracked, ${missing.length} new)`,
  };
}

export function formatSuggestions(result: SuggestResult): string {
  let output = `=== GUIDE SUGGESTIONS ===\n`;
  output += `${result.summary}\n\n`;

  if (result.relevant.length > 0) {
    output += `TRACKED (you have experience):\n`;
    for (const s of result.relevant) {
      output += `  ✓ [${s.category}] ${s.guide} (${s.usage_count}x, last: ${s.last_used || 'n/a'})\n`;
      if (s.learnings && s.learnings.length > 0) {
        for (const l of s.learnings.slice(0, 3)) {
          output += `      💡 ${l}\n`;
        }
        if (s.learnings.length > 3) {
          output += `      ... and ${s.learnings.length - 3} more learnings\n`;
        }
      }
    }
    output += `\n`;
  }

  if (result.missing.length > 0) {
    output += `SUGGESTED (not tracked yet):\n`;
    for (const s of result.missing) {
      output += `  + [${s.category}] ${s.guide}\n`;
      if (s.keywords && s.keywords.length > 0) {
        output += `      keywords: ${s.keywords.slice(0, 5).join(", ")}\n`;
      }
    }
    output += `\n`;
  }

  if (result.suggested.length === 0) {
    output += `No relevant guides found for this task.\n`;
    output += `Try describing the task with more specific terms.\n`;
  }

  output += `========================`;
  return output;
}

export function formatGuideDetail(guide: Guide | null): string {
  if (!guide) {
    return "Guide not found.";
  }

  let detail = `=== GUIDE: ${guide.guide} ===\n`;
  detail += `Category: ${guide.category}\n`;
  detail += `Usage Count: ${guide.usage_count}\n`;
  detail += `Last Used: ${guide.last_used}\n`;

  if (guide.description) {
    detail += `\n=== DESCRIPTION / PROTOCOLS ===\n${guide.description}\n===============================\n`;
  }

  if (guide.contexts.length > 0) {
    detail += `Contexts: ${guide.contexts.join(", ")}\n`;
  }

  if (guide.learnings.length > 0) {
    detail += `Learnings:\n`;
    for (const l of guide.learnings) {
      detail += `  - ${l}\n`;
    }
  }

  const totalAttempts = (guide.success_count || 0) + (guide.failure_count || 0);
  if (totalAttempts > 0) {
    const rate = (guide.success_count || 0) / totalAttempts;
    detail += `Success Rate: ${rate.toFixed(2)} (${guide.success_count || 0}/${totalAttempts})\n`;
  }

  if (guide.anti_patterns && guide.anti_patterns.length > 0) {
    detail += `Anti-patterns:\n`;
    for (const ap of guide.anti_patterns) {
      detail += `  - ${ap}\n`;
    }
  }

  if (guide.known_pitfalls && guide.known_pitfalls.length > 0) {
    detail += `Known Pitfalls:\n`;
    for (const kp of guide.known_pitfalls) {
      detail += `  - ${kp}\n`;
    }
  }

  if (guide.depends_on && guide.depends_on.length > 0) {
    detail += `Depends on: ${guide.depends_on.join(", ")}\n`;
  }

  if (guide.superseded_by) {
    detail += `Superseded by: ${guide.superseded_by}\n`;
  }

  detail += `====================`;
  return detail;
}

export { TASK_GUIDE_MAP };
