#!/usr/bin/env node
import { startServer, runLibMode } from "./server/index.js";

if (process.argv.includes("-lib")) {
  runLibMode().catch((error: Error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
} else {
  startServer().catch((error: Error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
