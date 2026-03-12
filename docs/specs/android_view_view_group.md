# Spec V-2 — android.view.ViewGroup

**Class:** `android.view.ViewGroup`
**DEX descriptor:** `Landroid/view/ViewGroup;`
**Extends:** `android.view.View` (V-1)
**Source:** `src/shim/android/view/view_group.ts`
**Inventory ref:** P0-1 (container base)

---

## Purpose

Abstract container view that owns an ordered list of child `View` nodes. All layout
classes (`LinearLayout`, `FrameLayout`, etc.) extend `ViewGroup`. `addView` is the
primary way apps build the view hierarchy.

---

## Class Invariants

1. The child list is ordered by insertion sequence. `addView` appends to the end.
2. Each child heap ref MUST appear at most once in the child list. Adding the same ref
   twice has undefined behaviour.
3. `getChildCount()` MUST equal the number of successful `addView` calls on this
   instance.
4. All `View` invariants (V-1) apply.

---

## Internal State

Inherits all fields from `View` (V-1). Additionally:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `__children` | `int[]` | `[]` | Ordered list of child view heap refs. Not part of the Android API. |

---

## Constructor

### `ViewGroup(Context context)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `context` is a non-null `Context` heap ref.

Invokes `View(Context)` super-constructor, which registers a UIBridge node with
type `'ViewGroup'`. Initialises `__children` to `[]`.

---

## Methods

### `addView(View child)`
**Signature:** `(Landroid/view/View;)V`

**Pre:** `child` is a non-null `View` heap ref.

1. Appends `child` to `__children`.
2. Calls `uiBridge.addChildView(thisRef, childRef)`, which appends the child's
   ViewNode to this ViewNode's `children` array and increments the state version.

**Post:** `getChildCount()` returns a value one greater than before the call.

---

### `getChildCount() → int`
**Signature:** `()I`

Returns `__children.length`.

**Post:** Return value ≥ 0.

---

## ViewNode Property Contract

Inherits `visibility` from `View` (V-1). No additional keys.

---

## Event Callback Contract

Inherits click and timer callbacks from `View` (V-1).

---

## Formal Specification Guide

> Structured annotation for LLMs writing `android_view_view_group.jml` or
> the ViewGroup portion of `viewsystem.als`.

**JML model variable bindings:**
- `_childCount` → `uiBridge.getViewNode(thisRef).children.length` (when UIBridge present)
  OR `heap.getField(thisRef, '__childCount').value` (test contexts without UIBridge)
- `_children[i]` → the i-th heap ref in `uiBridge.getViewNode(thisRef).children`

**The critical invariants to capture formally:**

1. **I-VG2 (count consistency)** — `_childCount == _children.length` is the invariant
   that would have caught the singleton-store bug mechanically. In Alloy, this is
   automatically true because seqs carry their own length. In JML, it requires an
   explicit `invariant` clause tying `_childCount` to `_children.length`.

2. **I-VG3 (no duplicates)** — state this as a JML `\forall` over all pairs `(i, j)`.
   The spec says "undefined behaviour" for duplicates; the JML precondition on `addView`
   should state the obligation: `requires child not in _children[0.._childCount-1]`.

3. **I-VG-ISOLATION** — this invariant cannot be expressed in standard JML (it requires
   referring to OTHER instances). Encode it in Alloy as the `PerInstanceIsolation` fact,
   and in the TypeScript contracts as the cross-instance test helper.

**addView assignable clause** must include BOTH `_childCount` AND `_children`, because
the old singleton implementation changed a shared data structure — failing to list both
in the frame would mask that violation.

**Alloy guidance:**
- `ViewGroupState` should have `children : seq HeapRef` (Alloy seqs enforce ordering
  and provide `#seq` for count).
- The `PerInstanceIsolation` fact (`all disj v1, v2 : ViewGroupInstance | v1.state != v2.state`)
  must be a `fact`, not just an `assert` — it is a design decision, not something to verify.
- The `BuggyViewGroupInstance` section uses a `sig BuggyViewGroupState` that multiple
  instances can share. The `SharedStateCausesInterference` assert then FINDS a
  counterexample, demonstrating the bug.

## Host Renderer Hints

Children MUST be rendered in the order they appear in the ViewNode's `children`
array (insertion order). On re-render triggered by `addChildView`, the host MUST
preserve existing children at their positions and append the new child at the end.
