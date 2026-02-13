#!/usr/bin/env ts-node
/**
 * CRAFT Opcode Generator - Skill #3
 * Generate opcode handler implementations with boilerplate code
 */

import * as fs from 'fs';
import * as path from 'path';

interface OpcodeSpec {
  opcode: number;
  name: string;
  format: string;
  description: string;
  category: 'move' | 'const' | 'invoke' | 'return' | 'field' | 'array' | 'compare' | 'control' | 'math';
}

// Common opcode formats and their structures
const FORMATS: Record<string, string> = {
  '10x': '1 unit: [opcode]',
  '11x': '1 unit: [opcode][vAA]',
  '11n': '1 unit: [opcode][vA][nB (4-bit)]',
  '12x': '1 unit: [opcode][vA][vB]',
  '21s': '2 units: [opcode][vAA][sBBBB]',
  '21c': '2 units: [opcode][vAA][index@BBBB]',
  '22c': '2 units: [opcode][vA][vB][index@CCCC]',
  '35c': '3 units: [opcode][count][methodIdx][regs]',
  '3rc': '3 units: [opcode][count][methodIdx][vCCCC..vNNNN]'
};

function printUsage() {
  console.log(`
CRAFT Opcode Generator

Usage: npx ts-node tools/gen_opcode.ts <opcode-hex> <name> <format> [options]

Arguments:
  <opcode-hex>          Opcode value in hex (e.g., 0x6e)
  <name>                Opcode name (e.g., invoke-virtual)
  <format>              Dalvik format (e.g., 35c)

Options:
  --category <cat>      Opcode category: move, const, invoke, return, field, array, compare, control, math
  --description <desc>  Description of what the opcode does
  --help               Show this help message

Examples:
  npx ts-node tools/gen_opcode.ts 0x6e invoke-virtual 35c --category invoke
  npx ts-node tools/gen_opcode.ts 0x52 iget 22c --category field
  npx ts-node tools/gen_opcode.ts 0x2d cmpl-float 23x --category compare

Available formats:
${Object.entries(FORMATS).map(([fmt, desc]) => `  ${fmt.padEnd(6)} - ${desc}`).join('\n')}
`);
}

function generateOpcodeHandler(spec: OpcodeSpec): string {
  const formatInfo = FORMATS[spec.format] || 'Unknown format';

  return `
  /**
   * ${spec.opcode.toString(16).padStart(2, '0')}: ${spec.name}
   * Format: ${spec.format} - ${formatInfo}
   * ${spec.description || 'TODO: Add description'}
   */
  [${spec.opcode}]: (frame: ExecutionFrame, insn: number): void => {
    ${generateFormatParser(spec.format)}

    log('opcode', 'debug', \`${spec.name}: ${getLogFormat(spec.format)}\`);

    ${generateHandlerBody(spec)}

    frame.pc += ${getInstructionSize(spec.format)};
  },`;
}

function generateFormatParser(format: string): string {
  switch (format) {
    case '10x':
      return '// No operands';
    case '11x':
      return 'const vAA = (insn >> 8) & 0xFF;';
    case '11n':
      return 'const vA = (insn >> 8) & 0xF;\n    const nB = ((insn >> 12) & 0xF) << 28 >> 28; // sign-extend 4-bit';
    case '12x':
      return 'const vA = (insn >> 8) & 0xF;\n    const vB = (insn >> 12) & 0xF;';
    case '21s':
      return 'const vAA = (insn >> 8) & 0xFF;\n    const sBBBB = (frame.method.code!.insns[frame.pc + 1] << 16) >> 16; // sign-extend';
    case '21c':
      return 'const vAA = (insn >> 8) & 0xFF;\n    const index = frame.method.code!.insns[frame.pc + 1];';
    case '22c':
      return 'const vA = (insn >> 8) & 0xF;\n    const vB = (insn >> 12) & 0xF;\n    const index = frame.method.code!.insns[frame.pc + 1];';
    case '35c':
      return `const argCount = (insn >> 12) & 0xF;
    const methodIdx = frame.method.code!.insns[frame.pc + 1];
    const regs = frame.method.code!.insns[frame.pc + 2];
    const vC = regs & 0xF;
    const vD = (regs >> 4) & 0xF;
    const vE = (regs >> 8) & 0xF;
    const vF = (regs >> 12) & 0xF;
    const vG = (insn >> 8) & 0xF;`;
    case '3rc':
      return `const argCount = (insn >> 8) & 0xFF;
    const methodIdx = frame.method.code!.insns[frame.pc + 1];
    const vCCCC = frame.method.code!.insns[frame.pc + 2];`;
    default:
      return '// TODO: Parse format operands';
  }
}

function getLogFormat(format: string): string {
  switch (format) {
    case '11x': return 'v${vAA}';
    case '12x': return 'v${vA}, v${vB}';
    case '21s': return 'v${vAA}, #${sBBBB}';
    case '21c': return 'v${vAA}, index@${index}';
    case '22c': return 'v${vA}, v${vB}, index@${index}';
    case '35c': return 'args=${argCount}, method@${methodIdx}';
    default: return 'TODO';
  }
}

function getInstructionSize(format: string): number {
  if (format.startsWith('1')) return 1;
  if (format.startsWith('2')) return 2;
  if (format.startsWith('3')) return 3;
  if (format.startsWith('4')) return 4;
  if (format.startsWith('5')) return 5;
  return 1;
}

function generateHandlerBody(spec: OpcodeSpec): string {
  switch (spec.category) {
    case 'move':
      return '// TODO: Implement move operation\n    // frame.registers[vA] = frame.registers[vB];';
    case 'const':
      return '// TODO: Implement const operation\n    // frame.registers[vAA] = { type: \'int\', value: sBBBB };';
    case 'invoke':
      return `// TODO: Implement invoke operation
    // 1. Resolve method using methodIdx
    // 2. Collect arguments from registers
    // 3. Check if shim method exists
    // 4. Either call shim or create new frame for DEX method`;
    case 'return':
      return '// TODO: Implement return operation\n    // Pop frame and pass return value to caller';
    case 'field':
      return '// TODO: Implement field operation\n    // Access or modify object field using heap';
    case 'array':
      return '// TODO: Implement array operation\n    // Access or modify array element';
    case 'compare':
      return '// TODO: Implement comparison operation\n    // Compare values and set result register';
    case 'control':
      return '// TODO: Implement control flow operation\n    // Update PC based on condition';
    case 'math':
      return '// TODO: Implement mathematical operation\n    // Perform calculation and store result';
    default:
      return '// TODO: Implement opcode logic';
  }
}

function generateTestCode(spec: OpcodeSpec): string {
  return `
  test('${spec.name} (${spec.opcode.toString(16)}) executes correctly', () => {
    // TODO: Add test for ${spec.name}
    // 1. Create test DEX with ${spec.name} instruction
    // 2. Set up interpreter with necessary state
    // 3. Execute instruction
    // 4. Verify expected behavior
  });`;
}

function generateDocumentation(spec: OpcodeSpec): string {
  return `
## ${spec.name} (0x${spec.opcode.toString(16).padStart(2, '0')})

**Format:** ${spec.format} - ${FORMATS[spec.format] || 'Unknown'}

**Category:** ${spec.category}

**Description:** ${spec.description || 'TODO: Add description'}

**Implementation Notes:**
- TODO: Add implementation details
- TODO: Add edge cases to consider
- TODO: Add performance considerations

**Example Usage:**
\`\`\`
// TODO: Add bytecode example
\`\`\`

**Tests:**
- [ ] Basic operation test
- [ ] Edge case tests
- [ ] Integration test with other opcodes
`;
}

function updateOpcodeTable(spec: OpcodeSpec): void {
  const opcodePath = path.join(__dirname, '..', 'src', 'interpreter', 'opcode_table.ts');
  let content = fs.readFileSync(opcodePath, 'utf-8');

  const handler = generateOpcodeHandler(spec);

  // Find the right place to insert (keep opcodes sorted)
  const insertMarker = '// === INSERT NEW OPCODES BELOW THIS LINE ===';
  if (content.includes(insertMarker)) {
    content = content.replace(insertMarker, handler + '\n  ' + insertMarker);
  } else {
    // Fallback: insert before the closing of the Map
    content = content.replace(/\];/, handler + '\n];');
  }

  fs.writeFileSync(opcodePath, content);
  console.log(`[CRAFT][GenOpcode][Success] Added handler to opcode_table.ts`);
}

function updateTests(spec: OpcodeSpec): void {
  const testPath = path.join(__dirname, '..', 'test', 'unit', 'interpreter', 'opcodes.test.ts');
  let content = fs.readFileSync(testPath, 'utf-8');

  const test = generateTestCode(spec);

  // Insert test in the appropriate describe block
  const insertMarker = '// === INSERT NEW TESTS BELOW THIS LINE ===';
  if (content.includes(insertMarker)) {
    content = content.replace(insertMarker, test + '\n  ' + insertMarker);
  }

  fs.writeFileSync(testPath, content);
  console.log(`[CRAFT][GenOpcode][Success] Added test to opcodes.test.ts`);
}

function createDocumentation(spec: OpcodeSpec): void {
  const docsDir = path.join(__dirname, '..', 'docs', 'opcodes');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const docPath = path.join(docsDir, `${spec.name.replace('/', '_')}.md`);
  const doc = generateDocumentation(spec);

  fs.writeFileSync(docPath, doc);
  console.log(`[CRAFT][GenOpcode][Success] Created documentation: ${docPath}`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length < 3 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  const opcodeHex = args[0];
  const name = args[1];
  const format = args[2];

  const spec: OpcodeSpec = {
    opcode: parseInt(opcodeHex, 16),
    name,
    format,
    description: '',
    category: 'move'
  };

  for (let i = 3; i < args.length; i++) {
    switch (args[i]) {
      case '--category':
        spec.category = args[++i] as any;
        break;
      case '--description':
        spec.description = args[++i];
        break;
    }
  }

  console.log(`[CRAFT][GenOpcode][Info] Generating opcode handler for ${name} (0x${spec.opcode.toString(16)})`);
  console.log(`[CRAFT][GenOpcode][Info] Format: ${format}`);
  console.log(`[CRAFT][GenOpcode][Info] Category: ${spec.category}`);

  try {
    updateOpcodeTable(spec);
    // updateTests(spec); // Commented out until we add the marker
    createDocumentation(spec);

    console.log('\n[CRAFT][GenOpcode][Success] Opcode generation complete! ✅');
    console.log('\n[CRAFT][GenOpcode][Info] Next steps:');
    console.log('  1. Implement the opcode logic in src/interpreter/opcode_table.ts');
    console.log('  2. Add comprehensive tests in test/unit/interpreter/opcodes.test.ts');
    console.log(`  3. Review documentation in docs/opcodes/${spec.name.replace('/', '_')}.md`);
  } catch (error) {
    console.error('[CRAFT][GenOpcode][Error] Failed to generate opcode:', error);
    process.exit(1);
  }
}

main();
