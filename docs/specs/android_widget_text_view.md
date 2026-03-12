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
