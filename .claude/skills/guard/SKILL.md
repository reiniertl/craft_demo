---
name: guard
description: Run the CRAFT regression guard after code changes to verify no regressions were introduced. Use when source files in src/, test/, or tools/ have been modified.
user-invocable: true
allowed-tools: Bash(npm run guard:*), Bash(npm test:*), Bash(npx tsc:*), Read, Grep, Edit
---

# Regression Guard

Run the full CRAFT regression guard and analyze results.

## Steps

1. Run `npm run guard` and capture the full output
2. Parse the results for each check:
   - TypeScript type checking (0 errors expected)
   - Jest test suite (562+ passing expected, 3 known stale fixture failures in `test/integration/apk_parsing.test.ts` are acceptable)
   - Shim consistency (0 issues expected)
   - Opcode count (218 expected)
3. If any **new** failures are found (beyond the 3 known stale fixture expectations):
   - Read the failing test files to understand what they test
   - Read the source files involved
   - Identify the root cause
   - Fix the issue
   - Re-run `npm run guard` to confirm the fix
4. Report a summary of results

## Known Acceptable Failures

These 3 test failures in `test/integration/apk_parsing.test.ts` are stale fixture expectations from the Button/click-handler additions and are NOT regressions:
- "parses DEX with correct class count" (methodIdsSize expected 9, got 23)
- "finds MainActivity class in DEX" (directMethods.length expected 1, got 3)
- "retrieves method bytecode" (insnsSize expected 27, got 81)
