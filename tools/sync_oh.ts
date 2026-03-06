#!/usr/bin/env ts-node
/**
 * CRAFT Sync OH - Skill #14
 * Detect and fix drift between main src/ and the OpenHarmony ArkTS copy.
 *
 * Non-adapted files are byte-compared and can be auto-synced with --fix.
 * Adapted files (with intentional ArkTS differences) are checked for
 * missing exports that may need manual porting.
 */

import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');
const OH_DIR = path.join(PROJECT_ROOT, 'src', 'oh', 'entry', 'src', 'main', 'ets', 'craft');

/** Files with intentional ArkTS adaptations - cannot be auto-synced */
const ADAPTED_FILES: { relative: string; adaptation: string }[] = [
  { relative: 'bridge/ui_bridge.ts', adaptation: 'Map<string, string|number|boolean> instead of any; separate clickCallbacks map' },
  { relative: 'bridge/state_manager.ts', adaptation: 'Record<string, string|number|boolean> instead of any' },
  { relative: 'parser/apk_parser.ts', adaptation: 'Manual UTF-8 decoder instead of TextDecoder; no Node.js fs' },
  { relative: 'parser/manifest_parser.ts', adaptation: 'Manual UTF-8 decoder instead of TextDecoder' },
  { relative: 'shim/android/view/view.ts', adaptation: 'Uses setClickCallback() instead of updateViewProperty(onClick, ...)' },
  { relative: 'runtime.ts', adaptation: 'OpenHarmony rawfile API instead of Node.js fs' },
];

const ADAPTED_SET = new Set(ADAPTED_FILES.map((f) => f.relative));

/** Files to skip entirely (not part of the synced codebase) */
const SKIP_FILES = new Set(['index.ts']);

interface FileStatus {
  relative: string;
  status: 'in-sync' | 'out-of-sync' | 'missing-in-oh' | 'missing-in-src' | 'adapted-ok' | 'adapted-drift';
  adapted: boolean;
  detail?: string;
}

function printUsage(): void {
  console.log(`
[CRAFT][SyncOH] OH Sync Checker

Usage: npm run sync-oh [options]

Options:
  --fix             Auto-copy non-adapted files that are out of sync (src -> OH)
  --verbose         Show all files, not just problems
  --json            Machine-readable output
  --list-adapted    List adapted files and their adaptations
  --help            Show this help

Behavior:
  - Non-adapted files: byte-for-byte comparison. --fix copies src -> OH.
  - Adapted files: checks for new exports in src that are missing from OH.
  - Exit code: 0 = all in sync, 1 = issues found.
`);
}

/** Discover all .ts files under a directory, returning paths relative to base */
function discoverFiles(base: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.ts')) {
        const rel = path.relative(base, fullPath).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }

  walk(base);
  return results.sort();
}

/** Extract exported symbol names from a TypeScript source */
function extractExports(source: string): string[] {
  const exports: string[] = [];
  const pattern = /export\s+(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    exports.push(match[1]);
  }
  return exports.sort();
}

/** Compare non-adapted files byte-for-byte */
function compareIdentical(relative: string): FileStatus {
  const srcPath = path.join(SRC_DIR, relative);
  const ohPath = path.join(OH_DIR, relative);

  if (!fs.existsSync(srcPath)) {
    return { relative, status: 'missing-in-src', adapted: false, detail: 'File exists in OH but not in src' };
  }
  if (!fs.existsSync(ohPath)) {
    return { relative, status: 'missing-in-oh', adapted: false, detail: 'File exists in src but not in OH' };
  }

  const srcContent = fs.readFileSync(srcPath);
  const ohContent = fs.readFileSync(ohPath);

  if (srcContent.equals(ohContent)) {
    return { relative, status: 'in-sync', adapted: false };
  }

  return { relative, status: 'out-of-sync', adapted: false, detail: 'Content differs (src is authoritative)' };
}

/** Compare adapted files by checking for missing exports */
function compareAdapted(relative: string): FileStatus {
  const srcPath = path.join(SRC_DIR, relative);
  const ohPath = path.join(OH_DIR, relative);

  if (!fs.existsSync(srcPath)) {
    return { relative, status: 'missing-in-src', adapted: true, detail: 'File exists in OH but not in src' };
  }
  if (!fs.existsSync(ohPath)) {
    return { relative, status: 'missing-in-oh', adapted: true, detail: 'File exists in src but not in OH' };
  }

  const srcSource = fs.readFileSync(srcPath, 'utf-8');
  const ohSource = fs.readFileSync(ohPath, 'utf-8');

  const srcExports = extractExports(srcSource);
  const ohExports = new Set(extractExports(ohSource));

  const missingInOh = srcExports.filter((e) => !ohExports.has(e));

  if (missingInOh.length === 0) {
    return { relative, status: 'adapted-ok', adapted: true };
  }

  return {
    relative,
    status: 'adapted-drift',
    adapted: true,
    detail: `src has new exports missing from OH: ${missingInOh.join(', ')}`,
  };
}

/** Scan all files and return statuses */
function scanFiles(): FileStatus[] {
  // Discover files in both trees
  const srcFiles = discoverFiles(SRC_DIR).filter(
    (f) => !f.startsWith('oh/') && !SKIP_FILES.has(f)
  );
  const ohFiles = discoverFiles(OH_DIR).filter(
    (f) => !SKIP_FILES.has(f)
  );

  const allRelative = new Set([...srcFiles, ...ohFiles]);
  const results: FileStatus[] = [];

  for (const rel of [...allRelative].sort()) {
    if (ADAPTED_SET.has(rel)) {
      results.push(compareAdapted(rel));
    } else {
      results.push(compareIdentical(rel));
    }
  }

  return results;
}

/** Copy src -> OH for out-of-sync non-adapted files */
function fixIdenticalFiles(statuses: FileStatus[]): number {
  let fixed = 0;

  for (const s of statuses) {
    if (s.adapted) continue;

    if (s.status === 'out-of-sync' || s.status === 'missing-in-oh') {
      const srcPath = path.join(SRC_DIR, s.relative);
      const ohPath = path.join(OH_DIR, s.relative);

      // Ensure directory exists
      const dir = path.dirname(ohPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.copyFileSync(srcPath, ohPath);
      fixed++;
    }
  }

  return fixed;
}

/** Format report for console output */
function formatReport(statuses: FileStatus[], verbose: boolean): void {
  const identical = statuses.filter((s) => !s.adapted);
  const adapted = statuses.filter((s) => s.adapted);

  // Identical files section
  console.log('Identical files (auto-syncable):');
  for (const s of identical) {
    if (s.status === 'in-sync') {
      if (verbose) {
        console.log(`  \u2713 ${s.relative}`);
      }
    } else if (s.status === 'out-of-sync') {
      console.log(`  \u2717 ${s.relative}  \u2190 OUT OF SYNC (src is newer)`);
    } else if (s.status === 'missing-in-oh') {
      console.log(`  \u2717 ${s.relative}  \u2190 MISSING IN OH`);
    } else if (s.status === 'missing-in-src') {
      console.log(`  \u2717 ${s.relative}  \u2190 MISSING IN SRC (orphaned OH file)`);
    }
  }

  const identicalIssues = identical.filter((s) => s.status !== 'in-sync');
  if (identicalIssues.length === 0) {
    console.log('  All identical files are in sync.');
  }
  console.log('');

  // Adapted files section
  console.log('Adapted files (manual review needed):');
  for (const s of adapted) {
    if (s.status === 'adapted-ok') {
      if (verbose) {
        const info = ADAPTED_FILES.find((a) => a.relative === s.relative);
        console.log(`  \u2713 ${s.relative} - exports match`);
        if (info) {
          console.log(`      Adaptation: ${info.adaptation}`);
        }
      }
    } else if (s.status === 'adapted-drift') {
      console.log(`  \u26A0 ${s.relative} - ${s.detail}`);
    } else if (s.status === 'missing-in-oh') {
      console.log(`  \u2717 ${s.relative}  \u2190 MISSING IN OH`);
    } else if (s.status === 'missing-in-src') {
      console.log(`  \u2717 ${s.relative}  \u2190 MISSING IN SRC`);
    }
  }

  const adaptedIssues = adapted.filter((s) => s.status !== 'adapted-ok');
  if (adaptedIssues.length === 0) {
    console.log('  All adapted files have matching exports.');
  }
  console.log('');

  // Summary
  const totalIssues = statuses.filter(
    (s) => s.status !== 'in-sync' && s.status !== 'adapted-ok'
  ).length;
  const outOfSync = statuses.filter((s) => s.status === 'out-of-sync').length;
  const missingOh = statuses.filter((s) => s.status === 'missing-in-oh').length;
  const missingSrc = statuses.filter((s) => s.status === 'missing-in-src').length;
  const adaptedDrift = statuses.filter((s) => s.status === 'adapted-drift').length;

  if (totalIssues === 0) {
    console.log(`Summary: All ${statuses.length} files are in sync.`);
  } else {
    const parts: string[] = [];
    if (outOfSync > 0) parts.push(`${outOfSync} out of sync`);
    if (missingOh > 0) parts.push(`${missingOh} missing in OH`);
    if (missingSrc > 0) parts.push(`${missingSrc} missing in src`);
    if (adaptedDrift > 0) parts.push(`${adaptedDrift} adapted file(s) need review`);
    console.log(`Summary: ${parts.join(', ')}`);
    if (outOfSync > 0 || missingOh > 0) {
      console.log('Run with --fix to auto-sync identical files.');
    }
  }
}

/** Format report as JSON */
function formatJson(statuses: FileStatus[]): void {
  const output = {
    total: statuses.length,
    inSync: statuses.filter((s) => s.status === 'in-sync' || s.status === 'adapted-ok').length,
    issues: statuses.filter((s) => s.status !== 'in-sync' && s.status !== 'adapted-ok').length,
    files: statuses.map((s) => ({
      file: s.relative,
      status: s.status,
      adapted: s.adapted,
      ...(s.detail ? { detail: s.detail } : {}),
    })),
  };
  console.log(JSON.stringify(output, null, 2));
}

/** List adapted files and their adaptations */
function listAdapted(): void {
  console.log('[CRAFT][SyncOH][Info] Adapted files (intentional ArkTS differences):\n');
  for (const f of ADAPTED_FILES) {
    console.log(`  ${f.relative}`);
    console.log(`    Adaptation: ${f.adaptation}`);
    console.log('');
  }
  console.log(`Total: ${ADAPTED_FILES.length} adapted files`);
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  if (args.includes('--list-adapted')) {
    listAdapted();
    process.exit(0);
  }

  const fix = args.includes('--fix');
  const verbose = args.includes('--verbose');
  const jsonOutput = args.includes('--json');

  console.log('[CRAFT][SyncOH][Info] Scanning files...\n');

  const statuses = scanFiles();

  if (fix) {
    const fixed = fixIdenticalFiles(statuses);
    if (fixed > 0) {
      console.log(`[CRAFT][SyncOH][Info] Auto-synced ${fixed} file(s) (src -> OH)\n`);
      // Re-scan after fix
      const updated = scanFiles();
      if (jsonOutput) {
        formatJson(updated);
      } else {
        formatReport(updated, verbose);
      }
    } else {
      console.log('[CRAFT][SyncOH][Info] Nothing to fix.\n');
      if (jsonOutput) {
        formatJson(statuses);
      } else {
        formatReport(statuses, verbose);
      }
    }
  } else {
    if (jsonOutput) {
      formatJson(statuses);
    } else {
      formatReport(statuses, verbose);
    }
  }

  // Exit code
  const hasIssues = statuses.some(
    (s) => s.status !== 'in-sync' && s.status !== 'adapted-ok'
  );
  if (hasIssues && !fix) {
    process.exit(1);
  }
}

main();
