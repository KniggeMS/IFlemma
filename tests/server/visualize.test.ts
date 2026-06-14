import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import http from "http";
import * as sessions from "../../src/sessions/index.js";
import { verifyToken } from "../../src/server/visualize.js";

const TOKEN = "test-token-1234";

let TMPDIR: string;

beforeEach(() => {
  // HOME-isolation for consistency with the rest of the server test suite.
  // verifyToken itself is pure (no DB), but keep the sandbox so a future
  // expansion of this file (e.g. an E2E test that boots the server) can't
  // touch the real ~/.lemma.
  TMPDIR = fs.mkdtempSync(path.join(os.tmpdir(), "lemma-viz-"));
  sessions.setSessionsDir(TMPDIR);
});

afterEach(() => {
  sessions.setSessionsDir(path.join(os.homedir(), ".lemma"));
  fs.rmSync(TMPDIR, { recursive: true, force: true });
});

function mockReq(headers: Record<string, string>): http.IncomingMessage {
  return { headers } as unknown as http.IncomingMessage;
}

describe("verifyToken", () => {
  test("correct x-lemma-token header returns true", () => {
    const req = mockReq({ "x-lemma-token": TOKEN });
    const url = new URL("http://localhost/api/data");
    assert.equal(verifyToken(req, url, TOKEN), true);
  });

  test("wrong x-lemma-token header returns false", () => {
    const req = mockReq({ "x-lemma-token": "wrong" });
    const url = new URL("http://localhost/api/data");
    assert.equal(verifyToken(req, url, TOKEN), false);
  });

  test("absent header but correct ?token= query returns true (export path)", () => {
    const req = mockReq({});
    const url = new URL(`http://localhost/api/export?token=${TOKEN}`);
    assert.equal(verifyToken(req, url, TOKEN), true);
  });

  test("absent header and wrong ?token= query returns false", () => {
    const req = mockReq({});
    const url = new URL("http://localhost/api/export?token=wrong");
    assert.equal(verifyToken(req, url, TOKEN), false);
  });

  test("absent header and no query returns false", () => {
    const req = mockReq({});
    const url = new URL("http://localhost/api/data");
    assert.equal(verifyToken(req, url, TOKEN), false);
  });
});
