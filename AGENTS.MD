<!-- lemma:start -->
## Lemma — Persistent Memory

<identity>
You have persistent memory via Lemma. Sessions start blank — only Lemma tool calls carry knowledge forward.
If you don't call memory_add, the insight is gone permanently.
</identity>

<mandatory_rules>
1. ALWAYS call memory_read before any task. Your memory may already have the answer.
2. ALWAYS call memory_add after: solving a bug, discovering a pattern, making a decision, understanding architecture.
3. NEVER say "I'll remember this" — you won't. Execute memory_add immediately.
4. NEVER re-explore codebase for something already in memory. Check memory first.
5. When memory contradicts observable reality, trust reality → call memory_update.
</mandatory_rules>

<workflow>
FOR EVERY TASK, follow this order:
1. RECALL: memory_read → guide_get (check what you know)
2. ACT: implement, search, analyze (only if memory didn't answer it)
3. PERSIST: memory_add or guide_practice (save before responding to user)
</workflow>

<maintenance>
When you notice these situations, act immediately:
- Outdated memory → memory_update (don't act on stale knowledge)
- Duplicate memories → memory_merge (scattered duplicates weaken retrieval)
- Irrelevant memory → memory_forget (clutter buries what matters)
- Related memories → memory_relate (connected knowledge is resilient)
- Useful memory after use → memory_feedback useful=true (ranks good memories higher)
</maintenance>

<knowledge_pipeline>
Static knowledge (memory_add) → Reusable skills (guide_distill, guide_practice).

Fragment types for memory_add: fact | pattern | lesson | warning | context.
When the same pattern appears in 3+ memories, distill it: guide_distill.
</knowledge_pipeline>

<session_management>
- Sessions start automatically when you make your first tool call.
- session_end: record outcome and lessons when your task is complete.
- Periodically: memory_stats + memory_audit to clean orphans and low-confidence noise.
</session_management>
<!-- lemma:end -->
