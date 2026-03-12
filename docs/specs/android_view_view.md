# Spec V-1 — android.view.View

**Class:** `android.view.View`
**DEX descriptor:** `Landroid/view/View;`
**Extends:** `java.lang.Object` (JL-1)
**Source:** `src/shim/android/view/view.ts`
**Inventory ref:** P0-1 (partial), P0-7 (partial)

---

## Purpose

Base class for every UI component. Provides identity, visibility, click-event
dispatch, and deferred-execution scheduling (post/postDelayed). All widget classes
inherit from `View`.

---

## Class Invariants

1. Every `View` instance MUST have a UIBridge node registered at construction time,
   before any other method on the instance is called.
2. `mId` defaults to `-1` (no id assigned). Only positive values are meaningful ids.
3. `mVisibility` MUST be one of `{0, 4, 8}` at all times.
4. At most one `OnClickListener` is active at a time. Calling `setOnClickListener`
   again replaces the previous listener.
5. The timer queue is per-Activity (managed by UIBridge), not per-View.
   `removeCallbacks(r)` cancels all pending timers whose Runnable heap ref equals `r`,
   regardless of which `View` registered them.

---

## Visibility Constants

| Constant | Value | Semantics |
|---|---|---|
| `VISIBLE` | `0` | Rendered; occupies layout space. |
| `INVISIBLE` | `4` | Not rendered; occupies layout space. |
| `GONE` | `8` | Not rendered; does not occupy layout space. |

---

## Internal State

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mContext` | heap ref | (constructor arg) | The `Context` passed to the constructor. |
| `mId` | `int` | `-1` | View identifier. |
| `mVisibility` | `int` | `0` | Current visibility. |
| `mOnClickListener` | heap ref \| null | `null` | Registered click listener. |

---

## Constructor

### `View(Context context)`
**Signature:** `(Landroid/content/Context;)V`

**Pre:** `context` is a non-null `Context` heap ref.

Sets `mContext`, `mId = -1`, `mVisibility = 0`, `mOnClickListener = null`.
Calls `uiBridge.registerView(thisRef, 'View')`.

---

## Methods

### `getContext() → Context`
**Signature:** `()Landroid/content/Context;`

Returns `mContext`. Return value is non-null.

---

### `setId(int id)` / `getId() → int`
**Signatures:** `(I)V` / `()I`

`setId` writes `mId`; `getId` reads `mId`.

---

### `setVisibility(int visibility)`
**Signature:** `(I)V`

**Pre:** `visibility ∈ {0, 4, 8}`.

Sets `mVisibility = visibility`. Calls
`uiBridge.updateViewProperty(thisRef, 'visibility', visibility)`.

---

### `getVisibility() → int`
**Signature:** `()I`

Returns `mVisibility`.

---

### `setOnClickListener(OnClickListener l)`
**Signature:** `(Landroid/view/View$OnClickListener;)V`

Stores `l` in `mOnClickListener`. Calls `uiBridge.setClickCallback(thisRef, fn)`,
where `fn` is a closure that invokes `l.onClick(thisRef)` via the interpreter when
called. If `l` is null, the callback is removed from UIBridge.

---

### `performClick() → boolean`
**Signature:** `()Z`

If `mOnClickListener` is non-null, invokes `mOnClickListener.onClick(thisRef)` via
the interpreter and returns `true`. Returns `false` if no listener is registered.

---

### `post(Runnable r) → boolean`
**Signature:** `(Ljava/lang/Runnable;)Z`

**Pre:** `r` is a non-null `Runnable` heap ref.

Calls `uiBridge.scheduleTimer(thisRef, rRef, fn, 0)`, where `fn` invokes `r.run()`
via the interpreter. Returns `true`.

---

### `postDelayed(Runnable r, long delayMillis) → boolean`
**Signature:** `(Ljava/lang/Runnable;J)Z`

**Pre:** `r` is a non-null `Runnable` heap ref. `delayMillis ≥ 0`.

Calls `uiBridge.scheduleTimer(thisRef, rRef, fn, delayMillis)`. Returns `true`.

---

### `removeCallbacks(Runnable r) → boolean`
**Signature:** `(Ljava/lang/Runnable;)Z`

**Pre:** `r` is a non-null `Runnable` heap ref.

Calls `uiBridge.cancelTimersForRunnable(thisRef, rRef)`. Returns `true`.

---

## ViewNode Property Contract

| Key | Type | Written by | Default | Notes |
|-----|------|-----------|---------|-------|
| `visibility` | `int` | `setVisibility(int)` | `0` | 0=VISIBLE, 4=INVISIBLE, 8=GONE |

---

## Event Callback Contract

| Listener | Callback | Storage | Dispatch trigger |
|---|---|---|---|
| `View.OnClickListener` | `onClick(View v)` | `mOnClickListener` | `uiBridge.dispatchClick(viewRef)` on host tap |

**Timer callbacks:**

| Method | UIBridge call | When executed |
|---|---|---|
| `post(r)` | `scheduleTimer(thisRef, rRef, fn, 0)` | Next timer tick |
| `postDelayed(r, ms)` | `scheduleTimer(thisRef, rRef, fn, ms)` | After `ms` milliseconds |
| `removeCallbacks(r)` | `cancelTimersForRunnable(thisRef, rRef)` | Cancels all entries for `r` |

---

## Host Renderer Hints

| Key | ArkUI behaviour |
|---|---|
| `visibility = 0` | Render normally. |
| `visibility = 4` | Set `opacity(0)`; preserve layout space. |
| `visibility = 8` | Set `visibility(Visibility.None)`; collapse layout space. |
