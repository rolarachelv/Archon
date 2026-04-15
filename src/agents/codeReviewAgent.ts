/**
 * Code Review Agent
 *
 * Orchestrates automated code review by loading the review prompt,
 * analysing a diff or set of changed files, and returning structured
 * feedback that can be surfaced in a PR comment or CI annotation.
 */

import * as fs from "fs";
import * as path from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "error" | "warning" | "info" | "suggestion";

export interface ReviewComment {
  file: string;
  line?: number;
  severity: Severity;
  rule?: string;
  message: string;
}

export interface CodeReviewResult {
  summary: string;
  approved: boolean;
  comments: ReviewComment[];
  score: number; // 0–100
}

// ---------------------------------------------------------------------------
// Prompt loader
// ---------------------------------------------------------------------------

/**
 * Loads the code-review-agent system prompt from the .archon/commands directory.
 * Falls back to a minimal inline prompt when the file is absent (e.g. in tests).
 */
export function loadCodeReviewPrompt(): string {
  const promptPath = path.resolve(
    __dirname,
    "../../.archon/commands/defaults/archon-code-review-agent.md"
  );

  if (fs.existsSync(promptPath)) {
    return fs.readFileSync(promptPath, "utf-8");
  }

  // Minimal fallback so the agent can still operate without the markdown file.
  return [
    "You are an expert code reviewer.",
    "Analyse the supplied diff and return JSON matching the CodeReviewResult schema.",
    "Be concise, actionable, and constructive.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

/**
 * Derives an approval decision and numeric score from a list of review comments.
 *
 * - Any `error`-severity comment blocks approval.
 * - Score starts at 100 and is penalised: errors −15, warnings −5, infos −1.
 */
export function computeReviewScore(
  comments: ReviewComment[]
): { approved: boolean; score: number } {
  let score = 100;
  let hasError = false;

  for (const c of comments) {
    switch (c.severity) {
      case "error":
        score -= 15;
        hasError = true;
        break;
      case "warning":
        score -= 5;
        break;
      case "info":
        score -= 1;
        break;
      // suggestions carry no penalty
    }
  }

  return {
    approved: !hasError,
    score: Math.max(0, score),
  };
}

/**
 * Builds a complete CodeReviewResult from a list of individual comments
 * and an optional human-readable summary override.
 */
export function buildReviewResult(
  comments: ReviewComment[],
  summaryOverride?: string
): CodeReviewResult {
  const { approved, score } = computeReviewScore(comments);

  const errorCount = comments.filter((c) => c.severity === "error").length;
  const warningCount = comments.filter((c) => c.severity === "warning").length;

  const defaultSummary =
    comments.length === 0
      ? "No issues found. LGTM!"
      : `Found ${errorCount} error(s) and ${warningCount} warning(s). ` +
        (approved ? "Approved with suggestions." : "Changes requested.");

  return {
    summary: summaryOverride ?? defaultSummary,
    approved,
    comments,
    score,
  };
}

/**
 * Formats a CodeReviewResult as a Markdown string suitable for a PR comment.
 */
export function formatReviewReport(result: CodeReviewResult): string {
  const statusBadge = result.approved ? "✅ Approved" : "❌ Changes Requested";
  const lines: string[] = [
    `## Code Review — ${statusBadge} (score: ${result.score}/100)`,
    "",
    `**Summary:** ${result.summary}`,
    "",
  ];

  if (result.comments.length > 0) {
    lines.push("### Comments", "");
    for (const c of result.comments) {
      const location = c.line ? `${c.file}:${c.line}` : c.file;
      const rule = c.rule ? ` \`[${c.rule}]\`` : "";
      lines.push(`- **[${c.severity.toUpperCase()}]**${rule} \`${location}\` — ${c.message}`);
    }
  }

  return lines.join("\n");
}
