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

  // Verifying mixed low+medium doesn't accidentally escalate to REQUEST_CHANGES.
  it("returns NEEDS_DISCUSSION for mixed low and medium severity findings", () => {
    const mixedFindings: SecurityFinding[] = [
      { ...mockFindings[1], severity: "low" },
      { ...mockFindings[1], severity: "medium" },
    ];
    expect(computeRecommendation(mixedFindings)).toBe("NEEDS_DISCUSSION");
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

  // Personal note: make sure medium count defaults to 0 when no medium findings are present.
  it("reports zero medium count when no medium findings are present", () => {
    const result = buildAuditResult(mockFindings, ["src/config.ts", "src/server.ts"]);
    expect(result.summary.medium).toBe(0);
  });
});
