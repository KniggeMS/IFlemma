# Self-Improvement Data Architecture for Lemma

> Derived from analysis of 10 research papers on LLM self-improvement, mapped to the existing memory.db (fragments) and skill.db (guides) architecture.

---

## 1. Self-Improvement Mechanisms by Paper

### Paper 1: HyperAgents (DGM-H)
- **Mechanism**: Self-referential agents where the improvement procedure itself is editable. Archive of agent variants with performance tracking.
- **Key Finding**: Persistent memory of synthesized insights (not just scores) enables compounding improvement. The system stores "best_performers_analysis", causal hypotheses, and forward-looking plans.
- **Lemma Mapping**: This is exactly our `guides` system — the description/manual IS the editable improvement procedure. What's missing: **performance tracking across sessions** and **variant archiving**.

### Paper 2: Survey on LLM Inference-Time Self-Improvement
- **Mechanism**: Three categories: (1) Independent — self-consistency voting from multiple samples; (2) Context-Aware — retrieval from datastore (kNN-LM, REST); (3) Model-Aided — external reward models/tools.
- **Key Finding**: Retrieval-based methods combine parametric knowledge with stored knowledge. Self-consistency is a zero-cost confidence signal.
- **Lemma Mapping**: Our memory system is already Context-Aware (retrieval). Missing: **self-consistency as confidence estimator** and **reward-model signals**.

### Paper 3: AgeMem (Agentic Memory)
- **Mechanism**: Six tool-based memory operations (ADD, UPDATE, DELETE, RETRIEVE, SUMMARY, FILTER) for both LTM and STM. Composite reward: task + context + memory quality.
- **Key Finding**: Memory quality is measurable (storage quality, maintenance, semantic relevance). RL-trained agents learn WHEN to store/update/forget.
- **Lemma Mapping**: We have ADD, UPDATE, DELETE, RETRIEVE. Missing: **SUMMARY** (compress context), **FILTER** (remove noise), and **memory quality scoring**.

### Paper 4: Intrinsic Self-Critique
- **Mechanism**: Iterative plan → critique → refine loop. Self-consistency voting on critiques. Accumulated failure history as in-context learning.
- **Key Finding**: Including domain definition (preconditions, constraints) in critique prompts is essential. Previous failures prevent repeating mistakes.
- **Lemma Mapping**: Our `guide_practice` with learnings captures failures. Missing: **structured failure/success traces** per task type.

### Paper 5: EVOLVE
- **Mechanism**: Iterative preference training using self-refinement chains. SFT activates refinement capability, preference training strengthens it.
- **Key Finding**: LLMs do NOT inherently self-refine — the capability must be activated. Chain of Self-Refinement (iterative improvement on previous output) outperforms parallel sampling. The gain from self-refinement increases across training iterations.
- **Lemma Mapping**: Guides activate procedural knowledge. Missing: **tracking improvement trajectories** (before/after quality scores per session).

### Paper 6: Generative Self-Refinement (GSR)
- **Mechanism**: Generate N parallel candidates, then synthesize a superior answer by analyzing all candidates — even when all are wrong.
- **Key Finding**: Self-refinement is a learnable skill (hybrid training: direct-solving + refinement). The skill transfers across model scales and domains. Even wrong candidates contain usable intermediate insights.
- **Lemma Mapping**: Memory fragments capture intermediate insights. Missing: **candidate generation + synthesis pattern** and **cross-domain transfer tracking**.

### Paper 7: Self-Distillation Fine-Tuning (SDFT)
- **Mechanism**: On-policy distillation from a demonstration-conditioned teacher. The same model conditioned on examples serves as its own teacher.
- **Key Finding**: On-policy learning prevents catastrophic forgetting. Off-policy (standard SFT) causes severe forgetting of prior capabilities.
- **Lemma Mapping**: Our system is inherently on-policy — the AI reads its own memory and decides. Missing: **demonstration-conditioned retrieval** (retrieve examples before acting) and **forgetting detection**.

### Paper 8/9: Self-Refine
- **Mechanism**: Generate → Feedback → Refine loop. Same LLM as generator, critic, and refiner. Multi-aspect feedback.
- **Key Finding**: Specific, actionable feedback >> generic feedback >> no feedback. Most failures come from inaccurate feedback, not faulty refinement. Feedback quality is the bottleneck.
- **Lemma Mapping**: Guides provide the "feedback prompts" (protocols, checklists). Missing: **structured feedback storage** and **feedback quality tracking**.

### Paper 10: SSR (Socratic Self-Refine)
- **Mechanism**: Decompose reasoning into (sub-question, sub-answer) pairs. Estimate confidence per step by re-solving M times. Refine the weakest step.
- **Key Finding**: Step-level confidence >> holistic confidence. Plan refinement before step refinement gives best results. 5-7 Socratic steps is optimal.
- **Lemma Mapping**: We could decompose coding tasks into sub-steps and track confidence per step. Missing: **step decomposition**, **step-level confidence**, and **targeted refinement**.

---

## 2. Schema Changes

### 2.1 New Fields for Memory Fragments (memory.db)

```
memory_fragment {
  ...existing fields...
  
  -- NEW: Quality & Provenance
  quality_score:        float (0-1)     -- How useful was this fragment? Updated by feedback.
  refinement_count:     int             -- How many times this fragment was refined/updated.
  parent_id:            string|null     -- ID of the fragment this was refined FROM (lineage).
  child_ids:            string[]        -- IDs of fragments refined FROM this one.
  
  -- NEW: Session Context
  session_id:           string|null     -- Which session created this.
  task_type:            string|null     -- "debugging", "refactoring", "implementation", etc.
  outcome:              string|null     -- "success", "partial", "failure", "abandoned"
  
  -- NEW: Usage Analytics
  positive_feedback:    int             -- Count of times fragment was marked useful.
  negative_feedback:    int             -- Count of times fragment was not useful.
  last_refined:         datetime|null   -- When was the content last refined.
}
```

### 2.2 New Fields for Guides (skill.db)

```
guide {
  ...existing fields...
  
  -- NEW: Performance Tracking
  success_count:        int             -- How many times using this guide led to success.
  failure_count:        int             -- How many times using this guide didn't help.
  success_rate:         float (0-1)     -- success_count / (success_count + failure_count)
  avg_session_impact:   float (-1 to 1) -- Did sessions using this guide go better?
  
  -- NEW: Improvement Trajectory
  improvement_log:      object[]        -- [{date, metric, value}] for tracking evolution.
  last_refined:         datetime|null   -- When description was last refined.
  refinement_source:    string|null     -- "ai", "user", "distillation"
  
  -- NEW: Dependencies & Relations
  depends_on:           string[]        -- Guide names this guide depends on.
  enables:              string[]        -- Guide names this guide enables.
  superseded_by:        string|null     -- If a better version was created.
  
  -- NEW: Self-Refinement Metadata
  feedback_patterns:    string[]        -- Common feedback themes when using this guide.
  known_pitfalls:       string[]        -- Things that commonly go wrong.
  anti_patterns:        string[]        -- What NOT to do (learned from failures).
}
```

### 2.3 New Collection: Session Traces

```
session_trace {
  id:                   string          -- Unique trace ID.
  session_id:           string          -- Session identifier.
  timestamp:            datetime        -- When this trace was recorded.
  task_type:            string          -- "debugging", "implementation", etc.
  technology:           string          -- "react", "python", etc.
  
  -- What happened
  guides_used:          string[]        -- Guide names consulted.
  memories_read:        string[]        -- Fragment IDs read.
  memories_created:     string[]        -- Fragment IDs created.
  
  -- Quality signals
  task_outcome:         string|null     -- "success", "partial", "failure", null
  refinement_attempts:  int             -- How many times the AI refined its approach.
  self_critique_count:  int             -- How many self-corrections were made.
  
  -- Before/After (for measuring improvement)
  initial_approach:     string|null     -- First approach description.
  final_approach:       string|null     -- Final approach description.
  approach_changed:     boolean         -- Did the AI change strategy mid-task?
}
```

### 2.4 New Collection: Improvement Suggestions

```
improvement_suggestion {
  id:                   string
  created:              datetime
  source:               string          -- "pattern-analysis", "failure-analysis", "success-analysis"
  
  -- What the suggestion is about
  target_type:          string          -- "guide", "memory", "approach"
  target_id:            string          -- Guide name or fragment ID
  suggestion_type:      string          -- "refine", "create", "merge", "archive", "update"
  
  -- The suggestion content
  title:                string          -- Short title.
  reasoning:            string          -- WHY this suggestion was generated.
  evidence:             string[]        -- Data supporting this suggestion.
  confidence:           float (0-1)     -- How confident is the suggestion.
  
  -- State
  status:               string          -- "pending", "accepted", "dismissed"
  dismissed_reason:     string|null     -- Why it was dismissed (for learning).
}
```

---

## 3. New Tools

### 3.1 `session_start` — Begin a Traced Session
Records session metadata and loads relevant context.

```
Input:
  task_type: string       -- "debugging", "implementation", etc.
  technologies: string[]  -- ["react", "typescript"]
  
Effect:
  - Creates a session_trace record.
  - Loads relevant guides via suggestGuides().
  - Returns: suggested guides, relevant memories, session_id.
```

**Why**: Papers 3 (AgeMem), 5 (EVOLVE), and 7 (SDFT) all emphasize that improvement requires tracking sessions as coherent units, not isolated tool calls.

### 3.2 `session_end` — Close a Traced Session
Records outcome and triggers improvement analysis.

```
Input:
  session_id: string
  outcome: "success" | "partial" | "failure" | "abandoned"
  final_approach: string    -- What approach actually worked (or didn't)
  lessons: string[]         -- What was learned
  
Effect:
  - Updates session_trace with outcome.
  - Updates guide success/failure counts.
  - Generates improvement_suggestions if patterns detected.
  - Returns: suggestions (if any).
```

### 3.3 `memory_summarize` — Compress & Consolidate
Directly from AgeMem (Paper 3). Summarizes a set of fragments into a distilled one.

```
Input:
  fragment_ids: string[]   -- Fragments to summarize
  project: string|null
  title: string
  
Effect:
  - Creates a new fragment with synthesized content.
  - Links children to new parent via parent_id/child_ids.
  - Optionally archives (reduces confidence of) source fragments.
```

### 3.4 `self_critique` — Step-Level Confidence Estimation
Inspired by SSR (Paper 10). Decomposes current approach into steps and estimates confidence.

```
Input:
  context: string          -- What you're working on
  approach: string         -- Your current plan/approach
  
Effect:
  - Returns structured feedback:
    - Decomposed steps with confidence estimates (low/medium/high)
    - Identification of weakest step
    - Suggested refinement for the weakest step
  - Does NOT store anything — purely advisory.
```

### 3.5 `improvement_suggest` — Analyze Patterns and Generate Suggestions
Inspired by HyperAgents (Paper 1) persistent memory analysis.

```
Input:
  technology: string|null  -- Focus area (e.g., "react")
  lookback: int            -- How many sessions to analyze (default: 10)
  
Effect:
  - Analyzes session traces for patterns:
    - Guides with low success rates → suggest refinement
    - Frequent failures without guide → suggest guide creation
    - Overlapping memories → suggest merge
    - Stale memories → suggest archival
  - Returns: improvement_suggestion records.
```

### 3.6 `guide_refine` — Refine a Guide's Description/Learnings
Inspired by EVOLVE (Paper 5). Uses accumulated session data to improve a guide.

```
Input:
  guide: string            -- Guide name to refine
  based_on: "sessions" | "failures" | "learnings"
  
Effect:
  - Analyzes recent sessions that used this guide.
  - Extracts patterns from failures and successes.
  - Suggests specific additions to description/learnings/anti_patterns.
  - AI decides whether to accept.
```

---

## 4. How Suggestions (Not Rules) Are Presented

The system **never enforces** — it **offers**. Every suggestion is presented as an option the AI can accept, modify, or dismiss.

### 4.1 Suggestion Format

```
╔══════════════════════════════════════╗
║         IMPROVEMENT SUGGESTIONS       ║
╠══════════════════════════════════════╣
║                                       ║
║  [s1] REFINE guide: "react"          ║
║  Confidence: ██████░░░░ 0.72         ║
║  Reason: Success rate dropped from    ║
║  0.8 to 0.5 over last 5 sessions.    ║
║  Recent failures involve hooks.       ║
║  → Add anti-pattern for stale closures║
║                                       ║
║  [s2] CREATE guide: "nextjs-app"     ║
║  Confidence: ████░░░░░░ 0.45         ║
║  Reason: 8 sessions used react guide  ║
║  but needed Next.js-specific patterns.║
║  → Bootstrap from react guide +       ║
║    nextjs contexts                    ║
║                                       ║
║  [s3] MERGE fragments: [m3a2, m7f1]  ║
║  Confidence: ████████░░ 0.85         ║
║  Reason: Both cover CSS module setup. ║
║  → Combined version would be complete ║
║                                       ║
╚══════════════════════════════════════╝

Actions: accept [id], dismiss [id], dismiss-all
```

### 4.2 When Suggestions Appear

| Trigger | When | What |
|---------|------|------|
| `session_end` | Task completed | "Based on this session, consider..." |
| `guide_practice` | Guide used | "This guide's success rate is declining..." |
| `memory_read` | Fragment accessed | "Similar fragments exist: [ids]. Merge?" |
| Low confidence | Fragment below 0.3 | "Fragment [id] has low confidence. Refine or archive?" |
| `improvement_suggest` | Explicitly called | Full pattern analysis |

### 4.3 Learning from Dismissal

When the AI dismisses a suggestion, `dismissed_reason` is recorded. Over time, the system learns:
- AI dismisses "merge" suggestions → stop offering merges for that guide type
- AI accepts "refine" suggestions → increase confidence of refine suggestions
- AI always dismisses low-confidence suggestions → raise the threshold

---

## 5. Concrete Example: "How does the system get better at React after 10 sessions?"

### Session 1: First React Task
```
User: "Create a React component with useState"
```
1. `session_start("implementation", ["react"])` → suggests `react` guide (tracked, 3 learnings)
2. AI reads `react` guide, follows its protocols
3. Completes task. `session_end("success", "useState hook with proper typing", [])`
4. `guide_practice("react", "web-frontend", ["hooks", "state"], ["always type state variables"])`
5. **System state**: react guide usage_count=4, success_count += 1

### Session 2-3: More React, Some Issues
```
User: "Fix the useEffect cleanup in my component"
```
1. AI reads `react` guide, finds learning about "useEffect cleanup patterns"
2. Struggles a bit. Uses `self_critique` to check approach:
   - Step 1: "Identify the effect" → confidence: HIGH
   - Step 2: "Determine cleanup needs" → confidence: MEDIUM
   - Step 3: "Write cleanup function" → confidence: LOW ← weakest
   - Suggestion: "Check if effect depends on external subscriptions"
3. AI adjusts approach, succeeds.
4. `session_end("success", "cleanup pattern for subscriptions", ["useEffect cleanup needs dependency analysis"])`
5. `guide_practice("react", "web-frontend", ["hooks", "useEffect", "cleanup"], ["subscription cleanup needs early return pattern"])`
6. **System state**: react guide now has 2 new learnings about useEffect

### Session 4-5: React + TypeScript Intersection
```
User: "Type a React component with generic props"
```
1. `session_start("implementation", ["react", "typescript"])` → suggests both guides
2. AI reads both, but the `react` guide doesn't cover generic props
3. AI solves it by searching memory, finds a fragment about TypeScript generics
4. `memory_add("React components with generic props use <T extends...>", project="myapp")`
5. `session_end("success", "generic component with T extends Props", [])`

### Session 6: A Failure
```
User: "Optimize React re-renders with useMemo"
```
1. AI follows `react` guide, but guide's advice on memoization is outdated
2. AI over-optimizes, causing stale closures
3. `session_end("failure", "over-memoization caused stale closures", ["useMemo should only wrap expensive computations, not all values"])`
4. **System state**: react guide success_count stays, failure_count += 1
5. **Improvement suggestion generated**: 
   - "[s1] REFINE guide 'react' — failure pattern detected around useMemo"
   - Confidence: 0.78
   - Evidence: "Session #6: over-memoization. Session #3: related useEffect issue"
   - Suggestion: "Add anti-pattern: don't memoize primitive values"

### Session 7-8: AI Accepts Suggestion
1. AI sees suggestion [s1], accepts
2. `guide_refine("react", based_on="failures")` → adds to anti_patterns:
   - "Don't wrap primitive values in useMemo"
   - "Don't memoize values used only in the same render cycle"
3. `memory_distill(memory_id_of_failure_trace, "react")` → adds learning:
   - "Stale closures occur when memoized values capture outdated state"
4. **System state**: react guide refined with 2 new anti_patterns and 1 new learning

### Session 9: Pattern Detection
```
User: "Set up React with Next.js App Router"
```
1. `improvement_suggest("react", lookback=8)` detects:
   - 3 of 8 sessions involved Next.js-specific patterns
   - react guide's description doesn't cover App Router
   - **Suggestion**: "[s2] CREATE guide 'nextjs' from react guide + Next.js patterns"
2. AI accepts, bootstraps `nextjs` guide from `react` guide
3. Sets `depends_on: ["react"]` on the new guide

### Session 10: The Improvement Is Visible
```
User: "Create a React form with validation"
```
1. `session_start("implementation", ["react"])` → suggests `react` guide
2. AI reads `react` guide — now contains:
   - 12 learnings (up from 3)
   - 3 anti_patterns (from failures)
   - Success rate: 0.78 (from tracked sessions)
   - Known pitfalls: ["over-memoization", "stale closures in effects", "untyped state"]
3. AI solves the task faster and more accurately
4. `session_end("success", ...)` records another positive data point
5. **The system is objectively better at React than it was in Session 1**

### Quantified Improvement After 10 Sessions

| Metric | Session 1 | Session 10 |
|--------|-----------|------------|
| React guide learnings | 3 | 12 |
| Anti-patterns known | 0 | 3 |
| Known pitfalls | 0 | 3 |
| Success rate | N/A | 0.78 |
| Session traces | 0 | 10 |
| Related guides | 0 | 1 (nextjs) |
| Memory fragments about React | 2 | 8 |
| Improvement suggestions generated | 0 | 3 (2 accepted, 1 dismissed) |

---

## 6. Implementation Priority

### Phase 1: Tracking (Low effort, high value)
- Add `quality_score`, `refinement_count`, `parent_id`, `child_ids` to memory fragments
- Add `success_count`, `failure_count`, `anti_patterns`, `known_pitfalls` to guides
- Implement `session_start` / `session_end` tools
- These require no new collections — just extended schemas.

### Phase 2: Feedback Loops (Medium effort)
- Implement `memory_summarize` tool
- Implement `self_critique` tool
- Add `improvement_suggestion` generation on `session_end`
- These close the loop between usage and improvement.

### Phase 3: Pattern Analysis (Higher effort)
- Implement `improvement_suggest` tool
- Implement `guide_refine` tool
- Add `session_trace` collection for cross-session pattern detection
- These enable compounding improvement across many sessions.

---

## 7. Key Design Principles (From Papers)

1. **On-policy over off-policy** (Paper 7: SDFT): The AI should learn from its own actions, not from static rules. Our suggestions come from observing the AI's actual behavior.

2. **Specific feedback over generic** (Paper 8: Self-Refine): Improvement suggestions must cite specific evidence ("Session #4 failed because..."), not vague patterns.

3. **Step-level over holistic** (Paper 10: SSR): Track confidence at the sub-task level, not just "did the session succeed?"

4. **Refinement chains over replacement** (Paper 5: EVOLVE): Keep lineage (parent_id/child_ids). Don't delete old knowledge — refine it.

5. **Tool-based memory operations** (Paper 3: AgeMem): Memory management should be explicit tool calls the AI decides to make, not automatic heuristics.

6. **Compounding requires archiving** (Paper 1: HyperAgents): The system needs a growing archive of intermediate solutions, not just the current best.

7. **Self-consistency as confidence** (Papers 2, 4, 10): If the AI re-solves a problem multiple times and gets different answers, confidence is low. This is a free signal.

8. **Learning from failure is essential** (Paper 4: Self-Critique): Failed approaches stored in memory prevent repeating mistakes. The `known_pitfalls` and `anti_patterns` fields capture this.
