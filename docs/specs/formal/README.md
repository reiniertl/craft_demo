# CRAFT Formal Specifications

This directory contains machine-checkable formal specifications for the CRAFT shim
layer, complementing the descriptive guides in `docs/specs/*.md`.

## Two-Layer Specification System

| Layer | Location | Purpose | Audience |
|-------|----------|---------|---------|
| Descriptive guide | `docs/specs/<class>.md` | Android domain knowledge, design rationale, edge-case notes. Guides an LLM writing formal specs. | Humans & LLMs |
| Formal contract | `docs/specs/formal/<class>.jml` | Machine-checkable pre/post conditions, invariants, frame conditions. | Tools & LLMs |
| Structural model | `docs/specs/formal/*.als` | Alloy relational models for isolation and structural invariants. | Alloy Analyzer |
| Runtime enforcement | `src/contracts/<class>_contracts.ts` | TypeScript translation of JML contracts; executed in the test suite. | CI / `npm test` |

**Workflow for implementing a new shim or auditing an existing one:**

1. Read the descriptive guide (`.md`) for domain semantics and design decisions.
2. Read the JML file for the exact contractual obligations.
3. Check the Alloy model for structural invariants the implementation must satisfy.
4. Run `npm test` — the spec compliance suite in `test/unit/contracts/` will fail on
   any invariant violation.

## Formal Language Usage

### JML (Java Modeling Language)
Files: `*.jml`

JML is the standard behavioral interface specification language for Java/JVM code.
Because CRAFT shims implement Java/Android APIs, JML is the natural fit.

**Key clauses used:**
- `//@ invariant expr;` — class invariant, checked on entry/exit of every public method
- `//@ requires expr;` — precondition (caller's obligation)
- `//@ ensures expr;` — postcondition (implementer's obligation)
- `//@ assignable f1, f2;` — frame condition: only listed fields may change
- `\old(expr)` — value of `expr` before the method call
- `\result` — the return value of the method
- `(*  *)` — informal predicate (for UIBridge state not expressible in first-order logic)
- `\nothing` — empty frame (pure method, no side effects on state)

**Model variables:** Because CRAFT shims store state via `heap.setField(thisRef, name, v)`,
JML model fields (`//@ public model T _fieldName;`) provide a logical abstraction over
the heap, mapping named heap fields to typed JML variables.

**Verification:** Run with OpenJML 0.17+ (`openjml --esc <file>.jml`). Requires JDK 11+.

### Alloy
Files: `*.als`

Alloy is a relational first-order logic modeling language. It is used here for
structural properties that are hard to express in JML:

- Per-instance state isolation (singleton-bug detection)
- View tree structural invariants (no cycles, ordering)
- State-transition correctness across multiple instances

**Verification:** Run with Alloy Analyzer 6.x.
```
java -jar alloy6.jar <file>.als
```
Or use the Alloy VS Code extension. Each `check` command runs a bounded exhaustive
search for counterexamples.

## Files

| File | Spec ID | Class |
|------|---------|-------|
| `android_view_view.jml` | V-1 | `android.view.View` |
| `android_view_view_group.jml` | V-2 | `android.view.ViewGroup` |
| `android_widget_text_view.jml` | V-3 | `android.widget.TextView` |
| `android_widget_button.jml` | V-5 | `android.widget.Button` |
| `android_widget_linear_layout.jml` | V-4 | `android.widget.LinearLayout` |
| `android_app_activity.jml` | A-4 | `android.app.Activity` |
| `android_content_context.jml` | A-2/A-3 | `android.content.Context` + `ContextWrapper` |
| `android_os_bundle.jml` | A-1 | `android.os.Bundle` |
| `viewsystem.als` | V-1..V-3 | View hierarchy structural model |
| `bundle_isolation.als` | A-1 | Bundle per-instance isolation model |
| `linear_layout.als` | V-4 | LinearLayout orientation domain + isolation model |

## Relationship to src/contracts/

`src/contracts/<class>_contracts.ts` contains the TypeScript translation of the JML
contracts. Each JML `invariant`, `requires`, and `ensures` clause has a corresponding
static method that returns `ContractViolation | null`. The spec compliance test suite
(`test/unit/contracts/spec_compliance.test.ts`) calls these methods to verify the
shim implementations satisfy every contract clause. A test failure means a JML clause
is violated by the current implementation.
