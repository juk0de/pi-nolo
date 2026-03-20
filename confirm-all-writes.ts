/**
 * Confirm All Writes Extension (pi-nolo)
 *
 * Gates write, edit, and bash tools behind user confirmation (Enter to allow, Escape to block).
 * Read-safe bash commands (ls, grep, git status, etc.) are auto-approved via a configurable allowlist.
 * Commands containing dangerous patterns (pipes, chaining, redirects, etc.) always require confirmation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// --- Default configuration ---

const DEFAULT_SAFE_PREFIXES = [
	"ls", "cat", "head", "tail", "wc",
	"find", "grep", "rg", "fd", "tree",
	"file", "stat", "du", "df",
	"which", "whoami", "pwd", "echo", "date", "uname",
	"env", "printenv",
	"git status", "git log", "git diff", "git show",
	"git branch", "git remote", "git tag", "git rev-parse",
	"npm list", "npm outdated", "npm view",
	"node --version", "python --version",
	"cargo --version", "rustc --version", "go version",
];

const DEFAULT_DANGEROUS_PATTERNS = [
	"\\|", "&&", "\\|\\|", ";", "`", "\\$\\(",
	">\\s", ">>",
	"\\brm\\b", "\\bsudo\\b", "\\beval\\b", "\\bexec\\b",
	"\\bsource\\b", "\\bsh\\b", "\\bbash\\b",
];

// --- Config types ---

interface NoloConfig {
	safePrefixes: string[];
	dangerousPatterns: string[];
}

// --- Config loading ---

function loadJsonFile(path: string): Partial<NoloConfig> | null {
	try {
		if (!existsSync(path)) return null;
		const raw = readFileSync(path, "utf-8");
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

function loadConfig(): { safePrefixes: string[]; dangerousRegexes: RegExp[] } {
	const globalPath = join(homedir(), ".pi", "agent", "nolo.json");
	const projectPath = join(".pi", "nolo.json");

	const globalCfg = loadJsonFile(globalPath);
	const projectCfg = loadJsonFile(projectPath);

	// Merge safe prefixes: union of defaults + global + project
	let safePrefixes = [...DEFAULT_SAFE_PREFIXES];
	if (globalCfg?.safePrefixes) {
		safePrefixes = [...new Set([...safePrefixes, ...globalCfg.safePrefixes])];
	}
	if (projectCfg?.safePrefixes) {
		safePrefixes = [...new Set([...safePrefixes, ...projectCfg.safePrefixes])];
	}

	// Dangerous patterns: project overrides global overrides defaults
	let dangerousPatterns = DEFAULT_DANGEROUS_PATTERNS;
	if (globalCfg?.dangerousPatterns) {
		dangerousPatterns = globalCfg.dangerousPatterns;
	}
	if (projectCfg?.dangerousPatterns) {
		dangerousPatterns = projectCfg.dangerousPatterns;
	}

	const dangerousRegexes = dangerousPatterns.map((p) => new RegExp(p));

	return { safePrefixes, dangerousRegexes };
}

// --- Safety check ---

function isSafeCommand(
	command: string,
	safePrefixes: string[],
	dangerousRegexes: RegExp[],
): boolean {
	const trimmed = command.trim();

	// Check dangerous patterns first — any match means unsafe
	for (const re of dangerousRegexes) {
		if (re.test(trimmed)) return false;
	}

	// Check if command matches a safe prefix
	for (const prefix of safePrefixes) {
		if (trimmed === prefix || trimmed.startsWith(prefix + " ") || trimmed.startsWith(prefix + "\n")) {
			return true;
		}
	}

	return false;
}

// --- Extension entry point ---

export default function (pi: ExtensionAPI) {
	let safePrefixes: string[] = DEFAULT_SAFE_PREFIXES;
	let dangerousRegexes: RegExp[] = DEFAULT_DANGEROUS_PATTERNS.map((p) => new RegExp(p));

	// Load config on session start
	pi.on("session_start", async () => {
		const config = loadConfig();
		safePrefixes = config.safePrefixes;
		dangerousRegexes = config.dangerousRegexes;
	});

	pi.on("tool_call", async (event, ctx) => {
		const toolName = event.toolName;

		if (toolName === "write") {
			const path = event.input.path as string;
			const content = event.input.content as string;
			const lines = content ? content.split("\n").length : 0;

			if (!ctx.hasUI) {
				return { block: true, reason: "Blocked by user" };
			}

			const confirmed = await ctx.ui.confirm("Write file?", `${path} (${lines} lines)`);
			if (!confirmed) {
				return { block: true, reason: "Blocked by user" };
			}
		} else if (toolName === "edit") {
			const path = event.input.path as string;

			if (!ctx.hasUI) {
				return { block: true, reason: "Blocked by user" };
			}

			const confirmed = await ctx.ui.confirm("Edit file?", path);
			if (!confirmed) {
				return { block: true, reason: "Blocked by user" };
			}
		} else if (toolName === "bash") {
			const command = event.input.command as string;

			if (!ctx.hasUI) {
				return { block: true, reason: "Blocked by user" };
			}

			// Auto-approve safe read-only commands
			if (isSafeCommand(command, safePrefixes, dangerousRegexes)) {
				return undefined;
			}

			const confirmed = await ctx.ui.confirm("Run command?", command);
			if (!confirmed) {
				return { block: true, reason: "Blocked by user" };
			}
		}

		return undefined;
	});
}
