#!/usr/bin/env ts-node
/**
 * CRAFT Coverage Map - Skill #7
 * Report opcode and API shim coverage by scanning source code.
 */

import * as fs from 'fs';
import * as path from 'path';
import { APKParser } from '../src/parser/apk_parser';
import { DexParser } from '../src/parser/dex_parser';

interface OpcodeEntry {
  opcode: number;
  name: string;
}

interface ShimEntry {
  className: string;
  methods: { name: string; descriptor: string }[];
}

interface CoverageReport {
  opcodes: {
    implemented: OpcodeEntry[];
    count: number;
  };
  shims: {
    classes: ShimEntry[];
    totalMethods: number;
  };
  apk?: {
    usedOpcodes: { opcode: number; name: string; count: number }[];
    missingOpcodes: { opcode: number; name: string; count: number }[];
    coveragePercent: number;
  };
}

// All 256 Dalvik opcode names
const DALVIK_OPCODES: Map<number, string> = new Map([
  [0x00, 'nop'], [0x01, 'move'], [0x02, 'move/from16'], [0x03, 'move/16'],
  [0x04, 'move-wide'], [0x05, 'move-wide/from16'], [0x06, 'move-wide/16'],
  [0x07, 'move-object'], [0x08, 'move-object/from16'], [0x09, 'move-object/16'],
  [0x0a, 'move-result'], [0x0b, 'move-result-wide'], [0x0c, 'move-result-object'],
  [0x0d, 'move-exception'], [0x0e, 'return-void'], [0x0f, 'return'],
  [0x10, 'return-wide'], [0x11, 'return-object'], [0x12, 'const/4'],
  [0x13, 'const/16'], [0x14, 'const'], [0x15, 'const/high16'],
  [0x16, 'const-wide/16'], [0x17, 'const-wide/32'], [0x18, 'const-wide'],
  [0x19, 'const-wide/high16'], [0x1a, 'const-string'], [0x1b, 'const-string/jumbo'],
  [0x1c, 'const-class'], [0x1d, 'monitor-enter'], [0x1e, 'monitor-exit'],
  [0x1f, 'check-cast'], [0x20, 'instance-of'], [0x21, 'array-length'],
  [0x22, 'new-instance'], [0x23, 'new-array'], [0x24, 'filled-new-array'],
  [0x25, 'filled-new-array/range'], [0x26, 'fill-array-data'],
  [0x27, 'throw'], [0x28, 'goto'], [0x29, 'goto/16'], [0x2a, 'goto/32'],
  [0x2b, 'packed-switch'], [0x2c, 'sparse-switch'],
  [0x2d, 'cmpl-float'], [0x2e, 'cmpg-float'], [0x2f, 'cmpl-double'],
  [0x30, 'cmpg-double'], [0x31, 'cmp-long'],
  [0x32, 'if-eq'], [0x33, 'if-ne'], [0x34, 'if-lt'], [0x35, 'if-ge'],
  [0x36, 'if-gt'], [0x37, 'if-le'],
  [0x38, 'if-eqz'], [0x39, 'if-nez'], [0x3a, 'if-ltz'], [0x3b, 'if-gez'],
  [0x3c, 'if-gtz'], [0x3d, 'if-lez'],
  [0x44, 'aget'], [0x45, 'aget-wide'], [0x46, 'aget-object'],
  [0x47, 'aget-boolean'], [0x48, 'aget-byte'], [0x49, 'aget-char'], [0x4a, 'aget-short'],
  [0x4b, 'aput'], [0x4c, 'aput-wide'], [0x4d, 'aput-object'],
  [0x4e, 'aput-boolean'], [0x4f, 'aput-byte'], [0x50, 'aput-char'], [0x51, 'aput-short'],
  [0x52, 'iget'], [0x53, 'iget-wide'], [0x54, 'iget-object'],
  [0x55, 'iget-boolean'], [0x56, 'iget-byte'], [0x57, 'iget-char'], [0x58, 'iget-short'],
  [0x59, 'iput'], [0x5a, 'iput-wide'], [0x5b, 'iput-object'],
  [0x5c, 'iput-boolean'], [0x5d, 'iput-byte'], [0x5e, 'iput-char'], [0x5f, 'iput-short'],
  [0x60, 'sget'], [0x61, 'sget-wide'], [0x62, 'sget-object'],
  [0x63, 'sget-boolean'], [0x64, 'sget-byte'], [0x65, 'sget-char'], [0x66, 'sget-short'],
  [0x67, 'sput'], [0x68, 'sput-wide'], [0x69, 'sput-object'],
  [0x6a, 'sput-boolean'], [0x6b, 'sput-byte'], [0x6c, 'sput-char'], [0x6d, 'sput-short'],
  [0x6e, 'invoke-virtual'], [0x6f, 'invoke-super'], [0x70, 'invoke-direct'],
  [0x71, 'invoke-static'], [0x72, 'invoke-interface'],
  [0x90, 'add-int'], [0x91, 'sub-int'], [0x92, 'mul-int'], [0x93, 'div-int'],
  [0x94, 'rem-int'], [0x95, 'and-int'], [0x96, 'or-int'], [0x97, 'xor-int'],
  [0x98, 'shl-int'], [0x99, 'shr-int'], [0x9a, 'ushr-int'],
  [0xb0, 'add-int/2addr'], [0xb1, 'sub-int/2addr'], [0xb2, 'mul-int/2addr'],
  [0xb3, 'div-int/2addr'], [0xb4, 'rem-int/2addr'],
]);

function printUsage(): void {
  console.log(`
[CRAFT][CoverageMap] Opcode & API Coverage Reporter

Usage: npm run coverage-map [apk-file] [options]

Options:
  --opcodes-only    Show only opcode coverage
  --shims-only      Show only shim coverage
  --json            Output as JSON
  --help            Show this help

Examples:
  npm run coverage-map
  npm run coverage-map test/fixtures/hello_world.apk
  npm run coverage-map -- --opcodes-only --json
`);
}

/** Scan opcodes.ts to find registered opcodes */
function scanImplementedOpcodes(): OpcodeEntry[] {
  const opcodesPath = path.join(__dirname, '..', 'src', 'interpreter', 'opcodes.ts');
  const source = fs.readFileSync(opcodesPath, 'utf-8');

  const entries: OpcodeEntry[] = [];
  const pattern = /table\.register\(0x([0-9a-fA-F]+),\s*\{[\s\S]*?name:\s*'([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    entries.push({
      opcode: parseInt(match[1], 16),
      name: match[2],
    });
  }

  return entries.sort((a, b) => a.opcode - b.opcode);
}

/** Scan shim directories for registered methods */
function scanImplementedShims(): ShimEntry[] {
  const shimDirs = [
    path.join(__dirname, '..', 'src', 'shim', 'java', 'lang'),
    path.join(__dirname, '..', 'src', 'shim', 'android'),
  ];

  const classMap = new Map<string, { name: string; descriptor: string }[]>();

  for (const dir of shimDirs) {
    scanShimDir(dir, classMap);
  }

  return Array.from(classMap.entries())
    .map(([className, methods]) => ({ className, methods }))
    .sort((a, b) => a.className.localeCompare(b.className));
}

function scanShimDir(
  dir: string,
  classMap: Map<string, { name: string; descriptor: string }[]>
): void {
  if (!fs.existsSync(dir)) return;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanShimDir(fullPath, classMap);
    } else if (entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
      scanShimFile(fullPath, classMap);
    }
  }
}

function scanShimFile(
  filePath: string,
  classMap: Map<string, { name: string; descriptor: string }[]>
): void {
  const source = fs.readFileSync(filePath, 'utf-8');
  const pattern = /registry\.register\(\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const className = match[1];
    const methodName = match[2];
    const descriptor = match[3];

    if (!classMap.has(className)) {
      classMap.set(className, []);
    }
    classMap.get(className)!.push({ name: methodName, descriptor });
  }
}

/** Analyze APK for opcode usage */
function analyzeAPKOpcodes(
  apkPath: string,
  implemented: Set<number>
): {
  usedOpcodes: { opcode: number; name: string; count: number }[];
  missingOpcodes: { opcode: number; name: string; count: number }[];
  coveragePercent: number;
} {
  const data = new Uint8Array(fs.readFileSync(apkPath));
  const apkParser = new APKParser();
  const apk = apkParser.parse(data);

  const dexFiles = Array.from(apk.dexFiles.values());
  if (dexFiles.length === 0) {
    return { usedOpcodes: [], missingOpcodes: [], coveragePercent: 100 };
  }

  const dex = new DexParser(dexFiles[0]);
  const opcodeCounts = new Map<number, number>();

  // Scan all methods for opcode usage
  const header = dex.parseHeader();
  for (let i = 0; i < header.classDefsSize; i++) {
    try {
      const classDef = dex.getClassDefByIndex(i);
      if (classDef.classDataOff === 0) continue;
      const classData = dex.getClassData(classDef);

      for (const method of [...classData.directMethods, ...classData.virtualMethods]) {
        if (method.codeOff === 0) continue;
        const code = dex.getMethodCode(method.codeOff);
        if (!code) continue;
        const insns = code.insns;
        for (let pc = 0; pc < insns.length; ) {
          const opcode = insns[pc] & 0xff;
          opcodeCounts.set(opcode, (opcodeCounts.get(opcode) || 0) + 1);

          const width = estimateOpcodeWidth(opcode);
          pc += width;
        }
      }
    } catch {
      // Skip classes that fail to parse
    }
  }

  const usedOpcodes: { opcode: number; name: string; count: number }[] = [];
  const missingOpcodes: { opcode: number; name: string; count: number }[] = [];

  for (const [opcode, count] of opcodeCounts.entries()) {
    const name = DALVIK_OPCODES.get(opcode) || `unknown(0x${opcode.toString(16)})`;
    const entry = { opcode, name, count };

    if (implemented.has(opcode)) {
      usedOpcodes.push(entry);
    } else {
      missingOpcodes.push(entry);
    }
  }

  usedOpcodes.sort((a, b) => b.count - a.count);
  missingOpcodes.sort((a, b) => b.count - a.count);

  const totalUsed = usedOpcodes.length + missingOpcodes.length;
  const coveragePercent = totalUsed > 0
    ? Math.round((usedOpcodes.length / totalUsed) * 1000) / 10
    : 100;

  return { usedOpcodes, missingOpcodes, coveragePercent };
}

function estimateOpcodeWidth(opcode: number): number {
  if (opcode === 0x00 || opcode === 0x0e) return 1; // nop, return-void
  if (opcode <= 0x0d) return 1; // move variants
  if (opcode <= 0x11) return 1; // return variants
  if (opcode === 0x12) return 1; // const/4
  if (opcode === 0x13) return 2; // const/16
  if (opcode === 0x14) return 3; // const
  if (opcode === 0x15) return 2; // const/high16
  if (opcode >= 0x16 && opcode <= 0x19) return opcode === 0x18 ? 5 : 2; // const-wide
  if (opcode === 0x1a) return 2; // const-string
  if (opcode === 0x1b) return 3; // const-string/jumbo
  if (opcode === 0x1c) return 2; // const-class
  if (opcode >= 0x1d && opcode <= 0x20) return 2; // monitor/check-cast/instance-of
  if (opcode === 0x21) return 1; // array-length
  if (opcode === 0x22) return 2; // new-instance
  if (opcode === 0x23) return 2; // new-array
  if (opcode >= 0x24 && opcode <= 0x25) return 3; // filled-new-array
  if (opcode === 0x26) return 3; // fill-array-data
  if (opcode === 0x27) return 1; // throw
  if (opcode === 0x28) return 1; // goto
  if (opcode === 0x29) return 2; // goto/16
  if (opcode === 0x2a) return 3; // goto/32
  if (opcode >= 0x2b && opcode <= 0x2c) return 3; // switch
  if (opcode >= 0x2d && opcode <= 0x31) return 2; // cmp
  if (opcode >= 0x32 && opcode <= 0x37) return 2; // if-XX
  if (opcode >= 0x38 && opcode <= 0x3d) return 2; // if-XXz
  if (opcode >= 0x44 && opcode <= 0x51) return 2; // aget/aput
  if (opcode >= 0x52 && opcode <= 0x6d) return 2; // iget/iput/sget/sput
  if (opcode >= 0x6e && opcode <= 0x72) return 3; // invoke
  if (opcode >= 0x74 && opcode <= 0x78) return 3; // invoke/range
  if (opcode >= 0x90 && opcode <= 0xaf) return 2; // binop
  if (opcode >= 0xb0 && opcode <= 0xcf) return 1; // binop/2addr
  if (opcode >= 0xd0 && opcode <= 0xe2) return 2; // binop/lit
  return 1; // default
}

function formatReport(report: CoverageReport, showOpcodes: boolean, showShims: boolean): void {
  console.log('=== CRAFT Coverage Map ===\n');

  if (showOpcodes) {
    console.log(`Opcodes: ${report.opcodes.count} implemented`);
    console.log('-'.repeat(50));
    for (const entry of report.opcodes.implemented) {
      const hex = `0x${entry.opcode.toString(16).padStart(2, '0')}`;
      console.log(`  ${hex}  ${entry.name}`);
    }
    console.log('');
  }

  if (showShims) {
    console.log(`Shim Classes: ${report.shims.classes.length} classes, ${report.shims.totalMethods} methods`);
    console.log('-'.repeat(50));
    for (const cls of report.shims.classes) {
      console.log(`  ${cls.className} (${cls.methods.length} methods)`);
      for (const m of cls.methods) {
        console.log(`    ${m.name}${m.descriptor}`);
      }
    }
    console.log('');
  }

  if (report.apk) {
    console.log(`APK Opcode Coverage: ${report.apk.coveragePercent}%`);
    console.log('-'.repeat(50));
    if (report.apk.missingOpcodes.length > 0) {
      console.log('  Missing opcodes:');
      for (const m of report.apk.missingOpcodes) {
        const hex = `0x${m.opcode.toString(16).padStart(2, '0')}`;
        console.log(`    ${hex} ${m.name} (${m.count} uses)`);
      }
    } else {
      console.log('  All used opcodes are implemented!');
    }
    console.log('');
  }
}

function main(): void {
  const args = process.argv.slice(2);

  if (args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  let apkFile = '';
  let opcodesOnly = false;
  let shimsOnly = false;
  let jsonOutput = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--opcodes-only':
        opcodesOnly = true;
        break;
      case '--shims-only':
        shimsOnly = true;
        break;
      case '--json':
        jsonOutput = true;
        break;
      default:
        if (!args[i].startsWith('-') && !apkFile) {
          apkFile = args[i];
        }
        break;
    }
  }

  const showOpcodes = !shimsOnly;
  const showShims = !opcodesOnly;

  console.log('[CRAFT][CoverageMap][Info] Scanning source code...\n');

  const opcodes = scanImplementedOpcodes();
  const shims = scanImplementedShims();
  const totalMethods = shims.reduce((sum, s) => sum + s.methods.length, 0);

  const report: CoverageReport = {
    opcodes: { implemented: opcodes, count: opcodes.length },
    shims: { classes: shims, totalMethods },
  };

  if (apkFile) {
    const apkPath = path.resolve(apkFile);
    if (!fs.existsSync(apkPath)) {
      console.error(`[CRAFT][CoverageMap][Error] File not found: ${apkPath}`);
      process.exit(1);
    }

    console.log(`[CRAFT][CoverageMap][Info] Analyzing APK: ${apkPath}\n`);
    const implementedSet = new Set(opcodes.map((o) => o.opcode));

    try {
      report.apk = analyzeAPKOpcodes(apkPath, implementedSet);
    } catch (err: any) {
      console.error(`[CRAFT][CoverageMap][Error] APK analysis failed: ${err.message}`);
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    formatReport(report, showOpcodes, showShims);
  }
}

main();
