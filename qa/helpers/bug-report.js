// tests/qa/helpers/bug-report.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeSignal } from './signals.js';

let bugCounter = 0;

/**
 * Append a bug entry to the agent's partial report.
 * @param {string} agentName - e.g. 'expenses', 'shared-a'
 * @param {{ severity, feature, route, steps, expected, actual, consoleErrors, notes }} bug
 */
export function reportBug(agentName, bug) {
  bugCounter++;
  const reportPath = path.join(os.tmpdir(), `qa-report-${agentName}.md`);
  const id = `BUG-${String(bugCounter).padStart(3, '0')}`;
  const entry = `
### ${id} · ${bug.severity} · ${bug.feature}

**Agent:** ${agentName}
**Route:** ${bug.route || 'localhost:5173/'}
**Steps to Reproduce:**
${(bug.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}
**Expected:** ${bug.expected}
**Actual:** ${bug.actual}
**Console Errors:** ${bug.consoleErrors || 'None'}
**Notes:** ${bug.notes || 'None'}

---
`;
  fs.appendFileSync(reportPath, entry);
  console.error(`[${agentName}] ${id} ${bug.severity}: ${bug.feature}`);
}

/**
 * Mark this agent as complete by writing its completion signal.
 * Call at the end of every spec's afterAll.
 */
export function markComplete(agentName) {
  writeSignal(agentName, { complete: true });
}
