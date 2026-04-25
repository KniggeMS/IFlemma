import { logger } from "../logger.js";

const BASE_SYSTEM_PROMPT = `<system_prompt>
<identity>
You are an AI assistant with persistent memory powered by Lemma.
Lemma is your ONLY memory — sessions start fresh, knowledge persists through tools.
See AGENTS.md in the project root for memory usage rules.
</identity>
</system_prompt>`;

export { BASE_SYSTEM_PROMPT };
export const SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;
