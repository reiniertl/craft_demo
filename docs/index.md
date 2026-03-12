# CRAFT Documentation Index

**CRAFT** - Compatibility Runtime for Android Framework Translation

A compatibility layer enabling OpenHarmony to run Android APKs natively through bytecode interpretation.

---

## Quick Start

- [Project Overview](../README.md) - What is CRAFT and why?
- [Requirements](requirements.md) - Project goals, constraints, and success criteria
- [Architecture](architecture.md) - System design and component interaction
- [Implementation Plan](implementation_plan.md) - Complete 5-stage roadmap with timeline

---

## Implementation Progress

| Stage | Focus | Plan | Results | Status |
|-------|-------|------|---------|--------|
| **Stage 1** | APK/DEX Parsing | [Plan](stages/stage_1_plan.md) | [Results](stages/stage_1_results.md) | ✅ Complete (58 tests) |
| **Stage 2** | Bytecode Interpreter | [Plan](stages/stage_2_plan.md) | [Results](stages/stage_2_results.md) | ✅ Complete (115 tests) |
| **Stage 3** | Android API Shims | [Plan](stages/stage_3_plan.md) | [Results](stages/stage_3_results.md) | ✅ Complete (35 tests) |
| **Stage 4** | UI Bridge to ArkUI | [Plan](stages/stage_4_plan.md) | [Results](stages/stage_4_complete.md) | ✅ Complete (55 tests) |
| **Stage 5** | OpenHarmony Host | [Plan](stages/stage_5_plan.md) | [Status](stage_5_status.md) | ✅ Complete — Device Tested |

**Current Status:** 568 tests passing | 0 TypeScript errors | 0 regressions | Complete — Device Tested
**Deployment:** ✅ HAP built, signed, tested on HarmonyOS device (Feb 24) - [Details](stage_5_status.md)

---

## Reference Documentation

### Technical Specifications
- [Component Specifications](specification.md) - Detailed specs for all 12 CRAFT components
- [ArkUI Rendering Spec](arkui_rendering_spec.md) - ArkUI rendering patterns, constraints, and data flow
- [Android Translation Spec Inventory](android_translation_spec_inventory.md) - Language-neutral spec inventory: 46 specs across P0–P3 + stdlib, coverage model, design invariants

### Guides
- [Deployment Guide](deployment_guide.md) - HAP/device deployment instructions
- [APK Build Guide](apk_build_guide.md) - Building demo APKs (HelloWorld + Calculator)
- [HAP Build Guide](hap_build_guide.md) - Building the OpenHarmony HAP
- [Tools Guide](tools_guide.md) - 14 development tools reference

### Extension
- See [specification.md - Extension Guidelines](specification.md#extension-guidelines) for adding views, opcodes, and API classes

---

## For Developers

### Implementation Codebase
- **Main Entry:** `src/index.ts` - CRAFT runtime entry point
- **Tests:** `test/` - 568 tests across all stages

### For AI Agents (Claude Code)
- [CLAUDE.md](../CLAUDE.md) - Project context, architecture, and current stage

---

## Documentation Conventions

- **File naming:** `snake_case` for all markdown files
- **Stage docs:** `stage_N_plan.md` (planning) / `stage_N_results.md` (completion report)
- **Status icons:** ✅ Complete | In Progress | Planned

---

## Navigation Tips

- **New to CRAFT?** Start with [Project Overview](../README.md) then [Requirements](requirements.md) then [Architecture](architecture.md)
- **Deploying?** Read [Stage 5 Status](stage_5_status.md) then [Deployment Guide](deployment_guide.md)
- **Need AI context?** Consult [CLAUDE.md](../CLAUDE.md) for full project history

---

**Last Updated:** 2026-03-09
**Version:** 0.3.0
