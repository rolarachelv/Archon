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
 * - Score starts at 100 and is penalised: errors −15, warnings −8, infos −2.
 *
 * Note: I bumped the warning penalty from −5 to −8 because in practice a
 * handful of warnings was leaving scores misleadingly high. Errors stay at −15.
 * Also bumped info penalty from −1 to −2; minor issues add up across large PRs.
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
        score -= 8; // was −5; increased to better reflect real impact
        break;
      case "info":
        score -= 2; // was −1; small issues still matter at scale
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
  comments: Revie