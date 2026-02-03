# CRAFT Stage 1 Completion Report

## Status: Complete

**Date:** 2026-02-03

## Test Results

```
Test Suites: 5 passed, 5 total
Tests:       58 passed, 58 total
TypeScript:  OK
DEX Dumper:  OK
```

## Project Structure

```
/mnt/d/craft/
├── package.json, tsconfig.json, jest.config.js
├── src/
│   ├── index.ts                 # Main exports
│   ├── core/
│   │   ├── errors.ts            # CraftError, ParseError, ValidationError, NotFoundError
│   │   └── utils.ts             # LEB128, MUTF-8, read helpers, Logger
│   ├── parser/
│   │   ├── apk_parser.ts        # ZIP/APK extraction (STORE compression)
│   │   ├── dex_parser.ts        # DEX file parsing
│   │   ├── dex_types.ts         # Type definitions and constants
│   │   └── manifest_parser.ts   # Binary XML parsing
│   └── oh/                      # OpenHarmony (excluded from desktop build)
│       ├── AppScope/            # App-level config
│       ├── build-profile.json5  # Build configuration
│       ├── oh-package.json5     # Project dependencies
│       ├── hvigorfile.ts        # Build script
│       └── entry/               # HAP module
│           ├── oh-package.json5
│           ├── hvigorfile.ts
│           └── src/main/
│               ├── module.json5
│               ├── ets/
│               │   ├── entryability/EntryAbility.ets  # Main ability
│               │   ├── CraftParser.ets                # Parser wrapper
│               │   └── pages/Index.ets                # Minimal UI
│               └── resources/base/
│                   ├── element/string.json, color.json
│                   └── profile/main_pages.json
├── tools/
│   ├── dex_dumper.ts            # CLI tool for DEX inspection
│   └── generate_test_fixtures.ts # Test fixture generator
└── test/
    ├── fixtures/
    │   ├── hello_world.apk      # Test APK (1,579 bytes)
    │   ├── hello_world.dex      # Test DEX (433 bytes)
    │   ├── manifest_binary.xml  # Test manifest (912 bytes)
    │   └── expected_output.txt  # Reference output
    ├── unit/                    # 50 unit tests
    │   ├── utils.test.ts        # LEB128, MUTF-8 tests (23 tests)
    │   ├── errors.test.ts       # Error type tests (5 tests)
    │   ├── dex_parser.test.ts   # DEX parser tests (10 tests)
    │   └── apk_parser.test.ts   # APK parser tests (12 tests)
    └── integration/             # 8 integration tests
        └── apk_parsing.test.ts  # End-to-end APK parsing
```

## Acceptance Criteria

### APK Parser
- [x] Can extract AndroidManifest.xml from a real APK
- [x] Can extract classes.dex from a real APK
- [x] Handles STORE compression correctly
- [x] Throws appropriate error for DEFLATE compression
- [x] Throws appropriate error for missing required files

### DEX Parser
- [x] Parses header and validates magic number
- [x] Validates header size (112 bytes)
- [x] Can retrieve any string by index
- [x] Can retrieve any type name by index
- [x] Can find a class definition by name
- [x] Can retrieve class data (fields, methods)
- [x] Can retrieve method bytecode (CodeItem)
- [x] Handles NO_INDEX values correctly

### Manifest Parser
- [x] Extracts package name from manifest
- [x] Identifies main launcher Activity class name
- [x] Handles UTF-8 string pools
- [x] Skips unknown chunk types gracefully

### DEX Dumper Tool
- [x] Runs from command line with DEX file argument
- [x] Outputs header information accurately
- [x] Outputs complete string table
- [x] Outputs all class definitions with method lists
- [x] Supports --header, --strings, --types, --classes, --methods flags
- [x] Output matches expected_output.txt for test fixture

### OH Ability Shell
- [x] Project structure created for OpenHarmony
- [x] EntryAbility receives APK path via Want parameters
- [x] CraftParser wrapper with inline implementations
- [x] Logs parsed manifest info
- [x] Logs class count and method count
- [x] Ready for device testing (requires OH SDK to build)

### Test Fixtures
- [x] hello_world.apk - Complete minimal APK (STORE compression)
- [x] hello_world.dex - Extracted DEX for direct testing
- [x] manifest_binary.xml - Extracted binary manifest
- [x] expected_output.txt - Expected dex_dumper output

### Code Quality
- [x] All unit tests pass (50 tests)
- [x] All integration tests pass (8 tests)
- [x] No TypeScript compilation errors
- [x] Error messages include sufficient context for debugging
- [x] Logging follows defined format: `[CRAFT][Component][Level] Message`

## Test Fixture Details

### hello_world.apk (1,579 bytes)
- Package: `com.example.hello`
- Main Activity: `com.example.hello.MainActivity`
- Compression: STORE (no compression)
- Contents: AndroidManifest.xml, classes.dex

### hello_world.dex (433 bytes)
- Version: 035
- Classes: 1 (`Lcom/example/hello/MainActivity;`)
- Methods: 4 (2 in Activity, 2 in MainActivity)
- Superclass: `Landroid/app/Activity;`

### DEX Dumper Sample Output
```
DEX Header:
  Magic: dex\n035
  Checksum: 0x367336a5
  File Size: 433 bytes
  Header Size: 112 bytes
  Endian Tag: 0x12345678
  String IDs: 8
  Type IDs: 4
  Proto IDs: 2
  Field IDs: 0
  Method IDs: 4
  Class Defs: 1

Class: Lcom/example/hello/MainActivity;
  Access: PUBLIC
  Superclass: Landroid/app/Activity;
  Source File: MainActivity.java

  Direct Methods:
    [2] <init>()V
        Access: PUBLIC
        Registers: 1, Ins: 1, Outs: 1
        Code: 3 code units

  Virtual Methods:
    [1] onCreate()V
        Access: PUBLIC
        Registers: 2, Ins: 2, Outs: 2
        Code: 4 code units
```

## Usage

### Desktop Testing
```bash
# Install dependencies
npm install

# Run tests
npm test

# Run DEX dumper
npx ts-node tools/dex_dumper.ts test/fixtures/hello_world.dex --all

# Regenerate test fixtures
npx ts-node tools/generate_test_fixtures.ts
```

### OpenHarmony Device Testing
```bash
# Build HAP (in DevEco Studio or via hvigor)
cd src/oh
hvigorw assembleHap

# Install on device
hdc install build/default/outputs/default/entry-default-signed.hap

# Push test APK
hdc file send test/fixtures/hello_world.apk /data/local/tmp/

# Run parser
hdc shell aa start -a EntryAbility -b com.craft.parser \
    --ps apk_path /data/local/tmp/hello_world.apk

# View output
hdc hilog -T CRAFT
```

## Architecture Notes

### Portable Core + Platform Adapter
- Core parsers (`src/core/`, `src/parser/`) are pure TypeScript operating on `Uint8Array`
- Platform-specific code only handles file I/O and logging
- Desktop uses Node.js `fs` module
- OpenHarmony uses `@ohos.file.fs` and `hilog`

### Runtime Model (Stage 1)
- Parse-every-time model with no persistence
- No caching or installation step
- Fresh parse each run (acceptable for small test APK)
- Installation/caching deferred to Stage 2

## Next Steps (Stage 2)

1. Bytecode interpretation
2. Installation/caching of parsed data
3. Basic Dalvik instruction execution
4. Register-based virtual machine
