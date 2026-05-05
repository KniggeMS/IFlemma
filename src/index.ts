#!/usr/bin/env node
import { startServer, runLibMode } from "./server/index.js";
import { startVisualizeServer } from "./server/visualize.js";

const args = process.argv.slice(2);

if (args.includes("-lib")) {
  runLibMode().catch((error: Error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
} else if (args.includes("-vis")) {
  const portIdx = args.indexOf("-p");
  const port = portIdx !== -1 && args[portIdx + 1] ? parseInt(args[portIdx + 1], 10) : undefined;
  startVisualizeServer(port).catch((error: Error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
} else {
  startServer().catch((error: Error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
