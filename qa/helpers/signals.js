// tests/qa/helpers/signals.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const SIGNAL_DIR = os.tmpdir();

function signalPath(agentName) {
  return path.join(SIGNAL_DIR, `qa-signal-${agentName}.json`);
}

/**
 * Write one or more key=true entries into an agent's signal file.
 * Atomic: write to .tmp then rename.
 */
export function writeSignal(agentName, checkpoints) {
  const filePath = signalPath(agentName);
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
  const updated = { ...existing, ...checkpoints };
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(updated));
  fs.renameSync(tmpPath, filePath);
}

/**
 * Poll until a specific checkpoint key is true in the target agent's signal file.
 * Throws after timeoutMs if not seen.
 */
export async function waitForSignal(agentName, checkpoint, timeoutMs = 120000) {
  const filePath = signalPath(agentName);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data[checkpoint]) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Timeout waiting for signal: ${agentName}.${checkpoint} (${timeoutMs}ms)`);
}

export function readSession() {
  const sessionPath = path.join(SIGNAL_DIR, 'qa-session.json');
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
}
