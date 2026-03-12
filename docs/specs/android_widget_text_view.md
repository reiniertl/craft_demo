# Spec V-3 — android.widget.TextView

**Class:** `android.widget.TextView`
**DEX descriptor:** `Landroid/widget/TextView;`
**Extends:** `android.view.ViewGroup` (V-2)
**Source:** `src/shim/android/widget/textview.ts`
**Inventory ref:** P0-4 (partial)

---

## Purpose

Displays a read-only text string. Primary visual content widget. `Button` (V-5) and
`EditText` extend `TextView`. All three demo apps display text via `TextView` or a
subclass.

---

## Class Invariants

1. `mText` is always a valid (possibly empty) string. It MUST NOT be null.
2. `mTextSize` MUST be a positive float (SP units). Zero or negative values MUST NOT
   be written.
3. `mTextColor` encodes ARGB as a 32-bit signed integer with layout `0xAARRGGBB`.
4. All `ViewGroup` (V-2) and `View` (V-1) invariants apply.

---

## Internal State

Inherits all fields from `ViewGroup` (V-2). Additionally:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mText` | `string` | `""` | Current text content. |
| `mTextSize` | `float` | `14.0` | Font size in SP. |
| `mTextColor` | `int` | `0xFF000000` | Text colour, ARGB. |

---

## Constructor

### `TextView(Context context)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `context` is a non-null `Context` heap ref.

Invokes `ViewGroup(Context)` super-constructor. The UIBridge node type MUST be
`'TextView'`. Sets `mText = ""`, `mTextSize = 14.0`, `mTextColor = 0xFF000000`.

---

## Methods

### `setText(CharSequence text)`
**Signature:** `(Ljava/lang/CharSequence;)V`

**Pre:** `text` is a non-null heap ref whose string value is resolvable by the shim.

1. Resolves `text` to a host string value.
2. Sets `mText` to that string.
3. Calls `uiBridge.updateViewProperty(thisRef, 'text', stringValue)`.

---

### `getText() → CharSequence`
**Signature:** `()Ljava/lang/CharSequence;`

Returns a `String` heap ref whose value equals `mText`.

**Post:** Return value is non-null. The ref MAY be freshly allocated on each call;
callers MUST NOT rely on reference identity.

---

### `setTextSize(float size)`
**Signature:** `(F)V`

**Pre:** `size > 0`.

Sets `mTextSize = size`. Calls
`uiBridge.updateViewProperty(thisRef, 'textSize', size)`.

---

### `setTextColor(int color)`
**Signature:** `(I)V`

Sets `mTextColor = color`. Calls
`uiBridge.updateViewProperty(thisRef, 'textColor', color)`.

The `color` value encodes ARGB as `0xAARRGGBB`. Any 32-bit integer is accepted
without validation.

---

## ViewNode Property Contract

| Key | Type | Written by | Default | Invariant |
|-----|------|-----------|---------|-----------|
| `text` | `string` | `setText` | `""` | Non-null UTF-8 string. |
| `textSize` | `float` | `setTextSize` | `14.0` | SP units; > 0. |
| `textColor` | `int` | `setTextColor` | `0xFF000000` | ARGB 32-bit integer. |
| `visibility` | `int` | inherited from V-1 | `0` | 0=VISIBLE, 4=INVISIBLE, 8=GONE |

---

## Event Callback Contract

Inherits from `View` (V-1):
- `OnClickListener.onClick(View)` on host tap.
- Runnable timer callbacks via `post` / `postDelayed`.

---

## Formal Specification Guide

> Structured annotation for LLMs writing `android_widget_text_view.jml`.
> TextView extends ViewGroup (V-2) which extends View (V-1) — all inherited
> invariants apply.

**JML model variable bindings:**
- `_mText` → `heap.getStringValue(heap.getField(thisRef, 'mText').ref)`
  (note: two-level dereference — heap ref → string value)
- `_mTextSize` → `heap.getField(thisRef, 'mTextSize').value` (float)
- `_mTextColor` → `heap.getField(thisRef, 'mTextColor').value` (signed int32)
- `_uiText` → `uiBridge.getViewNode(thisRef).properties['text']`

**The five sync invariants (I-TV3/4/5 and their counterparts) are the most
important to capture.** Every property-writing method (setText, setTextSize,
setTextColor) has an `assignable` clause covering BOTH the heap field AND
the UIBridge model variable. Missing either from `assignable` or `ensures`
is a spec violation.

**Constructor obligations that tripped the last audit:**
- The constructor MUST initialize `__childCount = 0` (V-2 invariant, inherited).
  This is NOT done by calling the ViewGroup constructor — TextView registers its
  own shim constructor and must reproduce all ViewGroup initialization. The JML
  `ensures _childCount == 0` makes this obligation explicit.
- UIBridge node type MUST be `'TextView'`, not `'ViewGroup'` — the constructor
  calls `registerView(thisRef, 'TextView')` which overrides the type set by any
  prior View-level registration. The JML postcondition names this explicitly.
- All UIBridge properties MUST be initialized to defaults in the constructor
  (I-TV3/4/5 must hold from the very first moment before any app code runs).

**setText edge case:** the spec requires graceful handling of a null CharSequence
ref — degrade to `""` rather than propagate null into `mText`. Write two
`normal_behavior` branches in the JML `also` clause.

**setTextSize exceptional branch:** size ≤ 0 MUST be an `exceptional_behavior`
clause with `signals_only IllegalArgumentException`. This is what guarantees
I-TV2 is maintained — the field is never written with a bad value.

## Host Renderer Hints

| Key | ArkUI mapping | Conversion |
|---|---|---|
| `text` | Text label content | Display as-is. |
| `textSize` | `fontSize` | SP × device density → logical pixels. |
| `textColor` | `fontColor` | Convert `0xAARRGGBB` int to `'#AARRGGBB'` string (see formula below). |

**ARGB → ArkUI color string:**

```
const a = (textColor >>> 24) & 0xFF;
const r = (textColor >>> 16) & 0xFF;
const g = (textColor >>>  8) & 0xFF;
const b =  textColor         & 0xFF;
const arkuiColor = '#' + [a, r, g, b]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
```
