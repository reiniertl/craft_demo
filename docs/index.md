# CRAFT Documentation Index

**CRAFT** - Compatibility Runtime for Android Framework Translation

A compatibility layer enabling OpenHarmony to run Android APKs natively through bytecode interpretation.

---

## Quick Start

- [📋 Project Overview](../README.md) - What is CRAFT and why?
- [🎯 Requirements](requirements.md) - Project goals, constraints, and success criteria
- [🏗️ Architecture](architecture.md) - System design and component interaction
- [📅 Implementation Plan](implementation_plan.md) - Complete 5-stage roadmap with timeline

---

## Implementation Progress

| Stage | Focus | Plan | Results | Status |
|-------|-------|------|---------|--------|
| **Stage 1** | APK/DEX Parsing | [Plan](stages/stage_1_plan.md) | [Results](stages/stage_1_results.md) | ✅ Complete (58 tests) |
| **Stage 2** | Bytecode Interpreter | [Plan](stages/stage_2_plan.md) | [Results](stages/stage_2_results.md) | ✅ Complete (115 tests) |
| **Stage 3** | Android API Shims | [Plan](stages/stage_3_plan.md) | [Results](stages/stage_3_results.md) | ✅ Complete (35 tests) |
| **Stage 4** | UI Bridge to ArkUI | [Plan](stages/stage_4_plan.md) | Results | 🚧 Next |
| **Stage 5** | OpenHarmony Host | Plan | Results | ⏳ Planned |

**Current Status:** 208 tests passing (58 + 115 + 35) | 0 TypeScript errors | 0 regressions

---

## Reference Documentation

### Technical Specifications
- [📐 Component Specifications](specification.md) - Detailed specs for all CRAFT components
- [🧪 Testing Strategy](testing/test_strategy.md) - Test coverage approach and fixtures

### Extension Guides (Future)
- [➕ Adding View Components](extensions/adding_views.md) - Extend UI component support
- [⚙️ Adding Opcodes](extensions/adding_opcodes.md) - Implement additional Dalvik opcodes
- [🔌 Adding API Shims](extensions/adding_apis.md) - Expand Android API coverage

---

## For Developers

### Implementation Codebase
- **Location:** `/mnt/d/craft/craft/`
- **Main Entry:** `src/index.ts` - CRAFT runtime entry point
- **Tests:** `test/` - 208 comprehensive tests across all stages

### For AI Agents (Claude Code)
- [🤖 CLAUDE.md](../craft/CLAUDE.md) - Project context, architecture, and current stage

---

## Documentation Conventions

- **File naming:** `snake_case` for all markdown files
- **Stage docs:** `stage_N_plan.md` (planning) → `stage_N_results.md` (completion report)
- **Status icons:** ✅ Complete | 🚧 In Progress | ⏳ Planned
- **Test counts:** Always show breakdown by stage (e.g., "208 tests: 58 + 115 + 35")

---

## Navigation Tips

- **New to CRAFT?** Start with [Project Overview](../README.md) → [Requirements](requirements.md) → [Architecture](architecture.md)
- **Implementing Stage 4?** Read [Stage 4 Plan](stages/stage_4_plan.md) → [Implementation Plan](implementation_plan.md) sections 7-8
- **Understanding current state?** Check [Stage 3 Results](stages/stage_3_results.md) for latest completion status
- **Need AI context?** Consult [CLAUDE.md](../craft/CLAUDE.md) for full project history

---

**Last Updated:** 2026-02-12
**Version:** 1.1.0 (Post-Stage 3 reorganization)
