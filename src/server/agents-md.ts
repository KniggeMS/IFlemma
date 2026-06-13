import fs from "fs";
import path from "path";
import { logger } from "../logger.js";

const MARKER_START = "<!-- lemma:start -->";
const MARKER_END = "<!-- lemma:end -->";

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
