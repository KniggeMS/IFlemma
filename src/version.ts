import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Single source of truth for the version Lemma reports (MCP serverInfo, etc.).
 *
 * Read from package.json at module load via fs (NOT a JSON import) so:
 *  - the reported version can never drift via a stale hardcoded literal, and
 *  - it works on every supported Node version. A bare `import pkg from
 *    "../package.json"` compiles under tsc but crashes at runtime on Node 22+
 *    (ERR_IMPORT_ATTRIBUTE_MISSING — JSON imports require `with { type: "json" }`),
 *    which is invisible under tsx but breaks the published package.
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(here, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };

export const VERSION: string = pkg.version;
