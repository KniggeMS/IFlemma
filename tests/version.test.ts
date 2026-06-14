import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { VERSION } from "../src/version.js";

// Resolve package.json relative to this test file so the assertion does not
// depend on the cwd the test runner was launched from.
const here = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(here, "..", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version: string };

describe("VERSION (single source of truth)", () => {
  test("VERSION matches package.json", () => {
    assert.equal(VERSION, pkg.version);
  });

  test("VERSION is not the stale default 1.0.0", () => {
    assert.notEqual(VERSION, "1.0.0");
  });

  test("VERSION is a non-empty semver-like string", () => {
    assert.ok(typeof VERSION === "string" && VERSION.length > 0);
    assert.match(VERSION, /^\d+\.\d+\.\d+/);
  });
});
