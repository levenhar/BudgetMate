// qa/merge-reports.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENTS = ['expenses', 'budget', 'goals', 'debts', 'recurring', 'statistics', 'settings', 'shared-a', 'shared-b', 'shared-c'];
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const today = new Date().toISOString().slice(0, 10);
const outputPath = `docs/qa/bug-report-${today}.md`;

function parsePartialReport(content) {
  const bugs = [];
  const sections = content.split('### ').slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0]; // "BUG-001 · CRITICAL · Feature"
    const severityMatch = header.match(/CRITICAL|HIGH|MEDIUM|LOW/);
    const severity = severityMatch ? severityMatch[0] : 'LOW';
    bugs.push({ severity, content: '### ' + section.trim() });
  }
  return bugs;
}

const allBugs = [];

for (const agent of AGENTS) {
  const reportPath = path.join(os.tmpdir(), `qa-report-${agent}.md`);
  if (fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf8');
    const bugs = parsePartialReport(content);
    allBugs.push(...bugs);
  }
}

// Sort by severity
allBugs.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

// Re-number
const renumbered = allBugs.map((bug, i) => {
  const id = `BUG-${String(i + 1).padStart(3, '0')}`;
  return bug.content.replace(/BUG-\d+/, id);
});

const counts = {};
for (const s of SEVERITY_ORDER) counts[s] = allBugs.filter(b => b.severity === s).length;

const header = `# BudgetMate QA Bug Report — ${today}

## Summary
- Total bugs: ${allBugs.length}
- CRITICAL: ${counts.CRITICAL} | HIGH: ${counts.HIGH} | MEDIUM: ${counts.MEDIUM} | LOW: ${counts.LOW}
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts, Recurring Expenses, Statistics, Settings, Shared Expenses (3-user household)

## Bugs (sorted by severity)

`;

fs.mkdirSync('docs/qa', { recursive: true });
fs.writeFileSync(outputPath, header + renumbered.join('\n\n'));
console.log(`Bug report written to ${outputPath} (${allBugs.length} bugs)`);
console.log(`CRITICAL: ${counts.CRITICAL}, HIGH: ${counts.HIGH}, MEDIUM: ${counts.MEDIUM}, LOW: ${counts.LOW}`);
