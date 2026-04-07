import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isSafeCommand } from "../src/safety.js";
import { DEFAULT_SAFE_PREFIXES, DEFAULT_DANGEROUS_PATTERNS } from "../src/config.js";

const defaultRegexes = DEFAULT_DANGEROUS_PATTERNS.map((p) => new RegExp(p));

function safe(cmd: string) {
  return isSafeCommand(cmd, DEFAULT_SAFE_PREFIXES, defaultRegexes);
}

describe("isSafeCommand", () => {
  // --- Safe commands ---
  it("allows bare safe prefix (ls)", () => {
    assert.equal(safe("ls"), true);
  });

  it("allows safe prefix with arguments (ls -la /tmp)", () => {
    assert.equal(safe("ls -la /tmp"), true);
  });

  it("allows safe prefix with newline continuation", () => {
    assert.equal(safe("grep\n-r foo ."), true);
  });

  it("allows git status with extra args", () => {
    assert.equal(safe("git status --short"), true);
  });

  it("allows git log with flags", () => {
    assert.equal(safe("git log --oneline -n 10"), true);
  });

  it("allows cat with a path", () => {
    assert.equal(safe("cat src/index.ts"), true);
  });

  it("allows echo with text", () => {
    assert.equal(safe("echo hello"), true);
  });

  it("allows leading whitespace (trimmed)", () => {
    assert.equal(safe("  ls -la"), true);
  });

  // --- Unsafe commands ---
  it("blocks unknown command", () => {
    assert.equal(safe("npm install"), false);
  });

  it("blocks rm command", () => {
    assert.equal(safe("rm -rf /tmp/foo"), false);
  });

  it("blocks pipe operator", () => {
    assert.equal(safe("ls | grep foo"), false);
  });

  it("blocks && chaining", () => {
    assert.equal(safe("ls && rm foo"), false);
  });

  it("blocks || chaining", () => {
    assert.equal(safe("ls || echo fail"), false);
  });

  it("blocks semicolon chaining", () => {
    assert.equal(safe("ls; rm foo"), false);
  });

  it("blocks redirect >", () => {
    assert.equal(safe("echo hi > file.txt"), false);
  });

  it("blocks append redirect >>", () => {
    assert.equal(safe("echo hi >> file.txt"), false);
  });

  it("blocks backtick substitution", () => {
    assert.equal(safe("echo `whoami`"), false);
  });

  it("blocks $() substitution", () => {
    assert.equal(safe("echo $(whoami)"), false);
  });

  it("blocks sudo", () => {
    assert.equal(safe("sudo ls"), false);
  });

  it("blocks eval", () => {
    assert.equal(safe("eval something"), false);
  });

  it("blocks bash", () => {
    assert.equal(safe("bash script.sh"), false);
  });

  it("blocks sh", () => {
    assert.equal(safe("sh script.sh"), false);
  });

  // --- Dangerous pattern takes priority over safe prefix ---
  it("blocks safe prefix that contains a dangerous pattern (pipe)", () => {
    assert.equal(safe("grep foo | head"), false);
  });

  it("blocks safe prefix that contains rm", () => {
    assert.equal(safe("find . -name foo; rm it"), false);
  });

  // --- Custom prefixes / regexes ---
  it("allows a custom safe prefix", () => {
    assert.equal(isSafeCommand("docker ps", ["docker ps"], []), true);
  });

  it("blocks a command matching a custom dangerous regex", () => {
    assert.equal(
      isSafeCommand("ls", DEFAULT_SAFE_PREFIXES, [/ls/]),
      false,
    );
  });

  it("safe returns false for empty string", () => {
    assert.equal(safe(""), false);
  });
});
