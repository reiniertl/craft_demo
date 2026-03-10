#!/usr/bin/env ts-node
/**
 * CRAFT Watch Sync - Automatic OH copy updater
 * Watches src/ for .ts file changes and copies non-adapted files to the
 * OpenHarmony DevEco project at src/oh/entry/src/main/ets/craft/.
 *
 * Usage: npm run watch-sync
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const OH_DIR = path.join(PROJECT_ROOT, 'src', 'oh', 'entry', 'src', 'main', 'ets', 'craft');

/** Files with intentional ArkTS adaptations - warn instead of copying */
const ADAPTED_SET = new Set([
  'bridge/ui_bridge.ts',
  'bridge/state_manager.ts',
  'parser/apk_parser.ts',
  'parser/manifest_parser.ts',
  'shim/android/view/view.ts',
  'runtime.ts',
]);

/** Files to skip entirely */
const SKIP_FILES = new Set(['index.ts']);

/** Debounce timers per file */
const pending = new Map<string, NodeJS.Timeout>();
const DEBOUNCE_MS = 100;

function log(level: string, msg: string): void {
  const ts = new Date().toLocaleTimeString();
  console.log(`[${ts}] [CRAFT][WatchSync][${level}] ${msg}`);
}

function syncFile(relative: string): void {
  const srcPath = path.join(SRC_DIR, relative);
  const ohPath = path.join(OH_DIR, relative);

  if (!fs.existsSync(srcPath)) {
    log('Warn', `Source deleted: ${relative} (OH copy not removed)`);
    return;
  }

  // Check if OH copy already matches
  if (fs.existsSync(ohPath)) {
    const srcBuf = fs.readFileSync(srcPath);
    const ohBuf = fs.readFileSync(ohPath);
    if (srcBuf.equals(ohBuf)) {
      return; // Already in sync, skip
    }
  }

  // Ensure target directory exists
  const dir = path.dirname(ohPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.copyFileSync(srcPath, ohPath);
  log('Info', `Synced: ${relative}`);
}

function handleChange(eventType: string, filename: string | null): void {
  if (!filename) return;

  // Normalize to forward slashes
  const rel = filename.replace(/\\/g, '/');

  // Only .ts files
  if (!rel.endsWith('.ts')) return;

  // Exclude the oh/ subtree
  if (rel.startsWith('oh/')) return;

  // Skip index.ts files
  const basename = path.basename(rel);
  if (SKIP_FILES.has(basename)) return;

  // Adapted files: warn only
  if (ADAPTED_SET.has(rel)) {
    // Debounce the warning too
    const key = `warn:${rel}`;
    if (pending.has(key)) clearTimeout(pending.get(key)!);
    pending.set(key, setTimeout(() => {
      pending.delete(key);
      log('Warn', `Adapted file changed: ${rel} (manual review needed)`);
    }, DEBOUNCE_MS));
    return;
  }

  // Debounce and sync
  if (pending.has(rel)) clearTimeout(pending.get(rel)!);
  pending.set(rel, setTimeout(() => {
    pending.delete(rel);
    syncFile(rel);
  }, DEBOUNCE_MS));
}

// --- Main ---

log('Info', `Watching: ${SRC_DIR}`);
log('Info', `Target:   ${OH_DIR}`);
log('Info', `Adapted files (warn only): ${ADAPTED_SET.size}`);
log('Info', 'Press Ctrl+C to stop.\n');

fs.watch(SRC_DIR, { recursive: true }, handleChange);
