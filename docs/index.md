# CRAFT Documentation Index

**CRAFT** - Compatibility Runtime for Android Framework Translation

A compatibility layer enabling OpenHarmony to run Android APKs natively through bytecode interpretation.

---

## Quick Start

- [📋 Project Overview](../README.md) - What is CRAFT and why?
- [🚀 Stage 5 Status](STAGE_5_STATUS.md) - **Deployment guide: What's done, what needs human intervention**
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
| **Stage 4** | UI Bridge to ArkUI | [Plan](stages/stage_4_plan.md) | [Results](stages/stage_4_complete.md) | ✅ Complete (55 tests) |
| **Stage 5** | OpenHarmony Host | [Plan](stages/stage_5_plan.md) | [Status](STAGE_5_STATUS.md) | ✅ Code Complete |

**Current Status:** 266 tests passing | 0 TypeScript errors | 0 regressions | Code 100% Complete
**Deployment:** ✅ HAP buildable | ⚠️ Needs APK recompilation & device testing - [Details](STAGE_5_STATUS.md)

---

## Reference Documentation

### Technical Specifications
- [📐 Component Specifications](specification.md) - Detailed specs for all CRAFT components
- [📘 CRAFT Specification](CRAFT_SPECIFICATION.md) - Comprehensive 1400+ line detailed spec

### Extension Guides
- See [specification.md - Extension Guidelines](specification.md#extension-guidelines) for adding views, opcodes, and API classes

---

## For Developers

### Implementation Codebase
- **Location:** `/mnt/d/craft/craft/`
- **Main Entry:** `src/index.ts` - CRAFT runtime entry point
- **Tests:** `test/` - 266 comprehensive tests across all stages

### For AI Agents (Claude Code)
- [🤖 CLAUDE.md](../craft/CLAUDE.md) - Project context, architecture, and current stage

---

## Documentation Conventions

- **File naming:** `snake_case` for all markdown files
- **Stage docs:** `stage_N_plan.md` (planning) → `stage_N_results.md` (completion report)
- **Status icons:** ✅ Complete | 🚧 In Progress | ⏳ Planned
- **Test counts:** Always show breakdown by stage (e.g., "266 tests: 58 + 118 + 35 + 55")

---

## Navigation Tips

- **New to CRAFT?** Start with [Project Overview](../README.md) → [Requirements](requirements.md) → [Architecture](architecture.md)
- **Deploying?** Read [Stage 5 Status](STAGE_5_STATUS.md) → [Deployment Guide](deployment_guide.md)
- **Understanding current state?** Check [Stage 5 Final Summary](stages/stage_5_final_summary.md) for latest status
- **Need AI context?** Consult [CLAUDE.md](../CLAUDE.md) for full project history

---

**Last Updated:** 2026-02-17
**Version:** 0.1.0
