import { loadCodeReviewPrompt, computeReviewScore, buildReviewResult } from './codeReviewAgent';

describe('computeReviewScore', () => {
  it('returns 100 for empty issues list', () => {
    expect(computeReviewScore([])).toBe(100);
  });

  it('deducts points for critical issues', () => {
    const issues = [
      { severity: 'critical' as const, message: 'SQL injection vulnerability' },
    ];
    const score = computeReviewScore(issues);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('deducts fewer points for minor issues than critical', () => {
    const criticalIssues = [{ severity: 'critical' as const, message: 'critical bug' }];
    const minorIssues = [{ severity: 'minor' as const, message: 'style issue' }];
    expect(computeReviewScore(criticalIssues)).toBeLessThan(computeReviewScore(minorIssues));
  });

  it('clamps score to 0 for many critical issues', () => {
    const issues = Array.from({ length: 20 }, (_, i) => ({
      severity: 'critical' as const,
      message: `Critical issue ${i}`,
    }));
    expect(computeReviewScore(issues)).toBe(0);
  });
});

describe('buildReviewResult', () => {
  const sampleIssues = [
    { severity: 'major' as const, message: 'Missing error handling', line: 42 },
    { severity: 'minor' as const, message: 'Unused variable', line: 10 },
  ];

  it('includes score in result', () => {
    const result = buildReviewResult('src/foo.ts', sampleIssues, 'Looks mostly good.');
    expect(result).toHaveProperty('score');
    expect(typeof result.score).toBe('number');
  });

  it('includes file path in result', () => {
    const result = buildReviewResult('src/foo.ts', sampleIssues, 'Looks mostly good.');
    expect(result.file).toBe('src/foo.ts');
  });

  it('includes all issues in result', () => {
    const result = buildReviewResult('src/foo.ts', sampleIssues, 'Summary text.');
    expect(result.issues).toHaveLength(2);
  });

  it('includes summary in result', () => {
    const result = buildReviewResult('src/foo.ts', sampleIssues, 'Summary text.');
    expect(result.summary).toBe('Summary text.');
  });

  it('sets passed to true when score is above threshold', () => {
    const result = buildReviewResult('src/bar.ts', [], 'No issues found.');
    expect(result.passed).toBe(true);
  });

  it('sets passed to false when score is below threshold', () => {
    const criticalIssues = Array.from({ length: 5 }, (_, i) => ({
      severity: 'critical' as const,
      message: `Critical issue ${i}`,
    }));
    const result = buildReviewResult('src/bar.ts', criticalIssues, 'Many critical issues.');
    expect(result.passed).toBe(false);
  });
});

describe('loadCodeReviewPrompt', () => {
  it('returns a non-empty string', async () => {
    const prompt = await loadCodeReviewPrompt();
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('contains expected review guidance keywords', async () => {
    const prompt = await loadCodeReviewPrompt();
    const lower = prompt.toLowerCase();
    expect(
      lower.includes('review') || lower.includes('code') || lower.includes('issue')
    ).toBe(true);
  });
});
