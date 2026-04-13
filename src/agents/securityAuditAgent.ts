import { readFileSync } from "fs";
import { join } from "path";

export interface SecurityFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  file: string;
  line?: number;
  description: string;
  evidence: string;
  remediation: string;
  autoFixable: boolean;
  references?: string[];
}

export interface SecurityAuditResult {
  summary: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  findings: SecurityFinding[];
  recommendation: "APPROVE" | "REQUEST_CHANGES" | "NEEDS_DISCUSSION";
  auditedFiles: string[];
  timestamp: string;
}

export function computeRecommendation(
  findings: SecurityFinding[]
): SecurityAuditResult["recommendation"] {
  const hasCritical = findings.some((f) => f.severity === "critical");
  const hasHigh = findings.some((f) => f.severity === "high");
  if (hasCritical || hasHigh) return "REQUEST_CHANGES";
  const hasMedium = findings.some((f) => f.severity === "medium");
  if (hasMedium) return "NEEDS_DISCUSSION";
  return "APPROVE";
}

export function buildAuditResult(
  findings: SecurityFinding[],
  auditedFiles: string[]
): SecurityAuditResult {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) {
    counts[f.severity]++;
  }
  return {
    summary: { total: findings.length, ...counts },
    findings,
    recommendation: computeRecommendation(findings),
    auditedFiles,
    timestamp: new Date().toISOString(),
  };
}

export function loadSecurityAuditPrompt(): string {
  const promptPath = join(
    process.cwd(),
    ".archon/commands/defaults/archon-security-audit.md"
  );
  return readFileSync(promptPath, "utf-8");
}

export function formatAuditReport(result: SecurityAuditResult): string {
  const { summary, findings, recommendation } = result;
  const lines: string[] = [
    "## Security Audit Report",
    "",
    "### Summary",
    `- Total Findings: ${summary.total}`,
    `- Critical: ${summary.critical}`,
    `- High: ${summary.high}`,
    `- Medium: ${summary.medium}`,
    `- Low: ${summary.low}`,
    `- Info: ${summary.info}`,
    "",
    `**Overall Recommendation**: ${recommendation}`,
    "",
    "### Findings",
  ];

  for (const f of findings) {
    const autoTag = f.autoFixable ? "[AUTO-FIXABLE]" : "[MANUAL REVIEW REQUIRED]";
    lines.push("");
    lines.push(`#### [${f.severity.toUpperCase()}] ${f.title} ${autoTag}`);
    lines.push(`- **File**: ${f.file}${f.line ? ` (line ${f.line})` : ""}`);
    lines.push(`- **Description**: ${f.description}`);
    lines.push(`- **Evidence**: \`${f.evidence}\``);
    lines.push(`- **Remediation**: ${f.remediation}`);
    if (f.references?.length) {
      lines.push(`- **References**: ${f.references.join(", ")}`);
    }
  }

  return lines.join("\n");
}
