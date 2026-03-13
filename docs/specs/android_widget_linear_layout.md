# Spec V-4 — android.widget.LinearLayout

**Class:** `android.widget.LinearLayout`
**DEX descriptor:** `Landroid/widget/LinearLayout;`
**Extends:** `android.view.ViewGroup` (V-2)
**Source:** `src/shim/android/widget/linear_layout.ts`
**Inventory ref:** P0-1 (layout container)

---

## Purpose

Layout container that arranges children sequentially along a single axis. All three
demo apps use `LinearLayout` as the root layout container.

---

## Class Invariants

1. `mOrientation` MUST be one of `{0, 1}` (HORIZONTAL or VERTICAL) at all times.
2. The Android SDK default orientation is `HORIZONTAL` (`0`). The shim MUST match
   this default at construction; any divergence is a bug.
3. All `ViewGroup` (V-2) and `View` (V-1) invariants apply.

---

## Orientation Constants

| Constant | Value | Semantics |
|---|---|---|
| `HORIZONTAL` | `0` | Children laid out left-to-right in a single row. |
| `VERTICAL` | `1` | Children laid out top-to-bottom in a single column. |

---

## Internal State

Inherits all fields from `ViewGroup` (V-2). Additionally:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mOrientation` | `int` | `0` | Current layout axis. |

---

## Constructor

### `LinearLayout(Context context)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `context` is a non-null `Context` heap ref.

Invokes `ViewGroup(Context)` super-constructor. The UIBridge node type MUST be
`'LinearLayout'`. Sets `mOrientation = 0` (HORIZONTAL).

---

## Methods

### `setOrientation(int orientation)`
**Signature:** `(I)V`

**Pre:** `orientation ∈ {0, 1}`.

Sets `mOrientation = orientation`. Calls
`uiBridge.updateViewProperty(thisRef, 'orientation', orientation)`.

---

### `getOrientation() → int`
**Signature:** `()I`

Returns `mOrientation`.

---

## ViewNode Property Contract

| Key | Type | Written by | Default | Notes |
|-----|------|-----------|---------|-------|
| `orientation` | `int` | `setOrientation` | `0` | 0=HORIZONTAL, 1=VERTICAL |
| `visibility` | `int` | inherited from V-1 | `0` | 0=VISIBLE, 4=INVISIBLE, 8=GONE |

---

## Event Callback Contract

Inherits from `View` (V-1): click and timer callbacks. `LinearLayout` registers no
additional event interfaces.

---

## Formal Specification Guide

**For LLMs writing JML and Alloy specs for this class:**

### Model variable bindings
- Inherited from ViewGroup/View: `_mVisibility`, `_mId`, `_childCount`.
- New: `_mOrientation` — `heap.getField(thisRef, 'mOrientation')`, type `int`.
- New UIBridge property: `_uiOrientation` — `node.properties.get('orientation')`, type `number`.

### Non-obvious invariants
- **I-LL1**: `_mOrientation == 0 || _mOrientation == 1`. Domain is {0, 1} — no other values are valid.
  The current shim does NOT validate this in `setOrientation`; it silently accepts any int. This means
  a caller passing `2` would violate I-LL1. The precondition is the caller's obligation.
- **I-LL2**: `_uiOrientation == _mOrientation`. Analogous to V-1 I3b — every `setOrientation` call
  must update BOTH the heap field AND the UIBridge property. Forgetting one is the typical bug pattern.
- Constructor must initialize both `mOrientation = 0` AND `uiBridge.updateViewProperty(this, 'orientation', 0)`.
  Also inherits V-1 I3b: must also call `updateViewProperty(this, 'visibility', 0)`.

### JML guidance
- `setOrientation`: write two `normal_behavior` / `exceptional_behavior` branches with `also`.
  The `exceptional_behavior` for invalid input is informational — the current shim doesn't throw —
  but it documents the contract violation.
- `getOrientation`: pure method, `assignable \nothing`, `ensures \result == _mOrientation`.
- Frame condition for `setOrientation`: `assignable _mOrientation` (only the orientation field changes;
  `_mVisibility`, `_mId`, and `_childCount` are unaffected).

### Alloy guidance
- See `docs/specs/formal/linear_layout.als` for the orientation domain model.
- Key pattern: `abstract sig Orientation {} one sig HORIZONTAL one sig VERTICAL` captures the domain
  as a type — Alloy's type system enforces I-LL1 by construction (no Int needed).
- Per-instance isolation fact: `all disj i1, i2 : LinearLayoutInstance | i1.state != i2.state`
  detects a shared-orientation singleton bug analogous to the Bundle/ViewGroup bugs.
- The `run OrientationsDiffer` predicate confirms the correct model allows two instances to have
  different orientations (independence property).

## Host Renderer Hints

| `orientation` value | ArkUI container |
|---|---|
| `0` (HORIZONTAL) | `Row()` |
| `1` (VERTICAL) | `Column()` |

Children MUST be rendered in the insertion order of the ViewNode's `children` array.
When `orientation` changes at runtime the host MUST re-render the container with the
updated axis.
