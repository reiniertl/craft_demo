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

## Host Renderer Hints

| `orientation` value | ArkUI container |
|---|---|
| `0` (HORIZONTAL) | `Row()` |
| `1` (VERTICAL) | `Column()` |

Children MUST be rendered in the insertion order of the ViewNode's `children` array.
When `orientation` changes at runtime the host MUST re-render the container with the
updated axis.
