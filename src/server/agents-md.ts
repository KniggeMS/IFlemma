import fs from "fs";
import path from "path";
import { logger } from "../logger.js";

const MARKER_START = "<!-- lemma:start -->";
const MARKER_END = "<!-- lemma:end -->";

const LEMMA_SECTION = `## Lemma — Your Persistent Memory

**Without Lemma you have ZERO memory.** Every session starts completely blank — you remember nothing from before.
Lemma is your persistent memory. It is the ONLY thing that survives between sessions.
Use it to build your own knowledge base, skill set, and capabilities over time.

**Before every task:**
- \`memory_read\` — Load what you already know. Skip this and you waste tokens re-analyzing files you already studied.

**After learning something new:**
- \`memory_add\` — Save it. Skip this and the knowledge is GONE forever next session.

**When reality contradicts your memory:**
- \`memory_update\` — Fix it. Skip this and you keep acting on wrong/stale information.

**Build your skills over time:**
- \`guide_practice\` — Track techniques you apply. Builds your skill history and success rate.
- \`guide_distill\` — Turn repeated patterns into reusable skills. This is how you grow capabilities.
- \`memory_relate\` — Connect related knowledge into a web of understanding.
- \`memory_feedback\` — Rate whether a memory was useful or wrong. Improves ranking over time.

**Your memory and guides are YOURS to build.** The more you use these tools, the more capable you become across sessions. Ignore them and every conversation is day one — nothing accumulates.

Use \`guide_get\` to read guide details, \`guide_create\` to create new ones, \`memory_forget\` to remove outdated info, \`memory_merge\` to consolidate duplicates. Explore all available tools — each one exists to make you better.`;

export function injectAgentsMd(projectDir: string): { injected: boolean; created: boolean; path: string } {
  const agentsPath = path.join(projectDir, "AGENTS.md");

  let existing = "";
  let created = false;

  if (fs.existsSync(agentsPath)) {
    existing = fs.readFileSync(agentsPath, "utf-8");

    if (existing.includes(MARKER_START)) {
      const startIdx = existing.indexOf(MARKER_START);
      const endIdx = existing.indexOf(MARKER_END);
      if (endIdx > startIdx) {
        const updated =
          existing.substring(0, startIdx) +
          MARKER_START + "\n" + LEMMA_SECTION + "\n" + MARKER_END +
          existing.substring(endIdx + MARKER_END.length);
        fs.writeFileSync(agentsPath, updated, "utf-8");
        logger.flow("agents_md", "updated", { path: agentsPath });
        return { injected: true, created: false, path: agentsPath };
      }
    }
  } else {
    created = true;
  }

  const lemmaBlock = MARKER_START + "\n" + LEMMA_SECTION + "\n" + MARKER_END;

  let content: string;
  if (existing.length > 0) {
    content = lemmaBlock + "\n\n" + existing;
  } else {
    content = lemmaBlock + "\n";
  }

  fs.writeFileSync(agentsPath, content, "utf-8");
  logger.flow("agents_md", created ? "created" : "injected", { path: agentsPath });

  return { injected: true, created, path: agentsPath };
}

export function removeAgentsMd(projectDir: string): boolean {
  const agentsPath = path.join(projectDir, "AGENTS.md");

  if (!fs.existsSync(agentsPath)) return false;

  const content = fs.readFileSync(agentsPath, "utf-8");
  if (!content.includes(MARKER_START)) return false;

  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);

  if (endIdx < 0) return false;

  let cleaned = content.substring(0, startIdx) + content.substring(endIdx + MARKER_END.length);
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  if (cleaned.length === 0) {
    fs.unlinkSync(agentsPath);
    logger.flow("agents_md", "removed_empty", { path: agentsPath });
  } else {
    fs.writeFileSync(agentsPath, cleaned + "\n", "utf-8");
    logger.flow("agents_md", "cleaned", { path: agentsPath });
  }

  return true;
}
