import * as core from "../memory/index.js";
import * as guides from "../guides/index.js";
import * as sessions from "../sessions/index.js";
import * as virtualSession from "../sessions/virtual.js";
import { logger } from "../logger.js";
import { isEmbeddingsReady, embed } from "../memory/embeddings.js";
import type { FragmentType } from "../types.js";

interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface SessionStartArgs {
  task_type?: string;
  technologies?: string[];
  initial_approach?: string;
}

interface SessionEndArgs {
  outcome?: string;
  final_approach?: string;
  lessons?: string[];
}

interface MemoryReadArgs {
  project?: string;
  query?: string;
  id?: string;
  context?: string;
  all?: boolean;
  ids?: string[];
  minConfidence?: number;
  afterDate?: string;
  beforeDate?: string;
}

interface MemoryAddArgs {
  fragment?: string;
  title?: string;
  description?: string;
  project?: string | null;
  source?: string;
  confirm?: boolean;
  type?: string;
}

interface MemoryUpdateArgs {
  id?: string;
  title?: string;
  fragment?: string;
  confidence?: number;
}

interface MemoryForgetArgs {
  id?: string;
}

interface MemoryFeedbackArgs {
  id?: string;
  useful?: boolean;
}

interface MemoryMergeArgs {
  ids?: string[];
  title?: string;
  fragment?: string;
  project?: string | null;
}

interface MemoryRelateArgs {
  sourceId?: string;
  targetId?: string;
  type?: string;
  note?: string;
}

interface MemoryStatsArgs {
  project?: string;
}

interface GuideGetArgs {
  category?: string;
  guide?: string;
  task?: string;
}

interface GuidePracticeArgs {
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
  outcome?: string;
}

interface GuideCreateArgs {
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
}

interface GuideDistillArgs {
  memory_id?: string;
  guide?: string;
  category?: string;
}

interface GuideUpdateArgs {
  guide?: string;
  new_name?: string;
  category?: string;
  description?: string;
  add_anti_patterns?: string[];
  add_pitfalls?: string[];
  superseded_by?: string;
  deprecated?: boolean;
}

interface GuideForgetArgs {
  guide?: string;
}

interface GuideMergeArgs {
  guides?: string[];
  guide?: string;
  category?: string;
  description?: string;
  contexts?: string[];
  learnings?: string[];
}

interface SessionStatsArgs {
  count?: number;
}

interface ToolCallRequest {
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
}

let activeSessionId: string | null = null;

let _notifyChange: (() => void) | null = null;

export function resetSessionState(): void {
  activeSessionId = null;
  virtualSession.finalizeVirtualSession();
}

export function autoStartSession(project: string | null): void {
  if (activeSessionId) {
    logger.flow("auto_session", "start_skipped", { reason: "already_active", activeSessionId });
    return;
  }

  console.error(`[Lemma] Auto-starting session (triggered by first tool call)`);

  const allSessions = sessions.loadSessions();
  const existing = sessions.findActiveSession(allSessions);
  if (existing) {
    existing.status = "abandoned";
    existing.task_outcome = "abandoned";
    console.error(`[Lemma] Abandoned previous session: ${existing.session_id}`);
  }

  const session = sessions.createSession("auto", []);
  session.initial_approach = null;
  activeSessionId = session.session_id;
  allSessions.push(session);
  sessions.saveSessions(allSessions);

  console.error(`[Lemma] Auto-session started: ${session.session_id} (project: ${project || "unknown"})`);
  logger.flow("auto_session", "started", { session_id: session.session_id, project });
}

export function autoEndSession(vs: any): void {
  if (!activeSessionId) return;

  const allSessions = sessions.loadSessions();
  const session = sessions.findSession(allSessions, activeSessionId);
  if (!session) return;

  const toolCount = vs.duration_tool_calls || 0;
  const techs = vs.technologies || [];
  const memCreated = vs.memories_created || [];
  const guidesUsed = vs.guides_used || [];
  const project = vs.project || null;

  sessions.endSession(session, "success", null, []);
  sessions.saveSessions(allSessions);
  activeSessionId = null;

  logger.flow("auto_session", "ended", {
    session_id: session.session_id,
    tool_calls: toolCount,
    techs: techs.length,
    mem_created: memCreated.length,
    guides_used: guidesUsed.length,
    project,
  });
}

function getSessionContext(): { memoriesAccessed: string[]; memoriesCreated: string[]; guidesUsed: string[] } {
  const vs = virtualSession.getCurrentVirtualSession();
  return {
    memoriesAccessed: vs ? [...vs.memories_accessed] : [],
    memoriesCreated: vs ? [...vs.memories_created] : [],
    guidesUsed: vs ? [...vs.guides_used] : [],
  };
}

function buildHookBlock(suggestions: string[]): string {
  if (suggestions.length === 0) return "";
  return "\n\nSUGGESTED ACTIONS:\n" + suggestions.map(s => `- ${s}`).join("\n");
}

export function setNotifyChange(fn: () => void): void {
  _notifyChange = fn;
  logger.debug("setNotifyChange", "notification handler registered");
}

function notifyMemoryChange(): void {
  if (_notifyChange) {
    logger.notify("memory_change", "sending");
    _notifyChange();
  }
}

export async function handleSessionStart(args?: SessionStartArgs): Promise<ToolResult> {
  const taskType = args?.task_type;
  const technologies = args?.technologies || [];
  const initialApproach = args?.initial_approach || null;

  logger.flow("session_start", "start", { task_type: taskType, technologies, has_initial_approach: !!initialApproach });

  if (!taskType) {
    logger.warn("session_start validation failed", { reason: "missing task_type" });
    return {
      content: [{ type: "text", text: "Error: 'task_type' parameter is required" }],
      isError: true,
    };
  }

  logger.data("sessions.json", "load");
  const allSessions = sessions.loadSessions();
  const existing = sessions.findActiveSession(allSessions);
  if (existing) {
    logger.flow("session_start", "abandon_existing", { session_id: existing.session_id, task_type: existing.task_type });
    existing.status = "abandoned";
    existing.task_outcome = "abandoned";
  }

  const session = sessions.createSession(taskType, technologies);
  session.initial_approach = initialApproach;
  activeSessionId = session.session_id;
  allSessions.push(session);
  logger.data("sessions.json", "save", { session_id: session.session_id, total_sessions: allSessions.length });
  sessions.saveSessions(allSessions);

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const taskDesc = [taskType, ...technologies].join(" ");
  const suggestions = guides.suggestGuides(taskDesc, allGuides);
  logger.flow("session_start", "guide_suggestions", { task_desc: taskDesc, relevant: suggestions.relevant.length, suggested: suggestions.suggested.length });

  const formattedSuggestions = guides.formatSuggestions(suggestions);

  logger.data("memory.json", "load");
  const allMemory = core.loadMemory();
  const projectMemory = core.filterByProject(allMemory, core.detectProject());
  const relevantResults = await core.searchAndSortFragments(projectMemory, taskDesc, 3);
  logger.flow("session_start", "preload_memories", { relevant_count: relevantResults.length, project_memory_count: projectMemory.length });

  for (const frag of relevantResults) {
    const boosted = core.boostOnAccess(frag);
    Object.assign(frag, boosted);
  }
  logger.data("memory.json", "save", { reason: "boost_preloaded", boosted_count: relevantResults.length });
  core.saveMemory(allMemory);

  let response = `Session started: ${session.session_id} (${taskType})\n`;
  if (technologies.length > 0) {
    response += `Technologies: ${technologies.join(", ")}\n`;
  }

  if (relevantResults.length > 0) {
    response += `\nPre-loaded memories:\n`;
    for (const frag of relevantResults) {
      const scopeTag = frag.project || "global";
      response += `  [${frag.id}] [${scopeTag}] ${frag.title} (${frag.confidence.toFixed(2)})\n`;
      response += `    ${frag.description}\n`;
    }
  }

  response += `\n${formattedSuggestions}`;

  logger.flow("session_start", "complete", { session_id: session.session_id, task_type: taskType, suggestions: suggestions.relevant.length + suggestions.suggested.length, preloaded: relevantResults.length });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleSessionEnd(args?: SessionEndArgs): Promise<ToolResult> {
  const outcome = args?.outcome;
  const finalApproach = args?.final_approach || null;
  const lessons = args?.lessons || [];

  logger.flow("session_end", "start", { outcome, has_final_approach: !!finalApproach, lesson_count: lessons.length });

  if (!outcome) {
    logger.warn("session_end validation failed", { reason: "missing outcome" });
    return {
      content: [{ type: "text", text: "Error: 'outcome' parameter is required" }],
      isError: true,
    };
  }

  logger.data("sessions.json", "load");
  const allSessions = sessions.loadSessions();
  const session = activeSessionId
    ? sessions.findSession(allSessions, activeSessionId)
    : sessions.findActiveSession(allSessions);

  if (!session) {
    logger.warn("session_end no active session", { activeSessionId });
    return {
      content: [{ type: "text", text: "Error: No active session to end." }],
      isError: true,
    };
  }

  logger.flow("session_end", "session_found", { session_id: session.session_id, task_type: session.task_type });

  sessions.endSession(session, outcome, finalApproach, lessons);

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const improvementLines: string[] = [];

  if (session.guides_used && session.guides_used.length > 0) {
    logger.flow("session_end", "evaluating_guides", { guides_used: session.guides_used, outcome });
    for (const guideName of session.guides_used) {
      const guide = guides.findGuide(allGuides, guideName);
      if (guide) {
        if (outcome === "success") {
          guide.success_count = (guide.success_count || 0) + 1;
        } else if (outcome === "failure") {
          guide.failure_count = (guide.failure_count || 0) + 1;
          const total = (guide.success_count || 0) + (guide.failure_count || 0);
          if (total >= 3) {
            const rate = guide.success_count / total;
            if (rate < 0.4) {
              logger.warn("session_end low guide success rate", { guide: guideName, success_rate: rate.toFixed(2), total });
              improvementLines.push(`  [!] Guide "${guideName}" success rate is ${rate.toFixed(2)} (${guide.success_count}/${total}). Consider refining with guide_update.`);
            }
          }
        }
      }
    }
    logger.data("guides.json", "save", { reason: "guide_success_tracking", guides_updated: session.guides_used.length });
    guides.saveGuides(allGuides);
  }

  logger.data("sessions.json", "save", { session_id: session.session_id, outcome });
  sessions.saveSessions(allSessions);
  activeSessionId = null;

  let response = `Session ${session.session_id} ended: ${outcome}\n`;
  response += `Task: ${session.task_type} | Duration: ${session.timestamp} → ${session.completed_at}\n`;
  if (lessons.length > 0) {
    response += `Lessons: ${lessons.length} recorded\n`;
  }
  if (improvementLines.length > 0) {
    response += `\nIMPROVEMENT SUGGESTIONS:\n${improvementLines.join("\n")}\n`;
  }

  const sCtx = getSessionContext();
  const reviewSuggestions: string[] = [];

  if (sCtx.memoriesAccessed.length > 0 || sCtx.memoriesCreated.length > 0 || sCtx.guidesUsed.length > 0) {
    response += `\nSESSION REVIEW:`;
    if (sCtx.memoriesAccessed.length > 0) {
      response += `\n  Memories read: ${sCtx.memoriesAccessed.map(m => `[${m}]`).join(", ")}`;
    }
    if (sCtx.memoriesCreated.length > 0) {
      response += `\n  Memories created: ${sCtx.memoriesCreated.map(m => `[${m}]`).join(", ")}`;
    }
    if (sCtx.guidesUsed.length > 0) {
      response += `\n  Guides used: ${sCtx.guidesUsed.join(", ")}`;
    }
    if (session.guides_used && session.guides_used.length > 0) {
      const notPracticed = session.guides_used.filter(g => !sCtx.guidesUsed.includes(g));
      if (notPracticed.length > 0) {
        response += `\n  Guides used but NOT practiced: ${notPracticed.join(", ")}`;
      }
    }

    if (sCtx.memoriesCreated.length > 0 && sCtx.memoriesAccessed.length > 0) {
      const allMemory = core.loadMemory();
      let relateCount = 0;
      for (const createdId of sCtx.memoriesCreated) {
        if (relateCount >= 3) break;
        const lastRead = sCtx.memoriesAccessed[sCtx.memoriesAccessed.length - 1];
        if (createdId !== lastRead) {
          core.addRelation(allMemory, createdId, lastRead, "related_to", "Auto-linked: same session");
          relateCount++;
        }
      }
      if (relateCount > 0) {
        core.saveMemory(allMemory);
        response += `\nAuto-linked ${relateCount} created memories to session context.`;
      }
    }
    if (sCtx.memoriesCreated.length > 0) {
      reviewSuggestions.push(`If any created memories represent reusable skills, call guide_distill to promote them.`);
    }
    if (session.guides_used && session.guides_used.length > 0) {
      const notPracticed = session.guides_used.filter(g => !sCtx.guidesUsed.includes(g));
      if (notPracticed.length > 0) {
        reviewSuggestions.push(`Guides used but not practiced: ${notPracticed.join(", ")}. Call guide_practice to track experience.`);
      }
    }
  }

  const vs = virtualSession.getCurrentVirtualSession();
  if (vs && vs.technologies_seen && vs.technologies_seen.size > 0) {
    const techs = [...vs.technologies_seen];
    response += `\nAuto-detected technologies: ${techs.join(", ")}`;
    const matchedGuides = techs.filter(t => guides.findGuide(allGuides, t));
    if (matchedGuides.length > 0) {
      response += `\nAuto-tracked guides: ${matchedGuides.join(", ")}`;
    }
  }

  response += buildHookBlock(reviewSuggestions);

  logger.flow("session_end", "complete", { session_id: session.session_id, outcome, improvement_suggestions: improvementLines.length });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryRead(args?: MemoryReadArgs): Promise<ToolResult> {
  const currentProject = args?.project || core.detectProject();
  const query = args?.query || null;
  const detailId = args?.id || null;
  const context = args?.context || null;
  const showAll = args?.all === true;

  logger.flow("memory_read", "start", { project: currentProject, query, id: detailId, ids: args?.ids?.length, all: showAll, context });

  let memory: any[] = core.loadMemory();
  logger.data("memory.json", "load", { total_fragments: memory.length });

  const detailIds = args?.ids || null;
  if (detailIds && Array.isArray(detailIds) && detailIds.length > 0) {
    logger.debug("memory_read batch_ids", { ids: detailIds });
    const results: string[] = [];
    for (const did of detailIds) {
      const fragment = memory.find((f: any) => f.id === did);
      if (fragment) {
        const boosted = core.boostOnAccess(fragment, context);
        Object.assign(fragment, boosted);
        results.push(core.formatMemoryDetail(fragment));
      } else {
        logger.warn("memory_read batch_id not_found", { id: did });
        results.push(`Fragment [${did}] not found.`);
      }
    }
    logger.data("memory.json", "save", { reason: "boost_batch_ids", count: detailIds.length });
    core.saveMemory(memory);
    notifyMemoryChange();
    logger.flow("memory_read", "complete_batch", { ids_requested: detailIds.length });
    return {
      content: [{ type: "text", text: results.join("\n\n") }],
    };
  }

  if (detailId) {
    logger.flow("memory_read", "single_id_lookup", { id: detailId });
    const fragment = memory.find((f: any) => f.id === detailId);
    if (!fragment) {
      logger.warn("memory_read id not_found", { id: detailId });
      return {
        content: [{ type: "text", text: `Error: Fragment with ID '${detailId}' not found` }],
        isError: true,
      };
    }
    const boosted = core.boostOnAccess(fragment, context);
    Object.assign(fragment, boosted);
    logger.data("memory.json", "save", { reason: "boost_single", id: detailId });
    core.saveMemory(memory);
    notifyMemoryChange();

    logger.flow("memory_read", "complete_single", { id: detailId, confidence: fragment.confidence?.toFixed(2) });
    return {
      content: [{ type: "text", text: core.formatMemoryDetail(fragment) }],
    };
  }

  const filteredMemory = showAll
    ? memory
    : core.filterByProject(memory, currentProject);

  logger.debug("memory_read filter", { showAll, project: currentProject, before_filter: memory.length, after_filter: filteredMemory.length });

  let results = await core.searchAndSortFragments(filteredMemory, query, 30);

  results = core.filterFragments(results, {
    minConfidence: args?.minConfidence,
    afterDate: args?.afterDate,
    beforeDate: args?.beforeDate,
  });

  logger.flow("memory_read", "search_results", { query, result_count: (results as any[]).length, minConfidence: args?.minConfidence });

  const resultIds = new Set((results as any[]).map((r: any) => r.id));
  for (const frag of memory) {
    if (resultIds.has(frag.id)) {
      const boosted = core.boostOnAccess(frag, context);
      Object.assign(frag, boosted);
    }
  }

  if (resultIds.size > 1) {
    const idArray = [...resultIds];
    for (const id of idArray) {
      const others = idArray.filter(x => x !== id);
      core.trackAssociations(memory, id, others);
    }
  }

  let autoRelateCount = 0;
  if (resultIds.size > 1) {
    const idArray = [...resultIds];
    const hub = idArray[0];
    for (let i = 1; i < idArray.length && autoRelateCount < 3; i++) {
      const success = core.addRelation(memory, hub, idArray[i], "related_to", "Auto-linked: co-read in same query");
      if (success) autoRelateCount++;
    }
  }

  const scopeInfo = showAll ? "all projects" : currentProject || "global";
  const formatted = core.formatMemoryForLLM(results, scopeInfo);
  logger.data("memory.json", "save", { reason: "boost_search_results", boosted_count: resultIds.size, auto_relate_count: autoRelateCount });
  core.saveMemory(memory);
  notifyMemoryChange();

  let hookResponse = formatted;
  if (autoRelateCount > 0) {
    hookResponse += `\nAuto-linked ${autoRelateCount} co-read fragments with related_to relations.`;
  }

  logger.flow("memory_read", "complete_search", { query, results: (results as any[]).length, scope: scopeInfo });
  return {
    content: [{ type: "text", text: hookResponse }],
  };
}

export async function handleMemoryAdd(args?: MemoryAddArgs): Promise<ToolResult> {
  const fragment = args?.fragment;
  const title = args?.title || null;
  const description = args?.description || null;
  const project = args?.project === undefined ? null : args.project;
  const source = (args?.source || "ai") as "user" | "ai";
  const validTypes: FragmentType[] = ["fact", "pattern", "lesson", "warning", "context"];
  const fragmentType = validTypes.includes((args?.type || "") as FragmentType)
    ? (args?.type as FragmentType)
    : "fact";

  logger.flow("memory_add", "start", { title, project, source, type: fragmentType, has_description: !!description, fragment_length: fragment?.length });

  if (!fragment || typeof fragment !== "string") {
    logger.warn("memory_add validation failed", { reason: "missing or invalid fragment" });
    return {
      content: [{ type: "text", text: "Error: 'fragment' parameter is required and must be a string" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory: any[] = core.loadMemory();

  const similarMatch = core.findSimilarFragment(memory, fragment, project);
  if (similarMatch) {
    logger.warn("memory_add duplicate_detected", { similar_id: similarMatch.id, similar_title: similarMatch.title });
    return {
      content: [{
        type: "text",
        text: `A similar memory already exists [${similarMatch.id}]: "${similarMatch.title}"\nUse memory_update on [${similarMatch.id}] if you want to modify it.`
      }],
      isError: true,
    };
  }

  logger.flow("memory_add", "secret_detection", { confirm: args?.confirm });
  const { redacted, found } = core.redactSecrets(fragment);
  const hasSecrets = found.length > 0;
  const finalFragment = hasSecrets && !args?.confirm ? redacted : fragment;

  if (hasSecrets) {
    logger.warn("memory_add secrets_detected", { secret_types: found.map(f => f.type), confirmed: !!args?.confirm });
  }

  const newFragment = core.createFragment(finalFragment, source, title, project, description, fragmentType);
  logger.flow("memory_add", "fragment_created", { id: newFragment.id, title: newFragment.title });

  if (fragmentType === "pattern" || fragmentType === "lesson") {
    newFragment.distill_candidate = true;
  }

  if (activeSessionId) {
    logger.data("sessions.json", "load");
    const allSessions = sessions.loadSessions();
    const session = sessions.findSession(allSessions, activeSessionId);
    if (session) {
      logger.flow("memory_add", "session_link", { session_id: activeSessionId, task_type: session.task_type });
      newFragment.session_id = activeSessionId;
      newFragment.task_type = session.task_type;
      session.memories_created = session.memories_created || [];
      session.memories_created.push(newFragment.id);
      logger.data("sessions.json", "save", { reason: "link_memory", session_id: activeSessionId });
      sessions.saveSessions(allSessions);
    }
  }
  memory.push(newFragment);
  logger.data("memory.json", "save", { reason: "add_fragment", id: newFragment.id, total: memory.length });

  if (isEmbeddingsReady()) {
    try {
      const vector = await embed(`${newFragment.title} ${newFragment.fragment}`);
      if (vector) {
        newFragment.embedding = vector;
        logger.flow("memory_add", "embedded", { id: newFragment.id });
      }
    } catch {}
  }

  core.saveMemory(memory);
  notifyMemoryChange();

  const overlaps = core.findTopicOverlaps(memory, finalFragment, project, 5);
  logger.flow("memory_add", "overlap_check", { overlap_count: overlaps.length });

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  let response = `Added fragment [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nSummary: ${newFragment.description}`;
  if (newFragment.distill_candidate) {
    response += `\nFlagged as distill candidate (type: ${fragmentType}).`;
  }
  if (hasSecrets) {
    response += `\n\n⚠️ Privacy: ${found.length} potential secret(s) detected and auto-redacted: ${found.map(f => f.type).join(", ")}. Use confirm: true to store as-is.`;
  }
  if (overlaps.length > 0) {
    const strongest = overlaps[0];
    core.addRelation(memory, newFragment.id, strongest.id, "related_to", `Auto-linked: topic overlap (${strongest.confidence.toFixed(2)})`);
    core.saveMemory(memory);
    notifyMemoryChange();
    response += `\n\nRelated memories (auto-linked to strongest match):`;
    response += `\n  [${strongest.id}] "${strongest.title}" (${strongest.confidence.toFixed(2)}) — AUTO-LINKED`;
    for (let i = 1; i < overlaps.length; i++) {
      response += `\n  [${overlaps[i].id}] "${overlaps[i].title}" (${overlaps[i].confidence.toFixed(2)})`;
    }
  }

  const hookSuggestions: string[] = [];
  const sCtx = getSessionContext();
  const otherAccessed = sCtx.memoriesAccessed.filter(mid => mid !== newFragment.id);
  if (otherAccessed.length > 0) {
    const lastRead = otherAccessed[otherAccessed.length - 1];
    core.addRelation(memory, newFragment.id, lastRead, "related_to", "Auto-linked: same session context");
    core.saveMemory(memory);
    notifyMemoryChange();
    response += `\nAuto-linked to last read memory [${lastRead}] (same session context).`;
  }
  if (fragmentType === "pattern" || fragmentType === "lesson") {
    hookSuggestions.push(`This is a ${fragmentType}. Consider guide_distill to promote it into a reusable skill.`);
  }
  response += buildHookBlock(hookSuggestions);

  logger.flow("memory_add", "complete", { id: newFragment.id, title: newFragment.title, overlaps: overlaps.length });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryUpdate(args?: MemoryUpdateArgs): Promise<ToolResult> {
  const id = args?.id;
  const title = args?.title;
  const fragment = args?.fragment;
  const confidence = args?.confidence;

  logger.flow("memory_update", "start", { id, has_title: title !== undefined, has_fragment: fragment !== undefined, has_confidence: confidence !== undefined });

  if (!id || typeof id !== "string") {
    logger.warn("memory_update validation failed", { reason: "missing or invalid id" });
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required and must be a string" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory: any[] = core.loadMemory();
  const targetIndex = memory.findIndex((f: any) => f.id === id);

  if (targetIndex === -1) {
    logger.warn("memory_update fragment not_found", { id });
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  if (title !== undefined) {
    if (typeof title !== "string") {
      logger.warn("memory_update validation failed", { reason: "title not string" });
      return {
        content: [{ type: "text", text: "Error: 'title' must be a string" }],
        isError: true,
      };
    }
    logger.debug("memory_update updating_title", { id, new_title: title });
    memory[targetIndex].title = title;
  }

  if (fragment !== undefined) {
    if (typeof fragment !== "string") {
      logger.warn("memory_update validation failed", { reason: "fragment not string" });
      return {
        content: [{ type: "text", text: "Error: 'fragment' must be a string" }],
        isError: true,
      };
    }
    logger.debug("memory_update updating_fragment", { id });
    memory[targetIndex].fragment = fragment;
    memory[targetIndex].accessed++;
    memory[targetIndex].relations = (memory[targetIndex].relations || []).filter(
      (rel: any) => memory.some((f: any) => f.id === rel.id)
    );
    memory[targetIndex].embedding = undefined;
  }

  if (confidence !== undefined) {
    if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
      logger.warn("memory_update validation failed", { reason: "confidence out of range", confidence });
      return {
        content: [{ type: "text", text: "Error: 'confidence' must be a number between 0 and 1" }],
        isError: true,
      };
    }
    logger.debug("memory_update updating_confidence", { id, new_confidence: confidence });
    memory[targetIndex].confidence = confidence;
  }

  if (isEmbeddingsReady() && memory[targetIndex].embedding === undefined && (fragment !== undefined || title !== undefined)) {
    try {
      const vector = await embed(`${memory[targetIndex].title} ${memory[targetIndex].fragment}`);
      if (vector) {
        memory[targetIndex].embedding = vector;
        logger.flow("memory_update", "re_embedded", { id });
      }
    } catch {}
  }

  logger.data("memory.json", "save", { reason: "update_fragment", id });
  core.saveMemory(memory);
  notifyMemoryChange();

  let updateResponse = `Updated fragment [${id}]: "${memory[targetIndex].title}"`;
  if (fragment !== undefined) {
    updateResponse += `\nOrphan relations cleaned up after content change.`;
  }

  logger.flow("memory_update", "complete", { id, title: memory[targetIndex].title });
  return {
    content: [{ type: "text", text: updateResponse }],
  };
}

export async function handleMemoryForget(args?: MemoryForgetArgs): Promise<ToolResult> {
  const id = args?.id;

  logger.flow("memory_forget", "start", { id });

  if (!id || typeof id !== "string") {
    logger.warn("memory_forget validation failed", { reason: "missing or invalid id" });
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required and must be a string" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory: any[] = core.loadMemory();
  const initialLength = memory.length;
  const filtered = memory.filter((f: any) => f.id !== id);

  if (filtered.length === initialLength) {
    logger.warn("memory_forget fragment not_found", { id });
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  logger.data("memory.json", "save", { reason: "forget_fragment", id, before: initialLength, after: filtered.length });
  core.saveMemory(filtered, { force: true });
  notifyMemoryChange();

  logger.flow("memory_forget", "complete", { id });
  return {
    content: [{ type: "text", text: `Forgot fragment with ID: ${id}` }],
  };
}

export async function handleMemoryFeedback(args?: MemoryFeedbackArgs): Promise<ToolResult> {
  const id = args?.id;
  const useful = args?.useful;

  logger.flow("memory_feedback", "start", { id, useful });

  if (!id || typeof id !== "string") {
    logger.warn("memory_feedback validation failed", { reason: "missing or invalid id" });
    return {
      content: [{ type: "text", text: "Error: 'id' parameter is required" }],
      isError: true,
    };
  }
  if (typeof useful !== "boolean") {
    logger.warn("memory_feedback validation failed", { reason: "missing or invalid useful" });
    return {
      content: [{ type: "text", text: "Error: 'useful' parameter is required and must be a boolean" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory: any[] = core.loadMemory();
  const targetIndex = memory.findIndex((f: any) => f.id === id);

  if (targetIndex === -1) {
    logger.warn("memory_feedback fragment not_found", { id });
    return {
      content: [{ type: "text", text: `Error: Fragment with ID '${id}' not found` }],
      isError: true,
    };
  }

  if (useful) {
    const boosted = core.boostOnAccess(memory[targetIndex]);
    Object.assign(memory[targetIndex], boosted);
    memory[targetIndex].positive_feedback = (memory[targetIndex].positive_feedback || 0) + 1;
    logger.data("memory.json", "save", { reason: "positive_feedback", id, new_confidence: memory[targetIndex].confidence?.toFixed(2) });
    core.saveMemory(memory);
    notifyMemoryChange();
    logger.flow("memory_feedback", "complete_positive", { id, confidence: memory[targetIndex].confidence?.toFixed(2) });
    return {
      content: [{ type: "text", text: `Positive feedback recorded for [${id}]. Confidence boosted to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  } else {
    const penalized = core.recordNegativeHit(memory[targetIndex]);
    Object.assign(memory[targetIndex], penalized);
    memory[targetIndex].negative_feedback = (memory[targetIndex].negative_feedback || 0) + 1;
    logger.data("memory.json", "save", { reason: "negative_feedback", id, new_confidence: memory[targetIndex].confidence?.toFixed(2) });
    core.saveMemory(memory);
    notifyMemoryChange();
    logger.flow("memory_feedback", "complete_negative", { id, confidence: memory[targetIndex].confidence?.toFixed(2) });
    return {
      content: [{ type: "text", text: `Negative feedback recorded for [${id}]. Confidence reduced to ${memory[targetIndex].confidence.toFixed(2)}.` }],
    };
  }
}

export async function handleMemoryMerge(args?: MemoryMergeArgs): Promise<ToolResult> {
  const ids = args?.ids;
  const title = args?.title;
  const fragment = args?.fragment;
  const project = args?.project === undefined ? null : args.project;

  logger.flow("memory_merge", "start", { ids, title, project });

  if (!ids || !Array.isArray(ids) || ids.length < 2) {
    logger.warn("memory_merge validation failed", { reason: "ids must be array with at least 2 elements" });
    return {
      content: [{ type: "text", text: "Error: 'ids' must be an array with at least 2 fragment IDs" }],
      isError: true,
    };
  }

  if (!title || typeof title !== "string") {
    logger.warn("memory_merge validation failed", { reason: "title required" });
    return {
      content: [{ type: "text", text: "Error: 'title' is required and must be a string" }],
      isError: true,
    };
  }

  if (!fragment || typeof fragment !== "string") {
    logger.warn("memory_merge validation failed", { reason: "fragment required" });
    return {
      content: [{ type: "text", text: "Error: 'fragment' is required and must be a string" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory: any[] = core.loadMemory();

  const notFound = ids.filter((id: string) => !(memory as any[]).find((f: any) => f.id === id));
  if (notFound.length > 0) {
    logger.warn("memory_merge fragments not_found", { missing: notFound });
    return {
      content: [{ type: "text", text: `Error: Fragment(s) not found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  const newFragment = core.createFragment(fragment, "ai" as const, title, project);
  logger.flow("memory_merge", "merged_fragment_created", { new_id: newFragment.id, title });

  const sourceFrags = ids.map((id: string) => memory.find((f: any) => f.id === id)).filter(Boolean) as any[];
  const inheritedRelations: any[] = [];
  const inheritedGuides: string[] = [];
  for (const src of sourceFrags) {
    if (src.relations) {
      for (const rel of src.relations) {
        if (!ids.includes(rel.id) && !inheritedRelations.find(r => r.id === rel.id && r.type === rel.type)) {
          inheritedRelations.push({ ...rel });
        }
      }
    }
    if (src.related_guides) {
      for (const g of src.related_guides) {
        if (!inheritedGuides.includes(g)) inheritedGuides.push(g);
      }
    }
    if (src.associatedWith) {
      for (const assocId of src.associatedWith) {
        if (!ids.includes(assocId) && !(newFragment.associatedWith || []).includes(assocId)) {
          if (!newFragment.associatedWith) newFragment.associatedWith = [];
          newFragment.associatedWith.push(assocId);
        }
      }
    }
  }
  newFragment.relations = inheritedRelations;
  newFragment.related_guides = inheritedGuides;

  const mergedMemory = memory.filter((f: any) => !ids.includes(f.id));

  for (const frag of mergedMemory) {
    if (frag.associatedWith) {
      frag.associatedWith = frag.associatedWith.map((aId: string) => ids.includes(aId) ? newFragment.id : aId);
      frag.associatedWith = [...new Set(frag.associatedWith)];
    }
    if (frag.relations) {
      for (const rel of frag.relations) {
        if (ids.includes(rel.id)) {
          rel.id = newFragment.id;
        }
      }
    }
  }

  const allGuides = guides.loadGuides();
  for (const g of allGuides) {
    if (g.source_memories) {
      g.source_memories = g.source_memories.map((mId: string) => ids.includes(mId) ? newFragment.id : mId);
      g.source_memories = [...new Set(g.source_memories)];
    }
    if (g.validated_by) {
      g.validated_by = g.validated_by.map((mId: string) => ids.includes(mId) ? newFragment.id : mId);
      g.validated_by = [...new Set(g.validated_by)];
    }
  }
  guides.saveGuides(allGuides);

  memory.push(newFragment);
  mergedMemory.push(newFragment);

  logger.data("memory.json", "save", { reason: "merge_fragments", new_id: newFragment.id, removed_ids: ids, before: memory.length, after: mergedMemory.length });
  core.saveMemory(mergedMemory);
  notifyMemoryChange();

  const scopeInfo = newFragment.project ? ` (project: ${newFragment.project})` : " (global)";
  let response = `Merged ${ids.length} fragments into [${newFragment.id}]${scopeInfo}: "${newFragment.title}"\nRemoved IDs: ${ids.join(", ")}`;

  if (inheritedRelations.length > 0 || inheritedGuides.length > 0) {
    response += `\n\nINHERITED CONNECTIONS:`;
    if (inheritedRelations.length > 0) {
      response += `\n- Relations: ${inheritedRelations.map(r => `[${r.id}] ${r.type}`).join(", ")}`;
    }
    if (inheritedGuides.length > 0) {
      response += `\n- Guides: ${inheritedGuides.join(", ")}`;
    }
  }

  logger.flow("memory_merge", "complete", { new_id: newFragment.id, merged_count: ids.length });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryRelate(args?: MemoryRelateArgs): Promise<ToolResult> {
  const sourceId = args?.sourceId;
  const targetId = args?.targetId;
  const type = args?.type;
  const note = args?.note;

  logger.flow("memory_relate", "start", { sourceId, targetId, type, has_note: !!note });

  if (!sourceId || !targetId || !type) {
    logger.warn("memory_relate validation failed", { reason: "missing required params" });
    return {
      content: [{ type: "text", text: "Error: 'sourceId', 'targetId', and 'type' parameters are required" }],
      isError: true,
    };
  }

  const validTypes = ["contradicts", "supersedes", "supports", "related_to"];
  if (!validTypes.includes(type)) {
    logger.warn("memory_relate validation failed", { reason: "invalid type", type });
    return {
      content: [{ type: "text", text: `Error: 'type' must be one of: ${validTypes.join(", ")}` }],
      isError: true,
    };
  }

  if (sourceId === targetId) {
    logger.warn("memory_relate validation failed", { reason: "sourceId equals targetId" });
    return {
      content: [{ type: "text", text: "Error: sourceId and targetId cannot be the same" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const memory = core.loadMemory();

  if (!memory.find((f: any) => f.id === sourceId)) {
    logger.warn("memory_relate source not_found", { sourceId });
    return {
      content: [{ type: "text", text: `Error: Source fragment [${sourceId}] not found` }],
      isError: true,
    };
  }

  if (!memory.find((f: any) => f.id === targetId)) {
    logger.warn("memory_relate target not_found", { targetId });
    return {
      content: [{ type: "text", text: `Error: Target fragment [${targetId}] not found` }],
      isError: true,
    };
  }

  const success = core.addRelation(memory, sourceId, targetId, type as any, note || undefined);
  if (!success) {
    logger.warn("memory_relate relation_exists", { sourceId, targetId, type });
    return {
      content: [{ type: "text", text: `Relation already exists between [${sourceId}] and [${targetId}] with type '${type}'` }],
      isError: true,
    };
  }

  logger.data("memory.json", "save", { reason: "add_relation", sourceId, targetId, type });
  core.saveMemory(memory);
  notifyMemoryChange();

  logger.flow("memory_relate", "complete", { sourceId, targetId, type });
  return {
    content: [{ type: "text", text: `Created relation: [${sourceId}] --${type}--> [${targetId}]${note ? ` (${note})` : ""}` }],
  };
}

export async function handleGuideGet(args?: GuideGetArgs): Promise<ToolResult> {
  const category = args?.category || null;
  const guideName = args?.guide || null;
  const task = args?.task || null;

  logger.flow("guide_get", "start", { category, guide: guideName, task });

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();

  if (task) {
    const result = guides.suggestGuides(task, allGuides);
    logger.flow("guide_get", "task_suggestions", { task, relevant: result.relevant.length, suggested: result.suggested.length });
    const formatted = guides.formatSuggestions(result);
    return {
      content: [{ type: "text", text: formatted }],
    };
  }

  if (guideName) {
    logger.flow("guide_get", "single_guide_lookup", { guide: guideName });
    const guide = guides.findGuide(allGuides, guideName);
    logger.flow("guide_get", "complete_single", { guide: guideName, found: !!guide });
    return {
      content: [{ type: "text", text: guides.formatGuideDetail(guide) }],
    };
  }

  const filtered = category
    ? guides.getGuidesByCategory(allGuides, category)
    : allGuides;

  logger.flow("guide_get", "complete_list", { category, total: allGuides.length, filtered: filtered.length });
  const formatted = guides.formatGuidesForLLM(filtered);
  return {
    content: [{ type: "text", text: formatted }],
  };
}

export async function handleGuidePractice(args?: GuidePracticeArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const category = args?.category;
  const description = args?.description || "";
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  logger.flow("guide_practice", "start", { guide: guideName, category, outcome: args?.outcome, context_count: contexts.length, learning_count: learnings.length });

  if (!guideName || !category) {
    logger.warn("guide_practice validation failed", { reason: "missing guide or category" });
    return {
      content: [{ type: "text", text: "Error: 'guide' and 'category' parameters are required" }],
      isError: true,
    };
  }

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const preUsageCount = guides.findGuide(allGuides, guideName)?.usage_count || 0;
  const updated = guides.practiceGuide(allGuides, guideName, category, description, contexts, learnings, args?.outcome);
  logger.flow("guide_practice", "guide_updated", { guide: guideName, usage_before: preUsageCount, usage_after: updated.usage_count });

  if (activeSessionId) {
    logger.data("sessions.json", "load");
    const allSessions = sessions.loadSessions();
    const session = sessions.findSession(allSessions, activeSessionId);
    if (session) {
      if (!session.guides_used) session.guides_used = [];
      if (!session.guides_used.includes(guideName.toLowerCase())) {
        session.guides_used.push(guideName.toLowerCase());
      }

      if (session.memories_read && session.memories_read.length > 0) {
        const normalizedName = guideName.toLowerCase().trim();
        if (!updated.validated_by) updated.validated_by = [];
        const memory: any[] = core.loadMemory();
        for (const memId of session.memories_read) {
          if (!updated.validated_by.includes(memId)) {
            updated.validated_by.push(memId);
          }
          const memFrag = memory.find((f: any) => f.id === memId);
          if (memFrag) {
            if (!memFrag.related_guides) memFrag.related_guides = [];
            if (!memFrag.related_guides.includes(normalizedName)) {
              memFrag.related_guides.push(normalizedName);
            }
          }
        }
        logger.data("memory.json", "save", { reason: "practice_validation_links", guide: guideName, memories_linked: session.memories_read.length });
        core.saveMemory(memory);
      }

      logger.data("sessions.json", "save", { reason: "track_guide_practice", session_id: activeSessionId, guide: guideName });
      sessions.saveSessions(allSessions);
    }
  }

  logger.data("guides.json", "save", { reason: "practice_guide", guide: guideName });
  guides.saveGuides(allGuides);

  const isNew = updated.usage_count === 1;
  const action = isNew ? "Created" : "Updated";
  let response = `${action} guide "${updated.guide}" (${updated.category}): ${updated.usage_count}x usage, ${updated.learnings.length} learnings, ${updated.contexts.length} contexts`;

  const pCtx = getSessionContext();
  const hookSuggestions: string[] = [];
  const totalAttempts = (updated.success_count || 0) + (updated.failure_count || 0);
  if (totalAttempts >= 3 && (updated.success_count || 0) / totalAttempts < 0.4) {
    hookSuggestions.push(`Guide "${updated.guide}" success rate is ${((updated.success_count || 0) / totalAttempts).toFixed(2)} (${updated.success_count}/${totalAttempts}). Consider guide_update to refine.`);
  }
  response += buildHookBlock(hookSuggestions);

  logger.flow("guide_practice", "complete", { guide: guideName, action, usage_count: updated.usage_count });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleGuideCreate(args?: GuideCreateArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const category = args?.category;
  const description = args?.description;
  const contexts = args?.contexts || [];
  const learnings = args?.learnings || [];

  logger.flow("guide_create", "start", { guide: guideName, category, has_description: !!description });

  if (!guideName || !category || !description) {
    logger.warn("guide_create validation failed", { reason: "missing guide, category, or description" });
    return {
      content: [{ type: "text", text: "Error: 'guide', 'category', and 'description' parameters are required" }],
      isError: true,
    };
  }

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const existing = guides.findSimilarGuide(allGuides, guideName);

  if (existing) {
    logger.flow("guide_create", "updating_existing", { guide: guideName, existing_id: existing.guide });
    existing.description = description;
    logger.data("guides.json", "save", { reason: "update_existing_guide", guide: guideName });
    guides.saveGuides(allGuides);
    return {
      content: [{ type: "text", text: `Updated manual for existing guide "${existing.guide}" (${existing.category})` }],
    };
  }

  const newGuide = guides.createGuide(guideName, category, description, contexts, learnings);
  allGuides.push(newGuide);
  logger.data("guides.json", "save", { reason: "create_new_guide", guide: guideName, total: allGuides.length });
  guides.saveGuides(allGuides);

  logger.flow("guide_create", "complete", { guide: guideName, category, is_new: true });
  return {
    content: [{ type: "text", text: `Created new guide "${newGuide.guide}" (${newGuide.category}) with a detailed manual.` }],
  };
}

export async function handleGuideDistill(args?: GuideDistillArgs): Promise<ToolResult> {
  const memoryId = args?.memory_id;
  const guideName = args?.guide;
  const category = args?.category || "dev-tool";

  logger.flow("guide_distill", "start", { memory_id: memoryId, guide: guideName, category });

  if (!memoryId || !guideName) {
    logger.warn("guide_distill validation failed", { reason: "missing memory_id or guide" });
    return {
      content: [{ type: "text", text: "Error: 'memory_id' and 'guide' parameters are required" }],
      isError: true,
    };
  }

  logger.data("memory.json", "load");
  const allMemory: any[] = core.loadMemory();
  const fragment = allMemory.find((m: any) => m.id === memoryId);

  if (!fragment) {
    logger.warn("guide_distill memory not_found", { memory_id: memoryId });
    return {
      content: [{ type: "text", text: `Error: Memory fragment with ID '${memoryId}' not found.` }],
      isError: true,
    };
  }

  logger.flow("guide_distill", "fragment_found", { memory_id: memoryId, title: fragment.title });

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const updated = guides.promoteToGuide(
    allGuides,
    guideName,
    category,
    fragment.fragment,
    fragment.project || "global"
  );

  if (!updated.source_memories) updated.source_memories = [];
  if (!updated.source_memories.includes(memoryId)) {
    updated.source_memories.push(memoryId);
  }
  if (!fragment.related_guides) fragment.related_guides = [];
  const normalizedName = guideName.toLowerCase().trim();
  if (!fragment.related_guides.includes(normalizedName)) {
    fragment.related_guides.push(normalizedName);
  }
  if (fragment.distill_candidate) {
    fragment.distill_candidate = false;
  }

  core.saveMemory(allMemory);
  logger.data("guides.json", "save", { reason: "distill_memory_to_guide", memory_id: memoryId, guide: guideName });
  guides.saveGuides(allGuides);

  let response = `Successfully distilled memory [${memoryId}] into guide "${updated.guide}" (${updated.category}).\n\n`;
  response += guides.formatGuideDetail(updated);

  logger.flow("guide_distill", "complete", { memory_id: memoryId, guide: guideName, category });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleGuideUpdate(args?: GuideUpdateArgs): Promise<ToolResult> {
  const guideName = args?.guide;
  const updates: Record<string, unknown> = {
    guide: args?.new_name,
    category: args?.category,
    description: args?.description,
    add_anti_patterns: args?.add_anti_patterns,
    add_pitfalls: args?.add_pitfalls,
    superseded_by: args?.superseded_by,
    deprecated: args?.deprecated,
  };

  const fieldsToUpdate = Object.entries(updates).filter(([, v]) => v !== undefined).map(([k]) => k);
  logger.flow("guide_update", "start", { guide: guideName, fields: fieldsToUpdate });

  if (!guideName) {
    logger.warn("guide_update validation failed", { reason: "missing guide name" });
    return {
      content: [{ type: "text", text: "Error: 'guide' parameter is required" }],
      isError: true,
    };
  }

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const updated = guides.updateGuide(allGuides, guideName, updates);

  if (!updated) {
    logger.warn("guide_update guide not_found", { guide: guideName });
    return {
      content: [{ type: "text", text: `Error: Guide "${guideName}" not found.` }],
      isError: true,
    };
  }

  logger.data("guides.json", "save", { reason: "update_guide", guide: guideName });
  guides.saveGuides(allGuides);

  logger.flow("guide_update", "complete", { guide: guideName, updated_fields: fieldsToUpdate });
  return {
    content: [{ type: "text", text: `Updated guide "${updated.guide}":\n${guides.formatGuideDetail(updated)}` }],
  };
}

export async function handleGuideForget(args?: GuideForgetArgs): Promise<ToolResult> {
  const guideName = args?.guide;

  logger.flow("guide_forget", "start", { guide: guideName });

  if (!guideName) {
    logger.warn("guide_forget validation failed", { reason: "missing guide name" });
    return {
      content: [{ type: "text", text: "Error: 'guide' parameter is required" }],
      isError: true,
    };
  }

  logger.data("guides.json", "load");
  const allGuides = guides.loadGuides();
  const success = guides.deleteGuide(allGuides, guideName);

  if (!success) {
    logger.warn("guide_forget guide not_found", { guide: guideName });
    return {
      content: [{ type: "text", text: `Error: Guide "${guideName}" not found.` }],
      isError: true,
    };
  }

  logger.data("guides.json", "save", { reason: "forget_guide", guide: guideName, remaining: allGuides.length });
  guides.saveGuides(allGuides, { force: true });

  logger.flow("guide_forget", "complete", { guide: guideName });
  return {
    content: [{ type: "text", text: `Successfully forgot guide: ${guideName}` }],
  };
}

export async function handleGuideMerge(args?: GuideMergeArgs): Promise<ToolResult> {
  const guideNames = args?.guides;
  const newGuideName = args?.guide;
  const category = args?.category;
  const description = args?.description || "";
  let contexts: string[] | undefined = args?.contexts;
  let learnings: string[] | undefined = args?.learnings;

  logger.flow("guide_merge", "start", { guides: guideNames, new_guide: newGuideName, category });

  if (!guideNames || !Array.isArray(guideNames) || guideNames.length < 2) {
    logger.warn("guide_merge validation failed", { reason: "guides must be array with at least 2 elements" });
    return {
      content: [{ type: "text", text: "Error: 'guides' must be an array with at least 2 guide names" }],
      isError: true,
    };
  }

  if (!newGuideName || !category) {
    logger.warn("guide_merge validation failed", { reason: "missing guide name or category" });
    return {
      content: [{ type: "text", text: "Error: 'guide' and 'category' parameters are required" }],
      isError: true,
    };
  }

  logger.data("guides.json", "load");
  const allGuides: any[] = guides.loadGuides();

  const sourceGuides: any[] = [];
  const notFound: string[] = [];
  for (const name of guideNames) {
    const g = guides.findGuide(allGuides, name);
    if (g) {
      sourceGuides.push(g);
    } else {
      notFound.push(name);
    }
  }

  if (notFound.length > 0) {
    logger.warn("guide_merge guides not_found", { missing: notFound });
    return {
      content: [{ type: "text", text: `Error: Guide(s) not found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  if (!contexts) {
    contexts = [...new Set(sourceGuides.flatMap((g: any) => g.contexts))];
  }
  if (!learnings) {
    learnings = [...new Set(sourceGuides.flatMap((g: any) => g.learnings))];
  }

  const antiPatterns = [...new Set(sourceGuides.flatMap((g: any) => g.anti_patterns || []))];
  const pitfalls = [...new Set(sourceGuides.flatMap((g: any) => g.known_pitfalls || []))];

  const totalUsage = sourceGuides.reduce((sum: number, g: any) => sum + g.usage_count, 0);
  logger.flow("guide_merge", "source_stats", { source_count: sourceGuides.length, total_usage: totalUsage });

  const newGuide = guides.createGuide(newGuideName, category, description, contexts, learnings);
  newGuide.usage_count = totalUsage;
  newGuide.anti_patterns = antiPatterns;
  newGuide.known_pitfalls = pitfalls;
  allGuides.push(newGuide);

  const mergedGuides = allGuides.filter((g: any) => !guideNames.map((n: string) => n.toLowerCase()).includes(g.guide));
  logger.data("guides.json", "save", { reason: "merge_guides", new_guide: newGuideName, removed: guideNames, total_usage: totalUsage });
  guides.saveGuides(mergedGuides);

  let response = `Merged ${guideNames.length} guides into "${newGuide.guide}" (${newGuide.category})\n`;
  response += `Total usage: ${totalUsage}x | Contexts: ${contexts.length} | Learnings: ${learnings.length}\n`;
  response += `Removed: ${guideNames.join(", ")}`;

  const mergeHookSuggestions: string[] = [];
  if (antiPatterns.length > 0) mergeHookSuggestions.push(`Anti-patterns inherited: ${antiPatterns.length}`);
  if (pitfalls.length > 0) mergeHookSuggestions.push(`Pitfalls inherited: ${pitfalls.length}`);
  const allSourceMemories = sourceGuides.flatMap((g: any) => g.source_memories || []).filter(Boolean);
  if (allSourceMemories.length > 0) mergeHookSuggestions.push(`Source memories linked: ${allSourceMemories.length} fragment(s)`);
  const allValidatedBy = sourceGuides.flatMap((g: any) => g.validated_by || []).filter(Boolean);
  if (allValidatedBy.length > 0) mergeHookSuggestions.push(`Validated by: ${allValidatedBy.length} fragment(s)`);
  response += buildHookBlock(mergeHookSuggestions);

  logger.flow("guide_merge", "complete", { new_guide: newGuideName, merged_count: guideNames.length, total_usage: totalUsage });
  return {
    content: [{ type: "text", text: response }],
  };
}

export async function handleMemoryStats(args?: MemoryStatsArgs): Promise<ToolResult> {
  const project = args?.project || null;

  logger.flow("memory_stats", "start", { project });

  logger.data("memory.json", "load");
  const memory = core.loadMemory();
  const stats = core.calculateStats(memory, project);

  logger.flow("memory_stats", "complete", { project, total: stats.total, avg_confidence: stats.avg_confidence?.toFixed(2) });
  return {
    content: [{ type: "text", text: core.formatStats(stats) }],
  };
}

export async function handleMemoryAudit(_args?: Record<string, unknown>): Promise<ToolResult> {
  logger.flow("memory_audit", "start");

  logger.data("memory.json", "load");
  const memory = core.loadMemory();
  const result = core.auditMemory(memory);

  logger.flow("memory_audit", "complete", { issues_count: result.issues?.length || 0 });
  return {
    content: [{ type: "text", text: core.formatAuditReport(result) }],
  };
}

export async function handleSessionStats(args?: SessionStatsArgs): Promise<ToolResult> {
  const count = args?.count || 10;

  logger.flow("session_stats", "start", { count });

  const recentSessions = virtualSession.getRecentSessions(count);
  const current = virtualSession.getCurrentVirtualSession();

  logger.debug("session_stats data", { requested: count, recent_count: recentSessions.length, has_current: !!current });

  let output = `## Session Stats\n`;

  if (current) {
    output += `Active session: ${current.tool_calls.length} tool calls\n`;
    if (current.technologies_seen.size > 0) {
      output += `Technologies: ${[...current.technologies_seen].join(", ")}\n`;
    }
    if (current.guides_used.size > 0) {
      output += `Guides used: ${[...current.guides_used].join(", ")}\n`;
    }
    output += `\n`;
  }

  if (recentSessions.length > 0) {
    output += `Recent sessions (${recentSessions.length}):\n`;
    for (const s of recentSessions.slice(0, 5)) {
      const techs = s.technologies?.length > 0 ? ` [${s.technologies.join(", ")}]` : "";
      output += `  ${s.id}: ${s.duration_tool_calls} calls${techs}\n`;
    }
  } else {
    output += `No past sessions recorded yet.\n`;
  }

  logger.flow("session_stats", "complete", { count, recent_count: recentSessions.length, has_current: !!current });
  return { content: [{ type: "text", text: output }] };
}

export async function handleCallTool(request: ToolCallRequest): Promise<ToolResult> {
  const { name, arguments: args } = request.params;

  logger.request(name, args as Record<string, unknown>);
  const startTime = Date.now();

  try {
    switch (name) {
      case "session_start": {
        const result = await handleSessionStart(args as SessionStartArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "session_end": {
        const result = await handleSessionEnd(args as SessionEndArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_read": {
        const result = await handleMemoryRead(args as MemoryReadArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_add": {
        const result = await handleMemoryAdd(args as MemoryAddArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_update": {
        const result = await handleMemoryUpdate(args as MemoryUpdateArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_forget": {
        const result = await handleMemoryForget(args as MemoryForgetArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_feedback": {
        const result = await handleMemoryFeedback(args as MemoryFeedbackArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_merge": {
        const result = await handleMemoryMerge(args as MemoryMergeArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_relate": {
        const result = await handleMemoryRelate(args as MemoryRelateArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_stats": {
        const result = await handleMemoryStats(args as MemoryStatsArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "memory_audit": {
        const result = await handleMemoryAudit(args);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_get": {
        const result = await handleGuideGet(args as GuideGetArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_practice": {
        const result = await handleGuidePractice(args as GuidePracticeArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_create": {
        const result = await handleGuideCreate(args as GuideCreateArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_distill": {
        const result = await handleGuideDistill(args as GuideDistillArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_update": {
        const result = await handleGuideUpdate(args as GuideUpdateArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_forget": {
        const result = await handleGuideForget(args as GuideForgetArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "guide_merge": {
        const result = await handleGuideMerge(args as GuideMergeArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      case "session_stats": {
        const result = await handleSessionStats(args as SessionStatsArgs);
        logger.response(name, !!result.isError, Date.now() - startTime);
        return result;
      }
      default: {
        logger.warn("handleCallTool unknown_tool", { tool: name });
        const result: ToolResult = {
          content: [{ type: "text", text: `Error: Unknown tool '${name}'` }],
          isError: true,
        };
        logger.response(name, true, Date.now() - startTime);
        return result;
      }
    }
  } catch (error) {
    const err = error as Error;
    logger.error("handleCallTool exception", { tool: name, error: err.message });
    logger.response(name, true, Date.now() - startTime, { error: err.message });
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
}
