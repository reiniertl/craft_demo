# Android API Translation Spec Inventory

**CRAFT** — Compatibility Runtime for Android Framework Translation

This document is a language-neutral reference for planning and tracking the implementation of
Android-to-host-platform API translation. It defines the translation architecture, a reusable
spec template, a prioritised inventory of all specs needed for broad app compatibility, and the
coverage model that relates spec completeness to the fraction of real-world apps that will work.

Use this document as the authoritative source when starting a translation layer implementation in
any language or for any target platform.

---

## 1. The Translation Problem

An Android application is compiled to Dalvik/DEX bytecode. At runtime it calls into the Android
framework — a large set of Java classes (`android.*`, `java.*`) that provide UI widgets, layout
containers, lifecycle management, system services, and utilities.

A compatibility runtime must intercept every framework call made by the bytecode and produce an
equivalent result on the host platform. There are two distinct concerns:

- **Behavioural translation** — the app's logic must execute correctly (arithmetic, string
  manipulation, business logic). This is handled by the bytecode interpreter and requires shims
  for the Java standard library.
- **Visual translation** — the app's UI must be rendered on the host platform's native UI
  framework. This requires translating an Android View hierarchy into the host's component model.

These two concerns interact: behavioural translation produces side-effects (e.g. `setText("42")`)
that drive visual translation.

---

## 2. The Four-Layer Translation Pipeline

All implementations, regardless of language, pass through four conceptual layers. Each layer has
a defined input contract and output contract.

```
┌─────────────────────────────────────────────────────┐
│  Layer 1: Bytecode Execution                        │
│  Input:  DEX bytecode + method call                 │
│  Output: Java return value + side-effects           │
│                                                     │
│  The interpreter executes Dalvik opcodes and        │
│  dispatches framework method calls to the shim      │
│  layer.                                             │
└──────────────────────┬──────────────────────────────┘
                       │ method call: class + name + sig + args
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 2: Shim Layer (Method Interception)          │
│  Input:  Android API method call                    │
│  Output: Java return value + ViewNode mutations     │
│                                                     │
│  Each shim implements one or more Android API       │
│  methods. For UI classes, shims write properties    │
│  to the View node record and optionally register    │
│  event callbacks.                                   │
└──────────────────────┬──────────────────────────────┘
                       │ property writes + structural changes
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 3: Intermediate View Tree                    │
│  Input:  Property mutations from shims              │
│  Output: Serialised, immutable view tree snapshot   │
│                                                     │
│  The view tree is a graph of View nodes. Each node  │
│  holds a type tag, a flat property map, a list of   │
│  children, and an opaque host ID. On every mutation │
│  the tree is serialised to a plain record structure │
│  (no mutable objects) and a version counter is      │
│  incremented to signal host re-render.              │
└──────────────────────┬──────────────────────────────┘
                       │ serialised tree snapshot + version
                       ▼
┌─────────────────────────────────────────────────────┐
│  Layer 4: Host UI Renderer                          │
│  Input:  Serialised view tree snapshot              │
│  Output: Native host UI components                  │
│                                                     │
│  The renderer maps each View node type to a host    │
│  UI component, applies translated properties, and   │
│  wires event handlers that route back to Layer 2    │
│  for execution.                                     │
└─────────────────────────────────────────────────────┘
```

### Layer boundaries are stable; implementations vary

The four-layer structure is fixed. What changes between target platforms is:

| Layer | Variable part |
|-------|--------------|
| 1 | Interpreter implementation language |
| 2 | Shim implementation language + host API used for timers/resources |
| 3 | Serialisation format (JSON, binary, shared memory, IPC) |
| 4 | Host UI framework (ArkUI, Flutter, SwiftUI, Qt, Web DOM, etc.) |

A spec document covers Layers 2 and 3 (the shim contract and the resulting ViewNode properties).
Layer 4 mappings are platform-specific and documented separately per target.

---

## 3. Spec Format

Each spec covers one Android class or one tightly coupled group of classes (e.g. a widget and its
`LayoutParams` subclass). A spec has four sections.

### 3.1 API Surface

A table of every Android method and field that must be intercepted.

| Method / Field | Signature | Required | Notes |
|----------------|-----------|----------|-------|
| `ClassName(Context)` | constructor | Yes | Must create ViewNode |
| `setFoo(int)` | `(I)V` | Yes | Writes `foo` property |
| `getFoo()` | `()I` | If readable | Reads heap field |
| `setOnFooListener(…)` | `(L…;)V` | If events used | Stores callback |

**Signature notation** follows DEX/JVM type descriptors:
`I`=int, `J`=long, `F`=float, `D`=double, `Z`=boolean, `B`=byte, `C`=char, `S`=short,
`V`=void, `[T`=array of T, `Lfully/qualified/Name;`=object reference.

### 3.2 ViewNode Property Contract

A table of every property key written to the ViewNode for this class.

| Key | Type | Source | Default | Notes |
|-----|------|--------|---------|-------|
| `text` | string | `setText()` | `""` | UTF-8 |
| `textSize` | float | `setTextSize()` | `14` | sp units |
| `orientation` | int | `setOrientation()` | `0` | 0=H, 1=V |
| `lp_width` | int | `LayoutParams` | `-2` | -1=MATCH, -2=WRAP |

These keys form the contract between Layer 2 and Layer 3. All renderers for all target platforms
read the same keys. New keys must be added here before being used in any renderer.

### 3.3 Event Callback Contract

For each event listener interface the shim must support:

| Android listener interface | Method invoked on app | ViewNode key storing ref | Dispatch trigger |
|---------------------------|----------------------|--------------------------|-----------------|
| `View.OnClickListener` | `onClick(View)` | (stored in shim, not ViewNode) | Host tap/click |
| `View.OnLongClickListener` | `onLongClick(View)` | (stored in shim) | Host long-press |
| `TextWatcher` | `afterTextChanged(Editable)` | (stored in shim) | Host text input |

### 3.4 Host Renderer Hints

Non-prescriptive guidance for renderer implementors. This section is informational and may be
overridden by platform-specific renderer specs.

| ViewNode property | Suggested host concept | Conversion notes |
|-------------------|----------------------|-----------------|
| `textColor` | foreground colour | Android: 0xAARRGGBB int |
| `lp_width = -1` | fill parent / expand | MATCH_PARENT |
| `lp_width = -2` | shrink to content | WRAP_CONTENT |
| `orientation = 0` | horizontal container | HORIZONTAL |
| `orientation = 1` | vertical container | VERTICAL |

---

## 4. Spec Inventory

### 4.1 Priority Definitions

| Level | Criterion | App impact |
|-------|-----------|-----------|
| **P0** | Required for any non-trivial UI to render correctly | Blocking: without these, current demos have layout errors |
| **P1** | Required for a typical interactive app | ~60 % of Play Store apps depend on at least one P1 spec |
| **P2** | Required for mainstream productivity / CRUD apps | ~85 % cumulative with P0+P1 |
| **P3** | Required for rich / complex apps | ~92 % cumulative; diminishing returns |

### 4.2 P0 — Foundation (8 specs)

These must be completed before any real-world app can be said to work correctly. Several are
partially implemented; the spec documents the *complete* required surface, not the current state.

| # | Spec name | Android classes | Status |
|---|-----------|----------------|--------|
| P0-1 | View base properties | `android.view.View` | Partial |
| P0-2 | LayoutParams family | `android.view.ViewGroup.LayoutParams`, `android.view.ViewGroup.MarginLayoutParams` | Missing |
| P0-3 | LinearLayout.LayoutParams | `android.widget.LinearLayout.LayoutParams` | Missing |
| P0-4 | TextView complete | `android.widget.TextView` | Partial |
| P0-5 | Activity + Context complete | `android.app.Activity`, `android.content.Context`, `android.content.ContextWrapper` | Partial |
| P0-6 | Resource resolution | `android.content.res.Resources`, `android.content.res.TypedArray`, `android.util.TypedValue` | Missing |
| P0-7 | Event model foundation | `android.view.View.OnClickListener`, `android.view.View.OnLongClickListener`, `android.view.View.OnFocusChangeListener`, `android.view.View.OnTouchListener` | Partial (click only) |
| P0-8 | View styling | `android.graphics.Color`, background / foreground colour, padding, enabled, focusable | Missing |

**P0-1 — View base properties**

_API surface (additions to current)_

| Method | Signature | ViewNode key |
|--------|-----------|-------------|
| `setWidth(int)` | `(I)V` | `width` |
| `setHeight(int)` | `(I)V` | `height` |
| `setPadding(int,int,int,int)` | `(IIII)V` | `paddingLeft`, `paddingTop`, `paddingRight`, `paddingBottom` |
| `setPaddingRelative(int,int,int,int)` | `(IIII)V` | `paddingStart`, `paddingTop`, `paddingEnd`, `paddingBottom` |
| `setEnabled(boolean)` | `(Z)V` | `enabled` |
| `isEnabled()` | `()Z` | reads `enabled` |
| `setFocusable(boolean)` | `(Z)V` | `focusable` |
| `setBackground(Drawable)` | `(Landroid/graphics/drawable/Drawable;)V` | `backgroundDrawable` (opaque ref) |
| `setBackgroundColor(int)` | `(I)V` | `backgroundColor` (ARGB int) |
| `setBackgroundResource(int)` | `(I)V` | `backgroundResource` (R id int) |
| `setAlpha(float)` | `(F)V` | `alpha` |
| `getWidth()` | `()I` | reads `width` |
| `getHeight()` | `()I` | reads `height` |
| `getMeasuredWidth()` | `()I` | reads `measuredWidth` (0 if unmeasured) |
| `getMeasuredHeight()` | `()I` | reads `measuredHeight` |
| `getTag()` | `()Ljava/lang/Object;` | reads `tag` |
| `setTag(Object)` | `(Ljava/lang/Object;)V` | `tag` |
| `setContentDescription(CharSequence)` | `(Ljava/lang/CharSequence;)V` | `contentDescription` |

**P0-2 — LayoutParams family**

LayoutParams are attached to a child View and describe how the parent container should size and
position that child. They are passed to `addView(View, LayoutParams)`.

| Constructor | Signature | ViewNode keys on child |
|-------------|-----------|----------------------|
| `LayoutParams(int w, int h)` | `(II)V` | `lp_width`, `lp_height` |
| `MarginLayoutParams(int w, int h)` | `(II)V` | `lp_width`, `lp_height` |
| `setMargins(int,int,int,int)` | `(IIII)V` | `lp_margin_left`, `lp_margin_top`, `lp_margin_right`, `lp_margin_bottom` |
| `setMarginStart(int)` | `(I)V` | `lp_margin_start` |
| `setMarginEnd(int)` | `(I)V` | `lp_margin_end` |

Sentinel values for `lp_width` / `lp_height`:

| Sentinel | Value | Meaning |
|----------|-------|---------|
| `MATCH_PARENT` | `-1` | Fill available space |
| `WRAP_CONTENT` | `-2` | Shrink to intrinsic content size |
| `> 0` | pixels | Absolute size in pixels (convert to dp at render time) |

**P0-3 — LinearLayout.LayoutParams**

| Constructor / field | Signature | ViewNode key on child |
|--------------------|-----------|-----------------------|
| `LinearLayout.LayoutParams(int w, int h)` | `(II)V` | `lp_width`, `lp_height` |
| `LinearLayout.LayoutParams(int w, int h, float weight)` | `(IIF)V` | `lp_width`, `lp_height`, `lp_weight` |
| `weight` field write | `(F)` | `lp_weight` |
| `gravity` field write | `(I)` | `lp_gravity` |

**P0-4 — TextView complete** (additions to current)

| Method | Signature | ViewNode key |
|--------|-----------|-------------|
| `setHint(CharSequence)` | `(Ljava/lang/CharSequence;)V` | `hint` |
| `getHint()` | `()Ljava/lang/CharSequence;` | reads `hint` |
| `setGravity(int)` | `(I)V` | `gravity` |
| `setLines(int)` | `(I)V` | `lines` |
| `setMaxLines(int)` | `(I)V` | `maxLines` |
| `setSingleLine(boolean)` | `(Z)V` | `singleLine` |
| `setEllipsize(TruncateAt)` | `(Landroid/text/TextUtils$TruncateAt;)V` | `ellipsize` (enum ordinal) |
| `setTypeface(Typeface)` | `(Landroid/graphics/Typeface;)V` | `typefaceStyle` (int) |
| `setTextAlignment(int)` | `(I)V` | `textAlignment` |
| `append(CharSequence)` | `(Ljava/lang/CharSequence;)V` | appends to `text` |

**P0-5 — Activity + Context complete** (additions to current)

| Method | Signature | Behaviour |
|--------|-----------|-----------|
| `getString(int)` | `(I)Ljava/lang/String;` | Look up R.string by id → return string |
| `getString(int, Object...)` | `(I[Ljava/lang/Object;)Ljava/lang/String;` | Formatted string |
| `getColor(int)` | `(I)I` | Look up R.color → return ARGB int |
| `getDimension(int)` | `(I)F` | Look up R.dimen → return float pixels |
| `getDrawable(int)` | `(I)Landroid/graphics/drawable/Drawable;` | Look up R.drawable → return Drawable ref |
| `getResources()` | `()Landroid/content/res/Resources;` | Return Resources shim |
| `getPackageName()` | `()Ljava/lang/String;` | Return manifest package name |
| `getSystemService(String)` | `(Ljava/lang/String;)Ljava/lang/Object;` | Return stub service |
| `runOnUiThread(Runnable)` | `(Ljava/lang/Runnable;)V` | Execute runnable via timer queue (immediate) |
| `startActivity(Intent)` | `(Landroid/content/Intent;)V` | Dispatch to activity router |

**P0-6 — Resource resolution**

The Android resource system maps integer IDs (`R.string.foo`, `R.color.bar`) to values stored in
the APK's `resources.arsc` binary. This is a self-contained subsystem.

| Capability | Input | Output |
|-----------|-------|--------|
| String lookup | R id (int) | UTF-16 string |
| Plural string lookup | R id + quantity | UTF-16 string |
| Colour lookup | R id | ARGB int |
| Dimension lookup | R id | float (pixels) |
| Integer lookup | R id | int |
| Boolean lookup | R id | boolean |
| Drawable reference lookup | R id | path or encoded data |

Note: `resources.arsc` parsing is independent of DEX parsing and is a prerequisite for any app
that uses `R.` constants (which is the vast majority).

**P0-7 — Event model foundation** (additions to current)

| Android interface | Method | Dispatch trigger | Return value |
|------------------|--------|-----------------|-------------|
| `OnClickListener` | `onClick(View)` | host tap | void |
| `OnLongClickListener` | `onLongClick(View)` | host long-press | boolean (consumed) |
| `OnFocusChangeListener` | `onFocusChange(View, boolean)` | host focus in/out | void |
| `OnTouchListener` | `onTouch(View, MotionEvent)` | host touch | boolean (consumed) |
| `OnKeyListener` | `onKey(View, int, KeyEvent)` | hardware key | boolean (consumed) |

`MotionEvent` and `KeyEvent` shims are stubs that carry action, x/y, and keyCode.

**P0-8 — View styling**

| Concept | Android API | ViewNode key | Notes |
|---------|------------|-------------|-------|
| Background colour | `setBackgroundColor(int)` | `backgroundColor` | ARGB int |
| Alpha | `setAlpha(float)` | `alpha` | 0.0–1.0 |
| Visibility | existing | `visibility` | 0=VISIBLE, 4=INVISIBLE, 8=GONE |
| Elevation | `setElevation(float)` | `elevation` | dp |
| Translation | `setTranslationX/Y(float)` | `translationX`, `translationY` | dp |
| Scale | `setScaleX/Y(float)` | `scaleX`, `scaleY` | 1.0=no scale |
| Rotation | `setRotation(float)` | `rotation` | degrees |

`android.graphics.Color` static methods must be shimmed:

| Method | Behaviour |
|--------|-----------|
| `Color.rgb(r,g,b)` | Returns `0xFF000000 \| (r<<16) \| (g<<8) \| b` |
| `Color.argb(a,r,g,b)` | Returns `(a<<24) \| (r<<16) \| (g<<8) \| b` |
| `Color.red(c)` / `green(c)` / `blue(c)` / `alpha(c)` | Bit extraction |
| `Color.parseColor(String)` | Parse `#RRGGBB` / `#AARRGGBB` |

---

### 4.3 P1 — Core Interactive Apps (10 specs)

| # | Spec name | Android classes |
|---|-----------|----------------|
| P1-1 | EditText + input model | `android.widget.EditText`, `android.text.InputType`, `android.text.TextWatcher`, `android.text.Editable` |
| P1-2 | ImageView | `android.widget.ImageView`, `android.widget.ImageView.ScaleType` |
| P1-3 | FrameLayout | `android.widget.FrameLayout`, `android.widget.FrameLayout.LayoutParams` |
| P1-4 | ScrollView family | `android.widget.ScrollView`, `android.widget.HorizontalScrollView`, `androidx.core.widget.NestedScrollView` |
| P1-5 | Intent + Bundle complete | `android.content.Intent`, `android.os.Bundle` (full) |
| P1-6 | AlertDialog | `android.app.AlertDialog`, `android.app.AlertDialog.Builder`, `android.content.DialogInterface` |
| P1-7 | Toast + Snackbar | `android.widget.Toast`, `com.google.android.material.snackbar.Snackbar` |
| P1-8 | Compound buttons | `android.widget.CompoundButton`, `android.widget.CheckBox`, `android.widget.RadioButton`, `android.widget.RadioGroup` |
| P1-9 | Progress + Seek | `android.widget.ProgressBar`, `android.widget.SeekBar`, `android.widget.SeekBar.OnSeekBarChangeListener` |
| P1-10 | Toggle controls | `android.widget.Switch`, `android.widget.ToggleButton` |

**P1-1 — EditText + input model** (key methods)

| Method | ViewNode key |
|--------|-------------|
| `setText(CharSequence)` | `text` |
| `getText()` | reads `text` → wraps in Editable shim |
| `setHint(CharSequence)` | `hint` |
| `setInputType(int)` | `inputType` (InputType bitmask) |
| `addTextChangedListener(TextWatcher)` | stored in shim; fires on host input |
| `removeTextChangedListener(TextWatcher)` | removes from list |
| `setSelection(int)` | `selectionStart`, `selectionEnd` |
| `setSelection(int,int)` | `selectionStart`, `selectionEnd` |
| `selectAll()` | `selectionStart=0`, `selectionEnd=length` |
| `setImeOptions(int)` | `imeOptions` |
| `setImeActionLabel(CharSequence,int)` | `imeActionLabel` |
| `setMaxLength(int)` (via InputFilter) | `maxLength` |

TextWatcher must be invoked with three calls: `beforeTextChanged`, `onTextChanged`,
`afterTextChanged`. Only the final call carries the authoritative Editable.

**P1-5 — Intent + Bundle complete**

| Intent method | Behaviour |
|--------------|-----------|
| `new Intent(Context, Class)` | explicit intent; store target class name |
| `new Intent(String action)` | implicit intent; store action string |
| `putExtra(String, *)` | store in extras Bundle |
| `getStringExtra(String)` | retrieve from extras |
| `getIntExtra(String, int)` | retrieve with default |
| `getBooleanExtra(String, boolean)` | retrieve with default |
| `getSerializableExtra(String)` | retrieve serialisable (heap ref) |
| `setFlags(int)` | store flags int |
| `addFlags(int)` | OR into flags int |
| `getAction()` | return action string |
| `setData(Uri)` | store URI string |
| `getData()` | return URI string |
| `getComponent()` | return ComponentName shim |

Bundle must be expanded to cover all primitive + array types:
`putInt`, `putLong`, `putFloat`, `putDouble`, `putBoolean`, `putStringArray`,
`putIntArray`, `getInt`, `getLong`, … with matching defaults.

---

### 4.4 P2 — Mainstream Apps (12 specs)

| # | Spec name | Android classes |
|---|-----------|----------------|
| P2-1 | RelativeLayout | `android.widget.RelativeLayout`, `android.widget.RelativeLayout.LayoutParams` |
| P2-2 | Spinner + Adapter | `android.widget.Spinner`, `android.widget.ArrayAdapter`, `android.widget.AdapterView`, `android.widget.AdapterView.OnItemSelectedListener` |
| P2-3 | RecyclerView | `androidx.recyclerview.widget.RecyclerView`, `RecyclerView.Adapter`, `RecyclerView.ViewHolder`, `RecyclerView.LayoutManager`, `LinearLayoutManager`, `GridLayoutManager` |
| P2-4 | Handler + Looper | `android.os.Handler`, `android.os.Looper`, `android.os.Message`, `android.os.MessageQueue` |
| P2-5 | Fragment | `androidx.fragment.app.Fragment`, `FragmentManager`, `FragmentTransaction`, `FragmentActivity` |
| P2-6 | SharedPreferences | `android.content.SharedPreferences`, `SharedPreferences.Editor` |
| P2-7 | Menu + Toolbar | `android.view.Menu`, `android.view.MenuItem`, `android.view.MenuInflater`, `androidx.appcompat.widget.Toolbar`, `android.app.ActionBar` |
| P2-8 | ViewPager | `androidx.viewpager2.widget.ViewPager2`, `androidx.viewpager.widget.ViewPager`, `PagerAdapter`, `FragmentPagerAdapter` |
| P2-9 | Tab + Bottom nav | `com.google.android.material.tabs.TabLayout`, `com.google.android.material.bottomnavigation.BottomNavigationView` |
| P2-10 | Navigation drawer | `androidx.drawerlayout.widget.DrawerLayout`, `com.google.android.material.navigation.NavigationView` |
| P2-11 | Async execution | `android.os.AsyncTask` (deprecated but common), `java.util.concurrent.Executor`, `java.util.concurrent.Future` |
| P2-12 | Notifications (stub) | `android.app.NotificationManager`, `android.app.NotificationChannel`, `androidx.core.app.NotificationCompat` |

**P2-3 — RecyclerView** is the most complex single spec. Key design decisions:

- The Adapter is a DEX class. `onCreateViewHolder` and `onBindViewHolder` must be invoked via the
  interpreter for each visible item.
- The LayoutManager determines scroll direction and item arrangement. Start with `LinearLayoutManager`
  (vertical list) as the common case.
- The host renderer needs a virtualised list component. If the host lacks one, a simpler non-
  virtualised approach (render all items) is acceptable for initial compatibility.
- `notifyDataSetChanged()` triggers full re-render. `notifyItemChanged/Inserted/Removed()` can be
  treated as `notifyDataSetChanged()` in a first implementation.

**P2-4 — Handler + Looper**

Android apps use `Handler.post(Runnable)` and `Handler.postDelayed(Runnable, long)` extensively
for deferred UI updates. The shim must maintain a timer queue (equivalent to a priority queue
ordered by fire time) checked at regular intervals (e.g. 50 ms polling or native timer per entry).

| Method | Behaviour |
|--------|-----------|
| `new Handler()` / `new Handler(Looper)` | Create handler bound to main looper |
| `post(Runnable)` | Enqueue runnable with delay=0 |
| `postDelayed(Runnable, long)` | Enqueue runnable with delay |
| `postAtTime(Runnable, long)` | Enqueue runnable at absolute time |
| `removeCallbacks(Runnable)` | Remove all pending entries for runnable |
| `sendMessage(Message)` | Enqueue message for `handleMessage` |
| `sendEmptyMessage(int)` | Enqueue empty message with what |
| `sendEmptyMessageDelayed(int, long)` | Delayed empty message |

`Looper.getMainLooper()` and `Looper.myLooper()` both return a singleton stub. There is no real
thread separation; all execution is on the runtime's single thread.

**P2-6 — SharedPreferences**

| Method | Behaviour |
|--------|-----------|
| `getSharedPreferences(String, int)` | Return named preference store |
| `getDefaultSharedPreferences(Context)` | Return default store |
| `getString/Int/Long/Float/Boolean/StringSet` | Read from in-memory map |
| `Editor.putString/…` | Write to pending map |
| `Editor.apply()` / `Editor.commit()` | Flush pending map to persistent store |
| `Editor.remove(String)` | Mark key for removal |
| `Editor.clear()` | Mark all keys for removal |
| `registerOnSharedPreferenceChangeListener` | Store listener |

The persistent store can be implemented as a key-value file (JSON, SQLite, or platform KV store).
The in-memory map is the source of truth during a session.

---

### 4.5 P3 — Rich / Complex Apps (10 specs)

| # | Spec name | Android classes |
|---|-----------|----------------|
| P3-1 | ConstraintLayout | `androidx.constraintlayout.widget.ConstraintLayout`, `ConstraintLayout.LayoutParams` |
| P3-2 | Custom View / Canvas | `android.view.View` (onDraw), `android.graphics.Canvas`, `android.graphics.Paint`, `android.graphics.Path` |
| P3-3 | Bitmap + BitmapFactory | `android.graphics.Bitmap`, `android.graphics.BitmapFactory`, `android.graphics.BitmapFactory.Options` |
| P3-4 | Drawable hierarchy | `android.graphics.drawable.Drawable`, `ColorDrawable`, `BitmapDrawable`, `LayerDrawable`, `StateListDrawable`, `GradientDrawable` |
| P3-5 | Property animation | `android.animation.ObjectAnimator`, `android.animation.ValueAnimator`, `android.animation.AnimatorSet`, `android.view.ViewPropertyAnimator` |
| P3-6 | Gesture detection | `android.view.GestureDetector`, `android.view.ScaleGestureDetector`, `android.view.MotionEvent` (full) |
| P3-7 | WebView (stub) | `android.webkit.WebView`, `android.webkit.WebSettings`, `android.webkit.WebViewClient` |
| P3-8 | Sensor (stub) | `android.hardware.SensorManager`, `android.hardware.Sensor`, `android.hardware.SensorEventListener` |
| P3-9 | Location (stub) | `android.location.LocationManager`, `android.location.Location`, `android.location.LocationListener` |
| P3-10 | Camera (stub) | `androidx.camera.core.*` — return "not supported" / display placeholder |

P3-7 through P3-10 are intentionally stubs. These APIs depend on hardware or host-platform
subsystems that cannot be meaningfully translated to a generic UI framework. They should
gracefully degrade: return empty/null values and not throw exceptions, allowing apps that
feature-detect these APIs to fall back gracefully.

**P3-1 — ConstraintLayout** is algorithmically complex (requires a constraint solver). Acceptable
first-pass approaches:

1. Ignore constraints; render children in declaration order in a Column (produces wrong layout but
   no crash).
2. Translate a subset of common constraint patterns (centre in parent, match parent edges) to host
   layout equivalents.
3. Implement a full Cassowary-variant solver.

Start with approach 1 and promote to 2 based on real-app testing.

---

### 4.6 Java Standard Library (6 specs)

These are independent of the visual translation pipeline but are required for correct behavioural
translation.

| # | Spec name | Java classes |
|---|-----------|-------------|
| S1 | Collections | `java.util.ArrayList`, `java.util.LinkedList`, `java.util.Iterator`, `java.util.ListIterator`, `java.util.Collections` |
| S2 | Maps | `java.util.HashMap`, `java.util.LinkedHashMap`, `java.util.TreeMap`, `java.util.Map.Entry` |
| S3 | Primitive wrappers | `java.lang.Integer`, `java.lang.Long`, `java.lang.Float`, `java.lang.Double`, `java.lang.Boolean`, `java.lang.Character`, `java.lang.Byte`, `java.lang.Short` |
| S4 | Math + Number | `java.lang.Math`, `java.lang.Number`, `java.lang.Comparable` |
| S5 | Threading stubs | `java.lang.Thread`, `java.lang.Runnable`, `java.lang.Throwable`, `java.lang.Exception`, `java.util.concurrent.atomic.*` |
| S6 | I/O basics | `java.io.InputStream`, `java.io.OutputStream`, `java.io.ByteArrayInputStream`, `java.io.ByteArrayOutputStream`, `java.io.PrintStream` |

**S1 and S2** are the most critical. Android apps use `ArrayList` and `HashMap` pervasively as
fields and local variables. Both must support the full `java.util.List` / `java.util.Map` interface
including `iterator()`, enhanced `for` (which the compiler desugars to `iterator()` calls), and
`Collections.sort()`.

**S3 — Primitive wrappers** must support both the object form and the static utility methods:

| Class | Key static methods |
|-------|--------------------|
| `Integer` | `parseInt(String)`, `parseInt(String,int)`, `valueOf(int)`, `toString(int)`, `toBinaryString`, `toHexString`, `MAX_VALUE`, `MIN_VALUE` |
| `Long` | `parseLong(String)`, `valueOf(long)`, `toString(long)` |
| `Float` | `parseFloat(String)`, `valueOf(float)`, `isNaN(float)`, `isInfinite(float)` |
| `Double` | `parseDouble(String)`, `valueOf(double)`, `isNaN`, `isInfinite` |
| `Boolean` | `parseBoolean(String)`, `valueOf(boolean)`, `TRUE`, `FALSE` |

Auto-boxing and unboxing are handled by the bytecode interpreter (the `int-to-object` / `check-cast`
opcodes drive these), but the wrapper class shims must be correct.

---

## 5. Coverage Model

The relationship between spec completion and app compatibility is non-linear. The first few specs
unlock a disproportionately large fraction of apps.

```
Completed specs    Approx. % of translatable apps that run correctly
──────────────────────────────────────────────────────────────────────
P0 (8 specs)       ~35 %   (current demos work correctly, not by luck)
P0 + P1 (18)       ~60 %   (most simple utility apps, simple CRUD)
P0 + P1 + S1-S3    ~68 %   (CRUD apps that use collections)
P0–P1 + S1-S6      ~72 %
P0–P2 + S1-S6      ~85 %   (most mainstream Play Store apps)
P0–P3 + S1-S6      ~92 %   (nearly all non-game, non-camera apps)
```

These figures assume apps that only use the Android View system (no OpenGL, no JNI, no
proprietary SDKs). See Section 6 for hard exclusions.

---

## 6. Hard Exclusions

The following categories of app cannot be translated regardless of spec completeness.

| Category | Reason |
|----------|--------|
| OpenGL ES / Vulkan games | Rendering model is fundamentally incompatible with a retained-mode UI framework. `SurfaceView` / `GLSurfaceView` have no host-framework equivalent. |
| Camera apps | Camera2 / CameraX APIs depend on hardware access that is not abstracted. The stub approach (Section 4.5) allows apps to detect and degrade, but not to function. |
| JNI apps | Native code (`.so` libraries) cannot be executed in a bytecode interpreter. Apps with native encryption, codecs, or game engines are excluded. |
| Apps using proprietary SDKs | Google Play Services, Firebase, Maps SDK, etc. are not open-source and cannot be shimmed without reverse engineering. |
| Apps using Kotlin coroutines intrinsics | Some coroutine infrastructure uses compiler intrinsics and runtime hooks not expressed in standard bytecode. |
| `android.webkit.WebView` (functional) | A functional WebView requires a full browser engine on the host platform. Stub-only coverage (P3-7) is the ceiling. |
| Audio / Media playback | `MediaPlayer`, `AudioTrack`, `ExoPlayer` depend on platform codecs. Stub-only coverage is appropriate. |

---

## 7. Invariants and Design Rules

These rules must be preserved by any implementation regardless of language or target platform.

### 7.1 ViewNode property keys are the global contract

The property key names defined in the spec inventory (Sections 4.2–4.4) are the sole interface
between Layer 2 (shims) and Layer 3/4 (renderer). They must not be changed without a versioned
migration. New keys must be added to the spec before being written by any shim.

### 7.2 LayoutParams are stored on the child, not the parent

When `addView(child, layoutParams)` is called, the layout parameters are extracted and written as
`lp_*` keys on the **child** node. This mirrors Android's own design and allows the renderer to
apply sizing and margin constraints without referencing the parent.

### 7.3 State serialisation must produce plain records

The intermediate view tree passed to the host renderer must contain only plain data structures
(no references to runtime objects, no mutable containers, no function values). This ensures the
snapshot can be safely passed across any IPC, serialisation, or reactivity boundary.

### 7.4 Event callbacks are registered in the shim layer and invoked via the interpreter

When an Android event listener is registered (e.g. `setOnClickListener`), the shim stores a
reference to the listener object and a reference to the interpreter. When the host fires an event,
the shim invokes the interpreter to execute the listener's method. The host renderer never calls
Android bytecode directly.

### 7.5 The timer queue is the only threading primitive

Android apps use `Handler.postDelayed`, `View.postDelayed`, and similar APIs for deferred
execution. These must be implemented as a timer queue checked at regular intervals (≤ 100 ms
polling or equivalent platform timer). There is no multi-threading inside the compatibility
runtime; all bytecode execution is serialised on a single thread.

### 7.6 Resource IDs must be stable within a session

The resource resolution subsystem (P0-6) assigns integer IDs to resources during APK loading.
These IDs must remain stable for the lifetime of the session, as bytecode may cache them in
static fields.

### 7.7 Graceful degradation over hard failure

Unimplemented APIs must return a sensible default (null, 0, false, empty string) and log a
warning rather than throw an exception. Many Android apps call APIs speculatively or check return
values before use. A missing shim should never crash the runtime.

---

## 8. Spec Completion Summary

| Group | Count | Status |
|-------|-------|--------|
| P0 — Foundation | 8 | Partially implemented; spec not yet complete |
| P1 — Core interactive | 10 | Not implemented |
| P2 — Mainstream | 12 | Not implemented |
| P3 — Rich / complex | 10 | Not implemented (stubs only for P3-7 to P3-10) |
| Java stdlib | 6 | Partially implemented (String, StringBuilder, basic Object) |
| **Total** | **46** | |

---

## 9. References

- [architecture.md](architecture.md) — System overview and data flow
- [specification.md](specification.md) — Component API reference (current implementation)
- [arkui_rendering_spec.md](arkui_rendering_spec.md) — ArkUI-specific Layer 4 rendering patterns
- [api_mapping_report.md](api_mapping_report.md) — Detailed current shim inventory
- Dalvik bytecode reference: `../android/dalvik/docs/` (local AOSP checkout)
- Android View source: `../android/frameworks/base/core/java/android/view/` (local AOSP checkout)
- Android Widget source: `../android/frameworks/base/core/java/android/widget/` (local AOSP checkout)

---

**Android API stability note:** The core `android.view.*` and `android.widget.*` classes covered
in this document have been stable since Android 5.0 (API 21, 2014). Apps targeting API 21+ using
these classes will benefit from this spec without modification. AndroidX / Jetpack Compose is a
separate, newer API surface not covered here.

**Last updated:** 2026-03-12
