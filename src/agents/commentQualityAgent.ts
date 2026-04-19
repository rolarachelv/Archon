import * as fs from "fs";
import * as path from "path";

/**
 * Represents the result of a comment quality analysis.
 */
export interface CommentQualityResult {
  file: string;
  score: number; // 0-100
  issues: CommentIssue[];
  suggestions: string[];
}

export interface CommentIssue {
  line: number;
  type: "missing" | "outdated" | "redundant" | "unclear";
  description: string;
}

/**
 * Loads the comment quality agent prompt from the defaults directory.
 */
export function loadCommentQualityPrompt(): string {
  const promptPath = path.resolve(
    __dirname,
    "../../.archon/commands/defaults/archon-comment-quality-agent.md"
  );
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Comment quality prompt not found at: ${promptPath}`);
  }
  return fs.readFileSync(promptPath, "utf-8");
}

/**
 * Computes a comment quality score based on the ratio of
 * well-documented lines to total code lines.
 *
 * @param totalLines - Total number of non-empty code lines
 * @param commentedLines - Number of lines with associated comments
 * @param issues - Detected comment issues
 * @returns A score between 0 and 100
 */
export function computeCommentScore(
  totalLines: number,
  commentedLines: number,
  issues: CommentIssue[]
): number {
  if (totalLines === 0) return 100;

  const coverageRatio = Math.min(commentedLines / totalLines, 1);
  const coverageScore = coverageRatio * 70;

  const issuePenalty = issues.reduce((penalty, issue) => {
    switch (issue.type) {
      case "missing":
        return penalty + 5;
      case "outdated":
        return penalty + 4;
      case "unclear":
        return penalty + 3;
      case "redundant":
        return penalty + 1;
      default:
        return penalty;
    }
  }, 0);

  const raw = coverageScore + 30 - issuePenalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

/**
 * Builds a CommentQualityResult for a given file analysis.
 */
export function buildCommentQualityResult(
  file: string,
  totalLines: number,
  commentedLines: number,
  issues: CommentIssue[],
  suggestions: string[]
): CommentQualityResult {
  const score = computeCommentScore(totalLines, commentedLines, issues);
  return { file, score, issues, suggestions };
}

/**
 * Formats a CommentQualityResult into a human-readable markdown report.
 */
export function formatCommentQualityReport(result: CommentQualityResult): string {
  const lines: string[] = [
    `## Comment Quality Report: \`${result.file}\``,
    `**Score:** ${result.score}/100`,
    "",
  ];

  if (result.issues.length > 0) {
    lines.push("### Issues");
    for (const issue of result.issues) {
      lines.push(`- **Line ${issue.line}** [${issue.type}]: ${issue.description}`);
    }
    lines.push("");
  }

  if (result.suggestions.length > 0) {
    lines.push("### Suggestions");
    for (const suggestion of result.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }

  return lines.join("\n");
}
