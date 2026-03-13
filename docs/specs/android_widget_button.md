# Spec V-5 — android.widget.Button

**Class:** `android.widget.Button`
**DEX descriptor:** `Landroid/widget/Button;`
**Extends:** `android.widget.TextView` (V-3)
**Source:** `src/shim/android/widget/button.ts`
**Inventory ref:** P0-7 (click events), P0-4 (text display)

---

## Purpose

Tappable button with a text label. Adds no new methods over `TextView`; its
distinction is semantic: a `Button` node MUST be rendered as a pressable interactive
target. The calculator demo creates one `Button` per digit and operator, each with a
unique `id` and an `OnClickListener`.

---

## Class Invariants

All `TextView` (V-3), `ViewGroup` (V-2), and `View` (V-1) invariants apply without
modification. `Button` introduces no additional invariants.

---

## Constructor

### `Button(Context context)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `context` is a non-null `Context` heap ref.

Invokes the `TextView(Context)` super-constructor. The UIBridge node type MUST be
`'Button'`. All field initialisation is delegated to the super-constructor.

---

## Inherited API Surface

`Button` inherits the complete API of its superclass chain. Method resolution MUST
follow: `Button → TextView → ViewGroup → View → Object`.

| Method | Signature | Spec |
|--------|-----------|------|
| `setText(CharSequence)` | `(Ljava/lang/CharSequence;)V` | V-3 |
| `getText()` | `()Ljava/lang/CharSequence;` | V-3 |
| `setTextSize(float)` | `(F)V` | V-3 |
| `setTextColor(int)` | `(I)V` | V-3 |
| `setId(int)` | `(I)V` | V-1 |
| `getId()` | `()I` | V-1 |
| `setVisibility(int)` | `(I)V` | V-1 |
| `getVisibility()` | `()I` | V-1 |
| `setOnClickListener(OnClickListener)` | `(Landroid/view/View$OnClickListener;)V` | V-1 |
| `performClick()` | `()Z` | V-1 |
| `post(Runnable)` | `(Ljava/lang/Runnable;)Z` | V-1 |
| `postDelayed(Runnable,long)` | `(Ljava/lang/Runnable;J)Z` | V-1 |
| `removeCallbacks(Runnable)` | `(Ljava/lang/Runnable;)Z` | V-1 |
| `addView(View)` | `(Landroid/view/View;)V` | V-2 |
| `getChildCount()` | `()I` | V-2 |

---

## ViewNode Property Contract

Inherits all keys from `TextView` (V-3):

| Key | Type | Default |
|-----|------|---------|
| `text` | `string` | `""` |
| `textSize` | `float` | `14.0` |
| `textColor` | `int` | `0xFF000000` |
| `visibility` | `int` | `0` |

---

## Event Callback Contract

| Listener | Callback | Storage | Dispatch trigger |
|---|---|---|---|
| `View.OnClickListener` | `onClick(View v)` | `mOnClickListener` | `uiBridge.dispatchClick(viewRef)` on host tap |

**Calculator pattern:** The Activity implements `OnClickListener`. The `onClick(View)`
callback calls `v.getId()` to identify the tapped button. The shim MUST return the
value last written by `setId()` from `getId()`.

---

## Formal Specification Guide

**For LLMs writing JML and Alloy specs for this class:**

### Model variable bindings
- Inherit all bindings from TextView (V-3): `_mText`, `_mTextSize`, `_mTextColor`, `_mVisibility`, `_mId`.
- One new model variable: `_uiBridgeType` — the `viewType` string in the UIBridge node.

### Non-obvious invariants
- **I-BT1**: `_uiBridgeType == 'Button'`. This is the only new invariant. The ArkUI host uses this to
  select the interactive `Button()` component instead of a static `Text()` node.
- All V-1 I3b, V-3 I-TV3/4/5 sync invariants apply to Button as well. The constructor must
  initialize all UIBridge properties (visibility, text, textSize, textColor) just as TextView does
  — the difference is only the node type string.

### JML guidance
- Constructor: requires both `uiBridge.registerView(this, 'Button')` AND four `updateViewProperty`
  calls for visibility/text/textSize/textColor. An LLM implementing this class must not just copy
  the `registerView` call from the super-constructor — it needs the explicit property syncs too.
- All other method contracts are purely inherited. Use `also` with `@see` to reference V-3/V-2/V-1.
- No `exceptional_behavior` needed in Button's own constructor; domain errors belong to inherited methods.

### Alloy guidance
- No new Alloy model needed. Button's structural properties are a strict subset of `viewsystem.als`:
  it uses `ViewGroupState` (with `children`) and `ViewState` (with `visibility`).
- The only new property (`_uiBridgeType`) is a string constant, not a structural invariant requiring
  Alloy's relational reasoning.

## Host Renderer Hints

| Key | ArkUI mapping | Notes |
|---|---|---|
| `type = 'Button'` | `Button(text)` component | MUST be a pressable element. |
| `text` | Button label argument | Passed as the `Button()` label. |
| `textColor` | `fontColor` | Same ARGB conversion as V-3. |
| `visibility` | See V-1 | See V-1. |

The ArkUI `onClick` handler MUST call `uiBridge.dispatchClick(arkuiId)` to route
the tap back to the shim layer for interpreter execution.
