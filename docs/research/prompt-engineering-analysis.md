# Prompt Engineering Analysis: Claude + OpenAI Best Practices

## Comprehensive extraction from 4 authoritative sources, synthesized for WALL's 12-subagent SEO analysis system.

---

# PART 1: SOURCE ANALYSIS

---

## Source 1: Claude System Prompt (Opus 4.7, April 16, 2026)

**URL:** `platform.claude.com/docs/en/release-notes/system-prompts.md`

### Key Observations from Claude's Own System Prompt

The actual production system prompt Claude uses on claude.ai reveals Anthropic's internal prompting philosophy through practice.

#### System Prompt Architecture (Hierarchy of Sections)

The system prompt is organized with explicit XML-like section boundaries:

```
<claude_behavior>
  <product_information>...</product_information>
  <refusal_handling>
    <critical_child_safety_instructions>...</critical_child_safety_instructions>
  </refusal_handling>
  <legal_and_financial_advice>...</legal_and_financial_advice>
  <tone_and_formatting>
    <lists_and_bullets>...</lists_and_bullets>
    <acting_vs_clarifying>...</acting_vs_clarifying>
  </tone_and_formatting>
  <user_wellbeing>...</user_wellbeing>
</claude_behavior>
```

**Key Insight:** Anthropic uses nested XML tags in their own system prompt. This validates their recommendation to use XML tags for structuring prompts.

#### Tone and Formatting Principles (Direct Quotes)

> "Claude avoids over-formatting responses with elements like bold emphasis, headers, lists, and bullet points. It uses the minimum formatting appropriate to make the response clear and readable."

> "Claude should generally only use lists, bullet points, and formatting in its response if (a) the person asks for it, or (b) the response is multifaceted and bullet points and lists are essential to clearly express the information."

> "Claude keeps its responses focused and concise so as to avoid potentially overwhelming the user with overly-long responses."

#### Acting vs Clarifying Pattern

> "When a request leaves minor details unspecified, the person typically wants Claude to make a reasonable attempt now, not to be interviewed first. Claude only asks upfront when the request is genuinely unanswerable without the missing information."

> "Once Claude starts on a task, Claude sees it through to a complete answer rather than stopping partway."

**Application to WALL:** Subagents should not ask for clarification; they should analyze whatever data they receive and produce complete findings.

#### Capability Check Pattern

> "Before concluding Claude lacks a capability — access to the person's location, memory, calendar, files, past conversations, or any external data — Claude calls tool_search to check whether a relevant tool is available but deferred."

**Application to WALL:** Subagents should analyze available data thoroughly before reporting "insufficient data."

#### Conciseness Guidance

> "If asked to explain something, Claude's initial response can be a high-level summary explanation rather than an extremely in-depth one unless such a thing is specifically requested."

---

## Source 2: Claude Prompting Best Practices (Opus 4.7)

**URL:** `platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices.md`

### Effort and Thinking Depth Calibration

The effort parameter is the primary lever for controlling intelligence vs. cost tradeoff:

| Level | Use Case | Tradeoff |
|-------|----------|----------|
| `max` | Intelligence-demanding tasks | Diminishing returns, prone to overthinking |
| `xhigh` | Coding and agentic use cases (recommended default) | Best balance for most complex work |
| `high` | Most intelligence-sensitive use cases (minimum recommended) | Balanced token usage + intelligence |
| `medium` | Cost-sensitive use cases | Trades off some intelligence |
| `low` | Short scoped tasks, latency-sensitive | Risk of under-thinking on complex tasks |

**Direct Quote:**
> "Meaningfully changing from Claude Opus 4.6, Claude Opus 4.7 respects effort levels strictly, especially at the low end. At `low` and `medium`, the model scopes its work to what was asked rather than going above and beyond."

> "If you observe shallow reasoning on complex problems, raise effort to `high` or `xhigh` rather than prompting around it."

**Application to WALL:** Each of the 12 subagents should run at `high` effort. Security and Technical subagents that require deeper analysis could benefit from `xhigh`.

### Verbosity Control

> "Claude Opus 4.7 calibrates response length to how complex it judges the task to be, rather than defaulting to a fixed verbosity."

For decreasing verbosity:
```text
Provide concise, focused responses. Skip non-essential context, and keep examples minimal.
```

**Key Insight:** "Positive examples showing how Claude can communicate with the appropriate level of concision tend to be more effective than negative examples or instructions that tell the model what not to do."

### Thinking Calibration

> "Thinking adds latency and should only be used when it will meaningfully improve answer quality — typically for problems that require multi-step reasoning. When in doubt, respond directly."

> "If you are running Claude Opus 4.7 at `max` or `xhigh` effort, set a large max output token budget so the model has room to think and act across its subagents and tool calls. We recommend starting at 64k tokens and tuning from there."

### Subagent Spawning Control

**Direct Quote:**
> "Claude Opus 4.7 tends to spawn fewer subagents by default. However, this behavior is steerable through prompting; give Claude Opus 4.7 explicit guidance around when subagents are desirable."

Example for controlling subagents:
```text
Do not spawn a subagent for work you can complete directly in a single response (e.g. refactoring a function you can already see).
Spawn multiple subagents in the same turn when fanning out across items or reading multiple files.
```

**Application to WALL:** WALL's orchestrator already fans out 12 subagents explicitly via `Promise.all`. This pattern is validated by Anthropic's own recommendation to "spawn multiple subagents in the same turn when fanning out across items."

### Literal Instruction Following

> "Claude Opus 4.7 interprets prompts more literally and explicitly than Claude Opus 4.6, particularly at lower effort levels. It will not silently generalize an instruction from one item to another."

> "If you need Claude to apply an instruction broadly, state the scope explicitly (for example, 'Apply this formatting to every section, not just the first one')."

**Application to WALL:** Each subagent prompt must be explicit about scope. Don't assume a general instruction in one subagent applies to all.

### Code Review Harness Pattern (Anti-Hallucination)

For maximizing finding coverage:
```text
Report every issue you find, including ones you are uncertain about or consider low-severity.
Do not filter for importance or confidence at this stage - a separate verification step will do that.
Your goal here is coverage: it is better to surface a finding that later gets filtered out
than to silently drop a real bug. For each finding, include your confidence level and an
estimated severity so a downstream filter can rank them.
```

**Application to WALL:** This is exactly the pattern WALL's subagents should use — report all findings with severity and confidence, let the orchestrator/scorer handle prioritization downstream. Prevents subagents from silently filtering out real issues.

### User-Facing Progress Updates

> "Claude Opus 4.7 provides more regular, higher-quality updates to the user throughout long agentic traces. If you've added scaffolding to force interim status messages ('After every 3 tool calls, summarize progress'), try removing it."

**Application to WALL:** The SSE progress system in WALL (`/api/jobs/[id]/progress`) aligns with this — let the pipeline report progress naturally rather than forcing artificial checkpoints.

---

## Source 3: Claude Prompt Engineering Overview

**URL:** `platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview.md`

### Three Prerequisites Before Prompt Engineering

1. A clear definition of the success criteria for your use case
2. Some ways to empirically test against those criteria
3. A first draft prompt you want to improve

**Application to WALL:** WALL already has success criteria defined in its scoring system (0-100 scores, severity levels, category breakdowns). The 209 existing tests serve as the empirical test suite.

### Redirect to Best Practices

The overview page is primarily a navigation hub that directs to:
- The Prompting Best Practices page (Source 2 above)
- An interactive GitHub tutorial
- A Google Sheets tutorial
- The Claude Console prompt generator

---

## Source 4: OpenAI Prompt Engineering Guide

**URL:** `developers.openai.com/api/docs/guides/prompt-engineering`

### Message Role Hierarchy (Chain of Command)

OpenAI defines a strict priority ordering:

| Role | Priority | Analogy |
|------|----------|---------|
| `developer` | Highest | Function definition (rules + business logic) |
| `user` | Second | Function arguments (inputs + configuration) |
| `assistant` | Lowest | Model-generated output |

**Key Insight:** 
> "You could think about `developer` and `user` messages like a function and its arguments in a programming language. `developer` messages provide the system's rules and business logic, like a function definition. `user` messages provide inputs and configuration to which the `developer` message instructions are applied, like arguments to a function."

**Application to WALL:** WALL's `buildSystemPrompt(category, businessType)` maps to `developer` role. `buildUserPrompt(filteredData, category)` maps to `user` role. This separation is correct per OpenAI's architecture.

### Model Selection Guidance

- **Reasoning models:** "Generate an internal chain of thought to analyze the input prompt, and excel at understanding complex tasks and multi-step planning. They are also generally slower and more expensive."
- **GPT models:** "Fast, cost-efficient, and highly intelligent, but benefit from more explicit instructions around how to accomplish tasks."

### Prompt Structure Template (Developer Message)

OpenAI recommends this section ordering for developer messages:

1. **Identity:** Purpose, communication style, high-level goals
2. **Instructions:** Rules, what to do, what never to do
3. **Examples:** Input/output pairs showing desired behavior
4. **Context:** Additional information, proprietary data, relevant context

**Application to WALL:** Each of WALL's 12 subagent prompts should follow this 4-section structure:
1. Identity → "You are a TECHNICAL SEO expert agent analyzing..."
2. Instructions → Scoring rules, output format, severity definitions
3. Examples → Sample findings with correct scores
4. Context → The filtered data for this category

### Message Formatting: Markdown + XML

> "Markdown headers and lists can be helpful to mark distinct sections of a prompt, and to communicate hierarchy to the model. XML tags can help delineate where one piece of content begins and ends."

> "XML attributes can also be used to define metadata about content in the prompt that can be referenced by your instructions."

**Key Insight:** Both Claude and OpenAI recommend XML tags for structuring. This is a universal best practice, not provider-specific.

### Production Recommendations

> "Pin your production applications to specific model snapshots to ensure consistent behavior"
> "Build evals that measure the behavior of your prompts so you can monitor prompt performance as you iterate"

---

## Supplementary Source A: Anthropic Structured Outputs

**URL:** `platform.claude.com/docs/en/build-with-claude/structured-outputs`

### JSON Schema Enforcement via Constrained Decoding

Anthropic provides structured outputs through `output_config.format`:

```json
{
  "output_config": {
    "format": {
      "type": "json_schema",
      "schema": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "score": {"type": "number"}
        },
        "required": ["name", "score"],
        "additionalProperties": false
      }
    }
  }
}
```

**Key Benefits:**
- Always valid: No more `JSON.parse()` errors
- Type safe: Guaranteed field types and required fields
- Reliable: No retries needed for schema violations

**Application to WALL:** Instead of prompting for JSON and parsing with `try/catch`, WALL should use structured outputs to guarantee `SubagentResult` format: `{ score: number, findings: Finding[], summary: string }`.

---

## Supplementary Source B: Anthropic Extended Thinking

**URL:** `platform.claude.com/docs/en/build-with-claude/extended-thinking.md`

### Adaptive Thinking (Opus 4.7+)

For Claude Opus 4.7, extended thinking is replaced by **adaptive thinking**:

```json
{
  "thinking": { "type": "adaptive" },
  "effort": "xhigh"
}
```

The `budget_tokens` parameter is deprecated. Instead, use the `effort` parameter to control thinking depth.

### Thinking Display Modes

- `"summarized"`: Returns a summary of thinking (default on Opus 4.6/Sonnet 4.6)
- `"omitted"`: Returns only the signature, faster time-to-first-token (default on Opus 4.7)

**Application to WALL:** Use `display: "omitted"` for production subagent calls (don't need to stream thinking to users). Use `display: "summarized"` during development/debugging.

---

## Supplementary Source C: XML Output Structuring (FreeAcademy + Oboe)

### Claude-Specific XML Tag Patterns

**Claude has been specifically fine-tuned to recognize and prioritize content within XML tags.** This is a core part of how the model processes information.

#### Pattern 1: Reasoning + Answer

```xml
<instructions>
Analyze the following customer review and determine the overall sentiment.

Respond using this exact structure:
<reasoning>
[Walk through the key signals in the review that indicate sentiment]
</reasoning>
<answer>positive | negative | mixed | neutral</answer>
<confidence>0.0 to 1.0</confidence>
</instructions>
```

#### Pattern 2: Result + Metadata

```xml
<result>[translated text]</result>
<notes>[any translation decisions worth flagging, or "none"]</notes>
<formality>formal | informal | neutral</formality>
```

#### Pattern 3: Multi-Field Extraction

```xml
<job>
<title>[job title]</title>
<company>[company name]</company>
<location>[city, state or "Remote"]</location>
<key_requirements>
<requirement>[requirement 1]</requirement>
<requirement>[requirement 2]</requirement>
</key_requirements>
</job>
```

### Key Output Structuring Techniques

1. **Show structure explicitly** — Don't describe it, model it with placeholder text
2. **Use "output only" instructions** — `Output ONLY the XML structure below. Do not include any text before or after the XML tags.`
3. **Specify missing data handling** — `If a field cannot be determined from the input, use "unknown" as the value. Do not omit tags.`
4. **Use XML comments to annotate schema** — `<!-- Include one <factor> tag per identified risk factor, minimum 1, maximum 5 -->`
5. **Name tags semantically** — Good: `<confidence>`, `<reasoning>` / Bad: `<string1>`, `<field3>`
6. **Be explicit about value constraints** — `<priority>1 | 2 | 3 | 4 | 5 (1 = critical, 5 = low)</priority>`

---

# PART 2: SYNTHESIS — Unified Framework for WALL's 12-Subagent System

---

## Unified Principle 1: Prompt Structure (Developer Message Template)

Both Claude and OpenAI converge on the same 4-section structure. For WALL's subagents:

```
[SYSTEM PROMPT / DEVELOPER MESSAGE]

<identity>
You are a {CATEGORY_NAME} SEO analysis expert. Your role is to analyze
website data related to {category_scope} and produce a structured assessment.
</identity>

<instructions>
## Scoring Rules
- Score from 0-100 based on the criteria below
- Severity levels: critical, high, medium, low
- {category_specific_rules}

## Output Format
Return JSON matching this exact schema:
{schema_definition}

## Coverage Directive
Report every issue you find, including ones you are uncertain about or
consider low-severity. Do not filter for importance — a downstream
scorer handles prioritization. Include your confidence level (0.0-1.0)
for each finding so the scorer can rank them.
</instructions>

<examples>
{1-2 example findings with correct scoring}
</examples>

[USER MESSAGE]

<data>
{filtered_data_for_this_category}
</data>
```

**Why this works:**
- OpenAI: Developer message = function definition, User message = arguments
- Claude: XML tags = semantic separation that model is fine-tuned on
- Both: Identity → Instructions → Examples → Context ordering

---

## Unified Principle 2: Anti-Hallucination Strategies

### Strategy A: Coverage-Over-Precision Pattern (from Claude code review guidance)

```text
Report every issue you find, including ones you are uncertain about or
consider low-severity. Do not filter for importance or confidence at this
stage — a separate verification step will do that. Your goal here is
coverage: it is better to surface a finding that later gets filtered out
than to silently drop a real issue. For each finding, include your
confidence level and an estimated severity so a downstream filter can
rank them.
```

### Strategy B: Grounding with Source Data (from XML structuring)

```xml
<data>
  {actual_crawled_data}
</data>

<instructions>
Base your analysis ONLY on the data provided within the <data> tags above.
If you cannot determine something from the data, mark confidence as 0.0
and note "insufficient data" in the finding description. Do not infer
or assume information not present in the data.
</instructions>
```

### Strategy C: Structured Output Enforcement

Use `output_config.format` with JSON schema (Claude) or structured outputs (OpenAI) to guarantee the response matches `SubagentResult`:

```typescript
{
  score: number,           // 0-100
  findings: [{
    title: string,
    description: string,
    severity: "critical" | "high" | "medium" | "low",
    confidence: number,    // 0.0-1.0
    evidence: string,      // Quote from data
    recommendation: string
  }],
  summary: string
}
```

### Strategy D: Confidence Scoring on Every Finding

Both sources recommend explicit confidence scores. Every WALL finding should include:
- `confidence: 0.0-1.0` — How certain the agent is
- `evidence: string` — The actual data point from the crawl that supports this finding
- `severity: enum` — Impact classification

---

## Unified Principle 3: Multi-Agent Coordination

### Fan-Out Pattern (Validated by Both Sources)

Claude's guidance:
> "Spawn multiple subagents in the same turn when fanning out across items or reading multiple files."

WALL already implements this correctly:
```typescript
const results = await Promise.all(
  categories.map(category => runSubagent(category, filteredData, onProgress))
);
```

### Scope Isolation

Claude's guidance:
> "Claude Opus 4.7 interprets prompts more literally and explicitly. It will not silently generalize an instruction from one item to another."

For WALL, this means each subagent prompt must be **self-contained** — it cannot rely on context from other subagents. Each prompt must include:
1. Its own identity definition
2. Its own scoring rubric
3. Its own output schema
4. Only the data relevant to its category

### Downstream Aggregation

The orchestrator aggregates results using a second pass:
1. **Subagent pass** (parallel): 12 agents produce `{score, findings[], summary}`
2. **Scorer pass** (sequential): `computeScores()` applies weighted formula
3. **Report pass** (sequential): `generateExecutiveSummary()` + `generateRecommendations()`

This 3-pass architecture separates finding-generation from prioritization from narrative, which aligns with Claude's code review pattern of separating coverage from filtering.

---

## Unified Principle 4: Role Definition Best Practices

### Identity Section Template

```xml
<identity>
You are an expert {CATEGORY_NAME} analyst for an SEO audit platform.
Your specialty is {category_scope_description}.

You analyze raw website data and produce:
1. A numerical score (0-100) reflecting {category_name} quality
2. A list of specific, evidence-based findings
3. A brief summary of the overall {category_name} state

Scoring scale:
  90-100: Excellent — No significant issues found
  70-89: Good — Minor improvements possible
  50-69: Average — Several issues need attention
  30-49: Poor — Major problems detected
  0-29: Critical — Fundamental failures
</identity>
```

### Per-Category Role Specificity

Each subagent should have a domain-expert persona, not a generic "SEO expert":

| Category | Role Definition |
|----------|----------------|
| TECHNICAL | "You are a technical SEO specialist focused on crawlability, indexability, and site architecture." |
| CONTENT | "You are a content quality analyst specializing in E-E-A-T assessment and content depth evaluation." |
| META | "You are a metadata specialist analyzing title tags, descriptions, and social sharing configurations." |
| SCHEMA | "You are a structured data expert evaluating JSON-LD markup and schema.org compliance." |
| IMAGES | "You are an image optimization specialist analyzing alt text, formats, and loading behavior." |
| PERFORMANCE | "You are a web performance engineer focused on Core Web Vitals and resource optimization." |
| SECURITY | "You are a web security auditor analyzing HTTP headers, TLS configuration, and CSP policies." |
| GEO | "You are an AI search visibility specialist evaluating crawler access and citability." |
| LINKS | "You are a link architecture analyst examining internal/external link patterns." |
| SITEMAP | "You are a sitemap compliance auditor validating XML structure and coverage." |
| LOCAL | "You are a local SEO specialist analyzing NAP consistency and business signals." |
| STRATEGY | "You are a competitive SEO strategist identifying keyword opportunities and market positioning." |

---

## Unified Principle 5: Output Format Enforcement

### Level 1: Structured Output API (Strongest)

Use provider-native structured outputs when available:

- **Claude:** `output_config.format` with `json_schema`
- **OpenAI:** `response_format` with `json_schema`

This provides constrained decoding — the model physically cannot produce invalid output.

### Level 2: XML Output Tags (Claude-Optimized)

When structured output APIs aren't available, use XML output tags:

```xml
<instructions>
Analyze the provided data and output ONLY valid JSON matching this schema:

{
  "score": <integer 0-100>,
  "findings": [<array of finding objects>],
  "summary": "<string>"
}

Do not include any text before or after the JSON.
</instructions>
```

### Level 3: Fallback Parsing

Always wrap parsing in defensive error handling:

```typescript
try {
  const result = JSON.parse(response);
  validateSubagentResult(result);
  return result;
} catch {
  return {
    score: 0,
    findings: [{ title: "Parse Error", description: response, severity: "critical", confidence: 1.0 }],
    summary: "Agent output could not be parsed"
  };
}
```

---

## Unified Principle 6: Chain-of-Thought and Reasoning

### When to Use Thinking

Claude's guidance:
> "Thinking adds latency and should only be used when it will meaningfully improve answer quality — typically for problems that require multi-step reasoning."

### WALL Subagent Reasoning Tiers

| Subagent | Reasoning Need | Recommended Effort |
|----------|---------------|-------------------|
| TECHNICAL | High — multi-step crawlability analysis | `high` |
| CONTENT | High — E-E-A-T scoring requires judgment | `xhigh` |
| META | Medium — mostly extraction + validation | `high` |
| SCHEMA | Medium — JSON-LD parsing + validation | `high` |
| IMAGES | Medium — alt text + optimization checks | `high` |
| PERFORMANCE | High — Core Web Vitals correlation | `xhigh` |
| SECURITY | High — header analysis + threat assessment | `xhigh` |
| GEO | Medium — crawler access + citability check | `high` |
| LINKS | Medium — link graph analysis | `high` |
| SITEMAP | Low — mostly XML validation | `high` |
| LOCAL | Medium — NAP consistency check | `high` |
| STRATEGY | High — competitive analysis requires synthesis | `xhigh` |

### Explicit Reasoning in Prompts

For subagents running at `high` or `xhigh`, add:

```text
This task involves multi-step reasoning. Think carefully through the data
before scoring. Consider how individual findings interact and compound
before assigning a final score.
```

---

## Unified Principle 7: Temperature and Sampling

### Current State (Claude Opus 4.7)

Claude Opus 4.7 has **removed sampling parameters** (temperature, top_p) from its API. The `effort` parameter is now the primary control for variability vs. determinism.

### For OpenAI-Compatible APIs

- Use `temperature: 0` or `temperature: 0.1` for deterministic structured output
- Use `temperature: 0.3-0.5` for the strategy subagent (which benefits from some creativity)
- Never use `temperature > 0.7` for analytical/audit tasks — introduces randomness in scoring

### WALL Recommendation

Since WALL uses ZAI API (`glm-5-turbo`), set:
- `temperature: 0` for all subagents except STRATEGY
- `temperature: 0.3` for STRATEGY subagent only
- Ensure the API supports `response_format: { type: "json_object" }` if available

---

## Unified Principle 8: Prompt Chaining for Complex Analysis

### Two-Phase Analysis Pattern

For complex categories (TECHNICAL, CONTENT, SECURITY, STRATEGY), consider a two-phase prompt chain:

**Phase 1: Extraction and Finding Generation**
```xml
<instructions>
Analyze the website data and identify ALL issues related to {category}.
For each issue, provide: title, description, severity, confidence, evidence.
Focus on coverage over precision.
</instructions>
```

**Phase 2: Scoring and Summary**
```xml
<instructions>
Based on the following findings from the {category} analysis:
<findings>{phase_1_findings}</findings>

Assign an overall score (0-100) and write a concise summary.
Consider the severity distribution and compounding effects.
</instructions>
```

This is simpler than it sounds — WALL already separates finding generation (subagents) from scoring (`computeScores()`). The key insight is that **generation and evaluation should be separate passes**.

---

# PART 3: ACTIONABLE RECOMMENDATIONS FOR WALL

---

## Recommendation 1: Restructure Subagent Prompts

Current state: `buildSystemPrompt(category, businessType)` generates system prompts.
Recommended structure for each subagent prompt:

```
<identity>
  [Category-specific expert persona]
  [Scoring scale definition]
</identity>

<instructions>
  [Category-specific scoring rubric]
  [Output JSON schema]
  [Coverage directive: report everything, let scorer filter]
  [Grounding rule: base analysis only on provided data]
  [Missing data rule: mark confidence 0.0, note "insufficient data"]
</instructions>

<examples>
  [1-2 example findings with correct score/severity]
</examples>
```

## Recommendation 2: Add Confidence Scores to Findings

Extend the `Finding` type to include:
```typescript
confidence: number;  // 0.0-1.0
evidence: string;    // Direct quote from crawl data
```

## Recommendation 3: Use Coverage-Over-Precision Directive

Add to every subagent prompt:
```
Report every issue you find, including uncertain ones. Do not silently
filter. Include confidence level for each finding.
```

## Recommendation 4: Explicit Scope per Subagent

Since Claude interprets prompts literally (won't generalize across categories), each subagent prompt must be fully self-contained with its own scoring rubric.

## Recommendation 5: Consider Structured Output API

If ZAI API supports `response_format` or similar, use it to guarantee JSON validity in subagent responses. This eliminates the need for fallback parsing.

## Recommendation 6: Temperature Settings

- `temperature: 0` for all 11 analytical subagents
- `temperature: 0.3` for STRATEGY subagent only

## Recommendation 7: Token Budget

Set `max_tokens: 4096` for simpler categories (META, SITEMAP, IMAGES)
Set `max_tokens: 8192` for complex categories (TECHNICAL, CONTENT, SECURITY, STRATEGY)

---

# APPENDIX: Quick Reference Cards

## A. Prompt Structure Checklist

- [ ] Identity section with domain-expert persona
- [ ] Instructions section with scoring rubric
- [ ] Output JSON schema explicitly defined
- [ ] Coverage directive included
- [ ] Grounding rule (data-only analysis)
- [ ] Missing data handling rule
- [ ] 1-2 example findings provided
- [ ] Semantic XML tags used throughout

## B. Anti-Hallucination Checklist

- [ ] "Base analysis ONLY on provided data" instruction
- [ ] Confidence score required on every finding
- [ ] Evidence field requiring direct data quotes
- [ ] "If uncertain, note uncertainty rather than guessing"
- [ ] Structured output enforcement (API or prompt-level)
- [ ] Defensive JSON parsing with fallback

## C. Multi-Agent Coordination Checklist

- [ ] Each subagent prompt is self-contained
- [ ] No cross-subagent dependencies in prompts
- [ ] Fan-out via Promise.all (already implemented)
- [ ] Separate generation pass from scoring pass
- [ ] Downstream aggregation handles deduplication
- [ ] Progress reporting per-subagent completion
