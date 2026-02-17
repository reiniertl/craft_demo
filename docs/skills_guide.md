# CRAFT Development Skills Guide

**Last Updated:** 2026-02-13
**Status:** 5 core skills implemented and tested

## Overview

CRAFT provides 5 core development skills (automated tools) that accelerate implementation work. These skills automate repetitive tasks like code generation, testing, and analysis.

## Skill Categories

### 🧪 Testing & Validation
- **craft-test** - Component-filtered test runner

### 🏗️ Code Generation
- **gen-shim** - Android API shim generator
- **gen-opcode** - Opcode handler generator

### 🔍 Analysis & Debugging
- **dex-dump** - DEX file dumper
- **analyze-apk** - APK requirements analyzer

---

## Skill #1: craft-test

**Purpose:** Run CRAFT-specific tests with component filtering and detailed output.

**When to use:**
- During development to run focused test suites
- In watch mode for TDD workflow
- To verify specific components after changes

**Common commands:**
```bash
# Run all parser tests
npm run craft-test -- --component parser

# Watch interpreter tests
npm run craft-test -- --component interpreter --watch

# Run tests matching pattern
npm run craft-test -- --pattern "dex.*parser"

# Verbose output
npm run craft-test -- --verbose
```

**Integration with stages:**
- Stage 1: `--component parser`
- Stage 2: `--component interpreter`
- Stage 3: `--component shim`
- Stage 4: `--component bridge`

---

## Skill #2: gen-shim

**Purpose:** Generate Android API shim implementations with boilerplate code.

**When to use:**
- Adding support for new Android classes
- Implementing missing API methods identified by analyze-apk
- Extending Android framework coverage

**Common workflows:**

### Basic shim generation
```bash
npm run gen-shim android.graphics.Paint
```

### With inheritance and methods
```bash
npm run gen-shim android.widget.Button -- \
  --extends android.widget.TextView \
  --method "setOnClickListener:(Landroid/view/View$OnClickListener;)V:void" \
  --field "mOnClickListener:number"
```

### Complex example
```bash
npm run gen-shim android.app.Dialog -- \
  --extends android.content.Context \
  --method "show:()V:void" \
  --method "dismiss:()V:void" \
  --method "setTitle:(Ljava/lang/CharSequence;)V:void" \
  --field "mShowing:boolean"
```

**Generated files:**
- `src/shim/android/{package}/{class}.ts` - Implementation
- `test/unit/shim/android/{package}/{class}.ts` - Tests
- Console output with integration instructions

**Next steps after generation:**
1. Implement the TODO sections in generated shim
2. Add registration call to appropriate `index.ts`
3. Run tests: `npm run craft-test -- --component shim`
4. Update documentation if needed

---

## Skill #3: gen-opcode

**Purpose:** Generate Dalvik opcode handler implementations with format parsing.

**When to use:**
- Implementing missing opcodes identified by analyze-apk
- Adding new opcode support during Stage 2 expansion
- Creating reference documentation for opcodes

**Common workflows:**

### Generate invoke opcode
```bash
npm run gen-opcode 0x6e invoke-virtual 35c -- --category invoke
```

### Generate field access opcode
```bash
npm run gen-opcode 0x52 iget 22c -- \
  --category field \
  --description "Get instance field value"
```

### Generate control flow opcode
```bash
npm run gen-opcode 0x32 if-eq 22t -- \
  --category control \
  --description "Branch if equal"
```

**Generated outputs:**
- Handler code added to `src/interpreter/opcode_table.ts`
- Documentation created in `docs/opcodes/{opcode-name}.md`
- Test skeleton (when markers present)

**Next steps after generation:**
1. Implement the TODO handler logic in `opcode_table.ts`
2. Add comprehensive tests in `test/unit/interpreter/opcodes.test.ts`
3. Review and enhance documentation
4. Test with real bytecode sequences

---

## Skill #4: dex-dump

**Purpose:** Dump and analyze DEX file contents for debugging.

**When to use:**
- Debugging DEX parsing issues
- Understanding bytecode structure
- Verifying DEX generation in test fixtures
- Investigating opcode sequences

**Common workflows:**

### Dump entire DEX
```bash
npm run dex-dump test/fixtures/hello_world.dex
```

### Specific sections
```bash
# Header only
npm run dex-dump test/fixtures/hello_world.dex -- --header

# String table
npm run dex-dump test/fixtures/hello_world.dex -- --strings

# Method bytecode
npm run dex-dump test/fixtures/hello_world.dex -- --methods
```

### Redirect to file
```bash
npm run dex-dump test/fixtures/hello_world.dex -- --all > analysis.txt
```

### Find specific method
```bash
npm run dex-dump test/fixtures/hello_world.dex -- --methods | grep -A 30 "onCreate"
```

**Output sections:**
- **Header** - Magic, checksums, section offsets
- **Strings** - String table with indices
- **Types** - Type descriptors
- **Classes** - Class definitions with access flags
- **Methods** - Method signatures and bytecode

---

## Skill #5: analyze-apk

**Purpose:** Analyze APK requirements including opcodes, APIs, and complexity.

**When to use:**
- Before starting work on a new APK
- To estimate implementation effort
- To prioritize missing opcodes/APIs
- To generate implementation roadmaps

**Common workflows:**

### Basic analysis
```bash
npm run analyze-apk test/fixtures/hello_world.apk
```

**Example output:**
```
╔══════════════════════════════════════════════════════════════╗
║               CRAFT APK Analysis Report                     ║
╚══════════════════════════════════════════════════════════════╝

📦 APK Information:
   Path: test/fixtures/hello_world.apk
   Package: unknown
   Main Activity: unknown

📊 Complexity Metrics:
   Total Methods: 2
   Total Instructions: 7
   Unique Opcodes: 5
   Missing Opcodes: 1

🔧 Opcode Coverage:
   Implemented: 4/5 (80.0%)

💡 Recommendations:
   ⚠️  Missing 1 opcodes - prioritize by usage
   🎯 Recommended implementation order
```

### Detailed analysis
```bash
npm run analyze-apk myapp.apk -- --verbose
```

Shows:
- All opcodes with usage counts
- Android API classes and methods
- Detailed breakdown by category

### Save report
```bash
npm run analyze-apk myapp.apk -- --report analysis.json
```

Creates JSON report for:
- Integration with CI/CD
- Trend analysis over time
- Programmatic processing

**Use cases:**

1. **Pre-implementation planning**
   ```bash
   npm run analyze-apk new_app.apk -- --verbose --report plan.json
   # Review missing opcodes
   # Generate shims for missing APIs
   # Estimate effort
   ```

2. **Progress tracking**
   ```bash
   # Run periodically to track opcode coverage
   npm run analyze-apk test_suite/*.apk -- --report progress_$(date +%Y%m%d).json
   ```

3. **Prioritization**
   ```bash
   # Identify most-used missing opcodes
   npm run analyze-apk large_app.apk -- --verbose | grep "Missing.*opcodes" -A 20
   ```

---

## Workflow Examples

### Adding Support for a New APK

```bash
# 1. Analyze requirements
npm run analyze-apk new_app.apk -- --verbose --report analysis.json

# 2. Review recommendations
cat analysis.json | jq '.recommendations'

# 3. Implement missing opcodes (example)
npm run gen-opcode 0x32 if-eq 22t -- --category control
npm run gen-opcode 0x38 if-eqz 21t -- --category control

# 4. Implement missing Android APIs (example)
npm run gen-shim android.widget.Button -- --extends android.widget.TextView
npm run gen-shim android.view.LayoutInflater

# 5. Run component tests
npm run craft-test -- --component interpreter
npm run craft-test -- --component shim

# 6. Re-analyze to verify progress
npm run analyze-apk new_app.apk
```

### TDD Workflow for New Feature

```bash
# 1. Generate shim with tests
npm run gen-shim android.graphics.Canvas

# 2. Start watch mode
npm run craft-test -- --component shim --watch

# 3. Implement methods one by one
# 4. Tests run automatically on save
# 5. Fix until all tests pass
```

### Debugging Bytecode Issues

```bash
# 1. Dump method bytecode
npm run dex-dump problematic.dex -- --methods > bytecode.txt

# 2. Find problematic method
grep -A 50 "problematicMethod" bytecode.txt

# 3. Identify unknown/unimplemented opcodes
# 4. Generate handlers for missing opcodes
npm run gen-opcode 0xXX opcode-name format -- --category type

# 5. Test fix
npm run craft-test -- --pattern "opcode.*name"
```

---

## Integration with Development Stages

### Stage 1 (Parser) - Complete ✅
Skills used:
- `dex-dump` - Verify parsed structures
- `craft-test --component parser` - Validate parsing

### Stage 2 (Interpreter) - Complete ✅
Skills used:
- `gen-opcode` - Generated 26 opcode handlers
- `craft-test --component interpreter` - Test execution
- `dex-dump --methods` - Debug bytecode sequences

### Stage 3 (Shims) - Complete ✅
Skills used:
- `gen-shim` - Generated Android API shims
- `craft-test --component shim` - Validate shim behavior
- `analyze-apk` - Identify required APIs

### Stage 4 (UI Bridge) - Complete ✅
Skills used:
- `gen-shim` - Generate bridge components
- `analyze-apk` - Analyze UI requirements
- `craft-test --component bridge` - Test rendering

### Stage 5 (Integration & Polish) - Code Complete ✅
Skills used:
- `analyze-apk` - Verify APK compatibility
- `craft-test` - Full regression testing
- `dex-dump` - Debug bytecode issues

---

## Tips & Best Practices

### 1. Always analyze before implementing
```bash
npm run analyze-apk app.apk -- --verbose
```
Understand requirements before writing code.

### 2. Use watch mode during development
```bash
npm run craft-test -- --component shim --watch
```
Get immediate feedback on changes.

### 3. Generate code, don't copy-paste
```bash
npm run gen-shim android.new.Class
```
Ensures consistency and includes tests.

### 4. Review generated code
Generated code includes TODOs - always implement the logic.

### 5. Run tests before committing
```bash
npm run craft-test
npx tsc --noEmit
```

### 6. Document complex implementations
Generated docs are starting points - enhance them.

### 7. Use analyze-apk for planning
Identify priorities and estimate effort upfront.

---

## Extending Skills

To add new skills:

1. Create TypeScript tool in `tools/` directory
2. Follow naming convention: `action_target.ts`
3. Add npm script to `package.json`
4. Document in `tools/README.md`
5. Update this guide

Example template in `tools/README.md`.

---

## Troubleshooting

### Skill not found
```bash
# Verify npm script exists
npm run

# Try direct invocation
npx ts-node tools/skill_name.ts
```

### TypeScript errors
```bash
# Check compilation
npx tsc --noEmit

# Verify dependencies
npm install
```

### Generated code errors
- Review the actual API signatures in project code
- Update template code in skill implementation
- Report issues for skill improvement

---

## Future Skills (Potential)

Ideas for additional skills:

- **`test-gen`** - Generate test cases from DEX bytecode
- **`shim-validate`** - Validate shim completeness
- **`perf-profile`** - Profile interpreter performance
- **`apk-build`** - Build minimal test APKs
- **`doc-gen`** - Generate API documentation

---

## Resources

- **Skill implementations:** `/mnt/d/craft/craft/tools/`
- **Skill documentation:** `/mnt/d/craft/craft/tools/README.md`
- **Project context:** `/mnt/d/craft/craft/CLAUDE.md`
- **Architecture:** `/mnt/d/craft/craft/docs/architecture.md`

---

**Note:** Skills are designed to accelerate development, not replace understanding. Always review generated code and understand what it does before integrating into the project.
