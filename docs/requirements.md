## Android to Open Harmony compatibility framework
The main goal of this project is to create a compatibility layer between Android and Open Harmony. The compatibility layer (or translation layer) will allow Open Harmony to load, run, and service Andriod APKs using its native services and interfaces.

## Proof of Concept Stage
**Status: Stages 1-5 Code Complete (Awaiting APK recompilation & device testing)**

We are implementing a PoC in which we want to load an Android App that shows the "Hello World" text on a window. Current progress:
- ✅ Stage 1: APK/DEX parsing and class loading (58 tests)
- ✅ Stage 2: Bytecode interpreter with java.lang shims (118 tests)
- ✅ Stage 3: Android API shim layer (35 tests)
- ✅ Stage 4: UI Bridge & OpenHarmony host (55 tests)
- ✅ Stage 5: Integration & polish - Code complete (357 total)

## Requirements

### Technical Constraints
- ✅ Minimal runtime environment - TypeScript-based interpreter
- ✅ Minimal class support - Only classes needed for Hello World
- ✅ No AOT support - Pure bytecode interpretation
- ✅ No JIT support - No runtime compilation
- ✅ Cold loading - Direct bytecode execution

### OpenHarmony Integration (Stages 4-5 - Complete)
- ✅ APK runs as an OpenHarmony "Ability" (their app model)
- ✅ UI rendered through ArkUI (not Android Views)
- ✅ Works with OpenHarmony services (not Android services)

### Success Criteria

| Criterion | Status | Stage |
|-----------|--------|-------|
| APK file can be parsed and loaded | ✅ Complete | Stage 1 |
| DEX bytecode can be interpreted | ✅ Complete | Stage 2 |
| Android Activity lifecycle executes | ✅ Complete | Stage 3 |
| APK runs as OpenHarmony Ability | ✅ Code Complete | Stage 5 |
| "Hello World" renders via ArkUI | ⚠️ Needs device testing | Stage 5 |
| Pure interpretation (no JIT/AOT) | ✅ Complete | Stages 1-3 |
| Zero regressions across stages | ✅ Maintained | All stages |

**Current Achievement:** 357 tests passing (58 Stage 1 + 201 Stage 2 + 35 Stage 3 + 55 Stage 4 + 8 integration)

## Codebase
- Open Harmony: `./oh`
- Android: `android`

## Project Assessment
Your goal is to provide an assessment on the complexity of the project and create a plan to achieve it. In the plan provide.
- Implementation plan
- Implementation Stages
- Task allocation for three engineers. One of them is the team leader, so managing tasks should be allocated to that person
- Reasonable timeline
- Store plan in `craft_plan.md`