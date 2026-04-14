import {
  buildAuditResult,
  computeRecommendation,
  formatAuditReport,
  SecurityFinding,
} from "./securityAuditAgent";

const mockFindings: SecurityFinding[] = [
  {
    severity: "high",
    title: "Hardcoded API Key",
    file: "src/config.ts",
    line: 12,
    description: "An API key is hardcoded directly in source code.",
    evidence: "const API_KEY = 'sk-abc123';",
    remediation: "Move the key to an environment variable and use process.env.API_KEY.",
    autoFixable: false,
    references: ["CWE-798"],
  },
  {
    severity: "low",
    title: "Missing HTTPS Enforcement",
    file: "src/server.ts",
    line: 45,
    description: "HTTP requests are not redirected to HTTPS.",
    evidence: "app.listen(3000)",
    remediation: "Add helmet and enforce HTTPS redirects in production.",
    autoFixable: true,
  },
];

describe("computeRecommendation", () => {
  it("returns REQUEST_CHANGES when high severity finding exists", () => {
    expect(computeRecommendation(mockFindings)).toBe("REQUEST_CHANGES");
  });

  it("returns APPROVE when no findings exist", () => {
    expect(computeRecommendation([])).toBe("APPROVE");
  });

  it("returns NEEDS_DISCUSSION for medium severity only", () => {
    const mediumOnly: SecurityFinding[] = [
      { ...mockFindings[1], severity: "medium" },
    ];
    expect(computeRecommendation(mediumOnly)).toBe("NEEDS_DISCUSSION");
  });

  it("returns REQUEST_CHANGES when critical severity finding exists", () => {
    const criticalFinding: SecurityFinding[] = [
      { ...mockFindings[0], severity: "critical" },
    ];
    expect(computeRecommendation(criticalFinding)).toBe("REQUEST_CHANGES");
  });

  // Personal note: also verify that low-only findings still result in APPROVE,
  // since low severity shouldn't block a merge on its own.
  it("returns APPROVE when only low severity findings exist", () => {
    const lowOnly: SecurityFinding[] = [
      { ...mockFindings[1], severity: "low" },
    ];
    expect(computeRecommendation(lowOnly)).toBe("APPROVE");
  });
});

describe("buildAuditResult", () => {
  it("correctly counts findings by severity", () => {
    const result = buildAuditResult(mockFindings, ["src/config.ts", "src/server.ts"]);
    expect(result.summary.total).toBe(2);
    expect(result.summary.high).toBe(1);
    expect(result.summary.low).toBe(1);
    expect(result.summary.critical).toBe(0);
    expect(result.auditedFiles).toHaveLength(2);
    expect(result.timestamp).toBeTruthy();
  });
});

describe("formatAuditReport", () => {
  it("includes recommendation in output", () => {
    const result = buildAuditResult(mockFindings, ["src/config.ts"]);
    const report = formatAuditReport(result);
    expect(report).toContain("REQUEST_CHANGES");
    expect(report).toContain("Hardcoded API Key");
    expect(report).toContain("[AUTO-FIXABLE]");
    expect(report).toContain("[MANUAL REVIEW REQUIRED]");
    expect(report).toContain("CWE-798");
  });

  it("produces a markdown-formatted report", () => {
    const result = buildAuditResult([], []);
    const report = formatAuditReport(result);
    expect(report).toContain("## Security Audit Report");
    expect(report).toContain("Total Findings: 0");
  });
});
