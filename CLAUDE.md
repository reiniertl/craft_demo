# CRAFT Project Context

CRAFT (Compatible Runtime for Android on Fuchsia/Trusty) - An Android APK parser and runtime for OpenHarmony.

## Current Stage: 1 (Complete)

Stage 1 implements APK/DEX/Manifest parsing. Stage 2 will add bytecode interpretation.

## Quick Reference

```bash
# Run tests
npm test

# Run DEX dumper
npx ts-node tools/dex_dumper.ts test/fixtures/hello_world.dex --all

# TypeScript check
npx tsc --noEmit
```

## Project Structure

```
src/
├── core/           # Utilities: LEB128, MUTF-8, errors, logging
├── parser/         # APK, DEX, Manifest parsers (portable TypeScript)
└── oh/             # OpenHarmony ability (excluded from desktop build)

tools/
└── dex_dumper.ts   # CLI tool for DEX inspection

test/
├── fixtures/       # hello_world.apk, .dex, manifest_binary.xml
├── unit/           # 50 unit tests
└── integration/    # 8 integration tests
```

## Key Files

| File | Purpose |
|------|---------|
| `src/parser/apk_parser.ts` | ZIP extraction (STORE only) |
| `src/parser/dex_parser.ts` | DEX file parsing |
| `src/parser/manifest_parser.ts` | Binary XML parsing |
| `src/core/utils.ts` | LEB128, MUTF-8, read helpers |
| `src/core/errors.ts` | CraftError, ParseError, NotFoundError |

## Architecture

- **Portable core**: Parsers operate on `Uint8Array`, no OS dependencies
- **Platform adapters**: Only file I/O and logging are platform-specific
- **Runtime model**: Parse-every-time (no caching in Stage 1)

## Coding Conventions

- Log format: `[CRAFT][Component][Level] Message`
- Error messages include offset/context for debugging
- ArkTS compatibility: avoid `any`, dynamic properties, `eval()`

## Test Fixtures

- `hello_world.apk` - Package: `com.example.hello`, Main: `MainActivity`
- Built with STORE compression (no DEFLATE)
- Regenerate: `npx ts-node tools/generate_test_fixtures.ts`

## Documentation

- `docs/stage1_specification.md` - Detailed file format specs and interfaces
- `stage1_report.md` - Completion report with acceptance criteria
