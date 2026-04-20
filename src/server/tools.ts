interface ToolProperty {
  type: string;
  description?: string;
  items?: { type: string };
  enum?: string[];
  default?: unknown;
}

interface ToolInputSchema {
  type: string;
  properties: Record<string, ToolProperty>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export const TOOLS: ToolDefinition[] = [
  {
    name: "session_start",
    description: "Start a traced work session. Records task metadata and returns relevant guides and pre-loaded memories for the task.",
    inputSchema: {
      type: "object",
      properties: {
        task_type: {
          type: "string",
          description: "Type of task: 'debugging', 'implementation', 'refactoring', 'testing', 'research', 'documentation', 'optimization', or 'other'",
        },
        technologies: {
          type: "array",
          items: { type: "string" },
          description: "Technologies involved (e.g., ['react', 'typescript']). Optional.",
        },
        initial_approach: {
          type: "string",
          description: "Your initial plan or approach for this task. Optional.",
        },
      },
      required: ["task_type"],
    },
  },
  {
    name: "session_end",
    description: "End the current traced session. Records outcome, updates guide success/failure tracking, and generates improvement suggestions if patterns are detected.",
    inputSchema: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: ["success", "partial", "failure", "abandoned"],
          description: "How the task turned out",
        },
        final_approach: {
          type: "string",
          description: "What approach actually worked (or didn't). Optional.",
        },
        lessons: {
          type: "array",
          items: { type: "string" },
          description: "What was learned during this session. Optional.",
        },
      },
      required: ["outcome"],
    },
  },
  {
    name: "memory_read",
    description: "Read memory fragments. SUMMARY MODE: Shows title + description only (not full content). Use id parameter to get full detail of a specific fragment. Use all=true to see fragments from all projects.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name to filter (optional, defaults to detected project)",
        },
        query: {
          type: "string",
          description: "Optional semantic search keyword. Supply only if you are looking for specific context.",
        },
        id: {
          type: "string",
          description: "Get FULL DETAIL for a specific fragment ID. Use this after seeing the summary to read the complete content.",
        },
        context: {
          type: "string",
          description: "Optional context tag for this access (e.g., 'debugging', 'refactoring'). Boosts confidence and tags the fragment for future recall.",
        },
        all: {
          type: "boolean",
          description: "If true, show fragments from all projects. Default: false (current project + global only)",
        },
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Get full details for multiple fragment IDs at once. Optional.",
        },
        minConfidence: {
          type: "number",
          description: "Minimum confidence threshold (0-1). Only return fragments with confidence >= this value. Optional.",
        },
        afterDate: {
          type: "string",
          description: "ISO date string (e.g., '2026-04-01'). Only return fragments created on or after this date. Optional.",
        },
        beforeDate: {
          type: "string",
          description: "ISO date string (e.g., '2026-04-30'). Only return fragments created on or before this date. Optional.",
        },
      },
    },
  },
  {
    name: "memory_add",
    description: "MANDATORY: Call this AFTER completing analysis/research to save findings. Synthesize information into short, reusable fragments.",
    inputSchema: {
      type: "object",
      properties: {
        fragment: {
          type: "string",
          description: "The memory fragment text to store",
        },
        title: {
          type: "string",
          description: "Short title for the memory (auto-generated if not provided)",
        },
        description: {
          type: "string",
          description: "Short description/summary (auto-generated if not provided)",
        },
        project: {
          type: "string",
          description: "Project scope (null = global, string = project-specific). Use current project name for project-specific info.",
          default: null,
        },
        source: {
          type: "string",
          description: "Source of the memory (default: 'ai')",
          default: "ai",
        },
        confirm: {
          type: "boolean",
          description: "Set to true to store fragment as-is even if secrets are detected. Default: false (auto-redacts).",
          default: false,
        },
      },
      required: ["fragment"],
    },
  },
  {
    name: "memory_update",
    description: "Update an existing memory fragment by ID. Can update title, fragment text, confidence, or all.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the fragment to update",
        },
        title: {
          type: "string",
          description: "New title text (optional)",
        },
        fragment: {
          type: "string",
          description: "New fragment text (optional)",
        },
        confidence: {
          type: "number",
          description: "New confidence value 0-1 (optional)",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_forget",
    description: "Remove a memory fragment by ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the fragment to remove",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "memory_feedback",
    description: "Provide feedback on a memory fragment after use. positive = the memory was useful (boosts confidence), negative = it was not helpful (reduces confidence by -0.1).",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the fragment to give feedback on",
        },
        useful: {
          type: "boolean",
          description: "true if the memory was helpful, false if it was not relevant or incorrect",
        },
      },
      required: ["id", "useful"],
    },
  },
  {
    name: "memory_merge",
    description: "Merge multiple memory fragments into one. You decide the merged content, this tool just executes the merge. Use when you find related/overlapping fragments that should be consolidated.",
    inputSchema: {
      type: "object",
      properties: {
        ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of fragment IDs to merge (will be deleted after merge)",
        },
        title: {
          type: "string",
          description: "Title for the merged fragment",
        },
        fragment: {
          type: "string",
          description: "The merged content you prepared",
        },
        project: {
          type: "string",
          description: "Project scope (null = global, string = project-specific). Optional.",
          default: null,
        },
      },
      required: ["ids", "title", "fragment"],
    },
  },
  {
    name: "memory_relate",
    description: "Create a typed relation between two memory fragments. Types: 'contradicts' (opposing claims), 'supersedes' (replaces), 'supports' (reinforces), 'related_to' (general connection).",
    inputSchema: {
      type: "object",
      properties: {
        sourceId: {
          type: "string",
          description: "ID of the source fragment",
        },
        targetId: {
          type: "string",
          description: "ID of the target fragment",
        },
        type: {
          type: "string",
          enum: ["contradicts", "supersedes", "supports", "related_to"],
          description: "Type of relation",
        },
        note: {
          type: "string",
          description: "Optional note explaining the relation",
        },
      },
      required: ["sourceId", "targetId", "type"],
    },
  },
  {
    name: "memory_stats",
    description: "Get memory store statistics: fragment counts, average confidence, project breakdown, and health metrics.",
    inputSchema: {
      type: "object",
      properties: {
        project: {
          type: "string",
          description: "Project name to filter stats (optional, defaults to all projects)",
        },
      },
    },
  },
  {
    name: "memory_audit",
    description: "Audit memory store for integrity issues: orphan references, duplicate IDs, confidence anomalies.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "guide_get",
    description: "Get guides with usage statistics. Returns guides sorted by usage count (most used first). Use task parameter to get suggestions based on a task description.",
    inputSchema: {
      type: "object",
      properties: {
        category: {
          type: "string",
          description: "Filter by category (web-frontend, web-backend, dev-tool, etc.). Optional.",
        },
        guide: {
          type: "string",
          description: "Get detail for a specific guide name. Optional.",
        },
        task: {
          type: "string",
          description: "Task description to get relevant guide suggestions (e.g., 'react component with hooks', 'nodejs api'). Optional.",
        },
      },
    },
  },
  {
    name: "guide_practice",
    description: "MANDATORY: Record guide usage - increments usage count, updates last_used date, and adds contexts/learnings. Call this when you use a guide during work. Both contexts and learnings are REQUIRED.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Guide name (e.g., 'react', 'python', 'git')",
        },
        category: {
          type: "string",
          description: "Category: web-frontend, web-backend, dev-tool, programming-language, data-storage, etc.",
        },
        description: {
          type: "string",
          description: "Detailed description, manual, or protocols for the guide. Optional.",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: Contexts where this guide was used (e.g., ['hooks', 'state']). Provide at least one context or empty array [].",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "REQUIRED: New learnings discovered during use (e.g., ['useCallback prevents re-renders']). Provide at least one learning or empty array [].",
        },
        outcome: {
          type: "string",
          enum: ["success", "failure"],
          description: "Optional outcome when using this guide. Tracks success rate.",
        },
      },
      required: ["guide", "category", "contexts", "learnings"],
    },
  },
  {
    name: "guide_create",
    description: "Definition mode: Create a new guide with a detailed manual, mission, and protocols. Use this to establish a reusable framework for a specific technology or methodology.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Guide name (e.g., 'X Viral Growth Engine', 'TDD Workflow')",
        },
        category: {
          type: "string",
          description: "Category: web-frontend, web-backend, dev-tool, programming-language, data-storage, etc.",
        },
        description: {
          type: "string",
          description: "The full manual, protocols, mission, and templates for this guide.",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "Initial contexts (optional).",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "Initial learnings (optional).",
        },
      },
      required: ["guide", "category", "description"],
    },
  },
  {
    name: "guide_distill",
    description: "Transform a memory fragment (static fact) into a guide's learning (procedural knowledge). Use this when a learned piece of information should become part of a permanent capability.",
    inputSchema: {
      type: "object",
      properties: {
        memory_id: {
          type: "string",
          description: "ID of the memory fragment to distill",
        },
        guide: {
          type: "string",
          description: "Target guide name (e.g., 'react', 'git'). If it doesn't exist, it will be created.",
        },
        category: {
          type: "string",
          description: "Category for the guide (required only if creating a new guide).",
        },
      },
      required: ["memory_id", "guide"],
    },
  },
  {
    name: "guide_update",
    description: "Update an existing guide's basic properties (name, category, description).",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Current name of the guide to update",
        },
        new_name: {
          type: "string",
          description: "New name for the guide (optional)",
        },
        category: {
          type: "string",
          description: "New category for the guide (optional)",
        },
        description: {
          type: "string",
          description: "New description/manual for the guide (optional)",
        },
        add_anti_patterns: {
          type: "array",
          items: { type: "string" },
          description: "Add anti-patterns to this guide. Optional.",
        },
        add_pitfalls: {
          type: "array",
          items: { type: "string" },
          description: "Add known pitfalls to this guide. Optional.",
        },
        superseded_by: {
          type: "string",
          description: "Mark this guide as superseded by another guide name. Optional.",
        },
        deprecated: {
          type: "boolean",
          description: "Mark this guide as deprecated. Optional.",
        },
      },
      required: ["guide"],
    },
  },
  {
    name: "guide_forget",
    description: "Remove a guide from the persistent database.",
    inputSchema: {
      type: "object",
      properties: {
        guide: {
          type: "string",
          description: "Name of the guide to remove",
        },
      },
      required: ["guide"],
    },
  },
  {
    name: "guide_merge",
    description: "Merge multiple guides into one. You decide the merged content (description, contexts, learnings). Usage counts are summed. Use when you find overlapping guides that should be consolidated.",
    inputSchema: {
      type: "object",
      properties: {
        guides: {
          type: "array",
          items: { type: "string" },
          description: "Array of guide names to merge (will be deleted after merge)",
        },
        guide: {
          type: "string",
          description: "Name for the merged guide",
        },
        category: {
          type: "string",
          description: "Category for the merged guide",
        },
        description: {
          type: "string",
          description: "Merged description/manual (optional, can be empty)",
        },
        contexts: {
          type: "array",
          items: { type: "string" },
          description: "Merged contexts (optional, will auto-merge from source guides if not provided)",
        },
        learnings: {
          type: "array",
          items: { type: "string" },
          description: "Merged learnings (optional, will auto-merge from source guides if not provided)",
        },
      },
      required: ["guides", "guide", "category"],
    },
  },
  {
    name: "session_stats",
    description: "Get virtual session statistics: recent tool usage patterns, technologies encountered, and memory activity.",
    inputSchema: {
      type: "object",
      properties: {
        count: {
          type: "number",
          description: "Number of recent sessions to analyze (default 10)",
        },
      },
    },
  },
];
