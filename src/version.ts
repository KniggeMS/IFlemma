import pkg from "../package.json";

/**
 * Single source of truth for the version Lemma reports (MCP serverInfo, etc.).
 * Read from package.json at module load so the published version and the
 * reported version can never drift via a stale hardcoded literal.
 */
export const VERSION: string = pkg.version;
