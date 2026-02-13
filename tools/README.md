# CRAFT Development Tools & Skills

This directory contains development tools (skills) for the CRAFT project. These tools accelerate development by automating common tasks like testing, code generation, and analysis.

## Available Skills

### 1. 🧪 `craft-test` - Test Runner

Run CRAFT-specific tests with filtering and detailed output.

**Usage:**
```bash
# Run all tests
npm run craft-test

# Run specific component tests
npm run craft-test -- --component parser
npm run craft-test -- --component interpreter
npm run craft-test -- --component shim
npm run craft-test -- --component bridge

# Run tests matching a pattern
npm run craft-test -- --pattern "dex.*parser"

# Watch mode
npm run craft-test -- --component interpreter --watch

# Verbose output
npm run craft-test -- --verbose
```

**Direct invocation:**
```bash
npx ts-node tools/craft_test.ts --component parser
```

---

### 2. 🏗️ `gen-shim` - Android API Shim Generator

Generate Android API shim implementations with boilerplate code, tests, and documentation.

**Usage:**
```bash
# Generate basic shim
npm run gen-shim android.graphics.Paint

# With methods and parent class
npm run gen-shim android.graphics.Paint -- \
  --extends android.view.View \
  --method "setColor:(I)V:void" \
  --method "getColor:()I:number" \
  --field "mColor:number"
```

**What it generates:**
- `src/shim/android/graphics/paint.ts` - Shim implementation
- `test/unit/shim/android/graphics/paint.ts` - Unit tests
- Instructions for updating `index.ts`

**Example:**
```bash
npm run gen-shim android.view.Button -- \
  --extends android.widget.TextView \
  --method "setOnClickListener:(Landroid/view/View$OnClickListener;)V:void"
```

---

### 3. ⚙️ `gen-opcode` - Opcode Handler Generator

Generate Dalvik opcode handler implementations with boilerplate code and documentation.

**Usage:**
```bash
# Generate opcode handler
npm run gen-opcode 0x6e invoke-virtual 35c -- --category invoke

# More examples
npm run gen-opcode 0x52 iget 22c -- --category field
npm run gen-opcode 0x2d cmpl-float 23x -- --category compare
```

**Arguments:**
- `<opcode-hex>` - Opcode value (e.g., 0x6e)
- `<name>` - Opcode name (e.g., invoke-virtual)
- `<format>` - Dalvik format (e.g., 35c)

**Options:**
- `--category` - Opcode category: move, const, invoke, return, field, array, compare, control, math
- `--description` - Description of what the opcode does

**What it generates:**
- Handler code in `src/interpreter/opcode_table.ts`
- Documentation in `docs/opcodes/<opcode-name>.md`
- Test skeleton (when markers are present)

**Available formats:**
- `10x` - 1 unit: [opcode]
- `11x` - 1 unit: [opcode][vAA]
- `11n` - 1 unit: [opcode][vA][nB (4-bit)]
- `12x` - 1 unit: [opcode][vA][vB]
- `21s` - 2 units: [opcode][vAA][sBBBB]
- `21c` - 2 units: [opcode][vAA][index@BBBB]
- `22c` - 2 units: [opcode][vA][vB][index@CCCC]
- `35c` - 3 units: [opcode][count][methodIdx][regs]
- `3rc` - 3 units: [opcode][count][methodIdx][vCCCC..vNNNN]

---

### 4. 🔍 `dex-dump` - DEX File Dumper

Dump and analyze DEX file contents for debugging.

**Usage:**
```bash
# Dump all sections
npm run dex-dump test/fixtures/hello_world.dex

# Dump specific sections
npm run dex-dump test/fixtures/hello_world.dex -- --header
npm run dex-dump test/fixtures/hello_world.dex -- --strings
npm run dex-dump test/fixtures/hello_world.dex -- --types
npm run dex-dump test/fixtures/hello_world.dex -- --classes
npm run dex-dump test/fixtures/hello_world.dex -- --methods
```

**Options:**
- `--header` - Print header info only
- `--strings` - Print string table
- `--types` - Print type table
- `--classes` - Print class definitions
- `--methods` - Print method definitions with bytecode
- `--all` - Print everything (default)

**Example output:**
```
DEX Header:
  Magic: dex\n035
  Checksum: 0x12345678
  File Size: 1234 bytes
  String IDs: 50
  Type IDs: 20
  Method IDs: 30
  Class Defs: 5
```

---

### 5. 📊 `analyze-apk` - APK Requirements Analyzer

Analyze APK requirements: opcodes, APIs, implementation complexity.

**Usage:**
```bash
# Basic analysis
npm run analyze-apk test/fixtures/hello_world.apk

# Verbose analysis with all details
npm run analyze-apk myapp.apk -- --verbose

# Save report to JSON file
npm run analyze-apk myapp.apk -- --report analysis.json
```

**What it analyzes:**
- **Opcode coverage** - Which opcodes are used and which are implemented
- **Android API usage** - Which Android APIs are called
- **Complexity metrics** - Method count, instruction count, unique opcodes
- **Recommendations** - Prioritized implementation order

**Example output:**
```
╔══════════════════════════════════════════════════════════════╗
║               CRAFT APK Analysis Report                     ║
╚══════════════════════════════════════════════════════════════╝

📦 APK Information:
   Path: test/fixtures/hello_world.apk
   Package: com.example.hello

📊 Complexity Metrics:
   Total Methods: 15
   Total Instructions: 234
   Unique Opcodes: 18
   Missing Opcodes: 3

🔧 Opcode Coverage:
   Implemented: 15/18 (83.3%)

💡 Recommendations:
   ⚠️  Missing 3 opcodes - prioritize by usage:
      - 0x32 (if-eq): used 12 times
      - 0x38 (if-eqz): used 8 times
```

---

## Quick Reference

### Common Workflows

**1. Testing during development:**
```bash
# Watch tests for specific component
npm run craft-test -- --component interpreter --watch
```

**2. Adding a new Android API:**
```bash
# Generate shim
npm run gen-shim android.widget.Button -- --extends android.widget.TextView

# Edit generated file: src/shim/android/widget/button.ts
# Add registration to: src/shim/android/index.ts

# Run tests
npm run craft-test -- --component shim
```

**3. Adding a new opcode:**
```bash
# Generate handler
npm run gen-opcode 0x32 if-eq 22t -- --category control

# Implement logic in: src/interpreter/opcode_table.ts
# Review docs: docs/opcodes/if-eq.md

# Test
npm run craft-test -- --pattern "opcode.*if-eq"
```

**4. Analyzing a new APK:**
```bash
# Analyze requirements
npm run analyze-apk new_app.apk -- --verbose --report analysis.json

# Review missing opcodes and APIs
cat analysis.json | jq '.recommendations'

# Implement missing components using gen-shim and gen-opcode
```

**5. Debugging DEX parsing:**
```bash
# Dump DEX structure
npm run dex-dump test/fixtures/hello_world.dex -- --all > dex_dump.txt

# Check specific method bytecode
npm run dex-dump test/fixtures/hello_world.dex -- --methods | grep -A 20 "onCreate"
```

---

## Development Tips

### Creating Custom Skills

To add a new skill:

1. Create TypeScript tool in `tools/` directory
2. Add npm script to `package.json`
3. Document in this README
4. Follow naming convention: `noun_verb.ts` (e.g., `class_generator.ts`)

### Skill Template

```typescript
#!/usr/bin/env ts-node
/**
 * CRAFT <Skill Name> - Skill #N
 * <Brief description>
 */

function printUsage() {
  console.log(`
<Skill Name>

Usage: npx ts-node tools/<skill>.ts <args> [options]
`);
}

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help')) {
    printUsage();
    process.exit(0);
  }

  // Implementation...
}

main();
```

---

## Troubleshooting

### "Command not found" errors
```bash
# Ensure dependencies are installed
npm install

# Use npx for direct invocation
npx ts-node tools/craft_test.ts
```

### TypeScript compilation errors
```bash
# Check TypeScript configuration
npx tsc --noEmit

# Verify paths in tsconfig.json
cat tsconfig.json
```

### Test failures
```bash
# Run with verbose output
npm run craft-test -- --verbose

# Check specific test file
npm test -- path/to/test.ts
```

---

## Additional Resources

- **Project Documentation:** `/mnt/d/craft/craft/docs/`
- **CLAUDE.md:** Project context and quick reference
- **Stage Plans:** `/mnt/d/craft/craft/docs/stages/`
- **Architecture:** `/mnt/d/craft/craft/docs/architecture.md`

---

## Contributing

When adding new tools:
1. Follow the existing structure and naming conventions
2. Include comprehensive `--help` output
3. Add error handling and validation
4. Document in this README
5. Add npm script to `package.json`
6. Test with various inputs

---

**Last Updated:** 2026-02-13
