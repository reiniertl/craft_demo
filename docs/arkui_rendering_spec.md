# ArkUI Rendering Specification

**CRAFT** - Compatibility Runtime for Android Framework Translation

This document specifies the patterns and constraints governing how CRAFT renders Android Views as ArkUI components on OpenHarmony. These patterns were established through device testing and iteration.

---

## Overview

CRAFT bridges two fundamentally different UI models:

- **Android:** Mutable `View` objects in a class hierarchy, modified by Java bytecode at runtime
- **ArkUI:** Declarative, reactive components driven by immutable state snapshots

The bridge requires serialization, a reactivity layer, and strict initialization ordering to work correctly.

---

## Pattern 1: Initialization Order (Critical)

The sequence in `EntryAbility.onWindowStageCreate()` is load-bearing. Deviating from it causes the page to miss state updates or fail to find the runtime.

```
1. new CraftRuntime()
2. runtime.loadAPK(data)          ← sync, must complete before page loads
3. AppStorage.setOrCreate('craftRuntime', runtime)
4. AppStorage.setOrCreate('craftViewTree', null)
5. AppStorage.setOrCreate('craftUpdateCounter', 0)
6. windowStage.loadContent('pages/CraftPage', callback)
   │
   └── [ArkUI creates CraftPage]
       └── aboutToAppear() runs
           └── stateManager.subscribe(...)  ← page is now listening
7. [inside loadContent callback]
   runtime.createActivity()        ← calls onCreate → setContentView → notifies page
   runtime.resumeActivity()
```

**Why this order:**
- `AppStorage` entries must exist before `loadContent()` because `@StorageLink` bindings resolve at component construction time.
- The page must subscribe before `createActivity()` is called, otherwise `setContentView()` fires a state notification that no subscriber catches.
- APK loading is synchronous to avoid a race between the file read and page construction.

---

## Pattern 2: AppStorage as Cross-Boundary Bus

ArkUI `@State` mutations from outside the component (e.g. from `EntryAbility` or callbacks) are not reliably observed. The only reliable mechanism to share live state across the Ability↔Page boundary is `AppStorage`.

**Ability side (write):**
```typescript
AppStorage.setOrCreate('craftRuntime', this.runtime);
AppStorage.setOrCreate('craftViewTree', state.root);
AppStorage.setOrCreate('craftUpdateCounter', state.version);
```

**Page side (read, reactive):**
```typescript
@StorageLink('craftRuntime') runtime: CraftRuntime | null = null;
@StorageLink('craftViewTree') viewTree: SerializedView | null = null;
@StorageLink('craftUpdateCounter') updateCounter: number = 0;
```

**Inside external callbacks, always use `AppStorage.setOrCreate()`** — do not assign to `this.someState` directly, as ArkUI's change detection does not observe mutations made from outside the component's synchronous execution path.

---

## Pattern 3: Version Counter for Reactivity

ArkUI's `@StorageLink` observes reference equality for objects. Setting the same object reference (even with mutated contents) does not trigger a re-render.

**Solution:** Maintain a monotonically increasing integer (`craftUpdateCounter`). The StateManager increments it on every tree change. The page's `@StorageLink('craftUpdateCounter')` binding detects the new integer value and triggers `build()`.

```typescript
// StateManager.setRootView() / notifyUpdate():
this.viewState = {
  version: this.viewState.version + 1,   // integer change → ArkUI sees it
  root: this.serializeViewTree(node)
};
```

The `viewTree` object itself is also replaced (new reference) on every update for the same reason.

---

## Pattern 4: Serialization Boundary (ViewNode → SerializedView)

ArkUI's reactivity system cannot observe mutations to `Map` instances or custom class instances stored in `AppStorage`. All data passed to ArkUI must be plain objects (`Record<K,V>`, not `Map<K,V>`).

```
Android runtime side              ArkUI side
─────────────────────             ──────────────────────
ViewNode {                        SerializedView {
  viewType: string                  type: string
  properties: Map<string, V>   →    props: Record<string, V>
  children: ViewNode[]              children: SerializedView[]
  parent: ViewNode | null           id: string
  arkuiId: string               }
}
```

Serialization happens in `StateManager.serializeViewTree()` every time any property changes. The serialized tree is stored in `AppStorage` as a POJO.

---

## Pattern 5: ForEach with Content-Keyed Identity

ArkUI `ForEach` uses a key function to decide whether to reuse or recreate components. If the key only uses the item's stable ID, ArkUI reuses the old component even when its data has changed.

**Key must include dynamic content:**
```typescript
private viewKey(child: SerializedView): string {
  const text = child.props?.text !== undefined ? String(child.props.text) : '';
  return `${child.id}_${text}_${child.children.length}_v${this.updateCounter}`;
}
```

- `child.id` — stable identity
- `text` — forces recreation when text changes (e.g. calculator display)
- `child.children.length` — forces recreation when children are added/removed
- `updateCounter` — version suffix ensures recreation on any state change

**Root view also wrapped in ForEach:**
```typescript
ForEach([this.viewTree], (view: SerializedView) => {
  this.renderView(view);
}, (view: SerializedView) => this.viewKey(view))
```

This ensures the root component is recreated when its content changes, not just its children.

---

## Pattern 6: @Builder Recursive Dispatch

ArkUI does not support direct recursion in `@Builder` methods. The pattern that works is a dispatcher `@Builder` that delegates to type-specific `@Builder` methods, which then call the dispatcher for children.

```typescript
@Builder
renderView(view: SerializedView) {
  if (view.type === 'TextView')     { this.renderTextView(view); }
  else if (view.type === 'Button')  { this.renderButton(view); }
  else if (view.type === 'LinearLayout') { this.renderLinearLayout(view); }
  else if (view.type === 'ViewGroup')    { this.renderViewGroup(view); }
  else { Text(`Unknown: ${view.type}`).fontColor('#FF0000') }
}

@Builder
renderLinearLayout(view: SerializedView) {
  Column() {
    ForEach(view.children, (child: SerializedView) => {
      this.renderView(child);   // recursive dispatch back through renderView
    }, (child: SerializedView) => this.viewKey(child))
  }
}
```

**Important:** `@Builder` methods cannot return values and cannot be called as expressions. They must be called as statements inside another `@Builder` or `build()`.

---

## Pattern 7: Android View → ArkUI Component Mapping

| Android View | ArkUI Component | Properties Mapped | Notes |
|---|---|---|---|
| `TextView` | `Text()` | `text`, `textSize`, `textColor` | |
| `Button` | `Button()` + `.onClick()` | `text`, `textSize`, `textColor` | Click dispatched via UIBridge |
| `LinearLayout` (orientation=1) | `Column()` | `orientation`, children | VERTICAL |
| `LinearLayout` (orientation=0) | `Row()` | `orientation`, children | HORIZONTAL |
| `ViewGroup` | `Column()` | children | Fallback for unknown containers |

### Property extraction helpers

ArkTS requires explicit type handling; props are `Record<string, string | number | boolean>`:

```typescript
private getViewPropString(view: SerializedView, key: string, fallback: string): string {
  const val = view.props[key];
  return (val !== undefined && val !== null) ? String(val) : fallback;
}

private getViewPropNumber(view: SerializedView, key: string, fallback: number): number {
  const val = view.props[key];
  return (val !== undefined && val !== null) ? Number(val) : fallback;
}
```

### Color conversion: Android ARGB → ArkUI rgba string

Android encodes colors as 32-bit `0xAARRGGBB` integers. ArkUI expects CSS-style strings.

```typescript
private intToColor(argb: number | undefined): string {
  if (argb === undefined) return '#FF000000';
  const a = (argb >> 24) & 0xFF;
  const r = (argb >> 16) & 0xFF;
  const g = (argb >> 8)  & 0xFF;
  const b =  argb        & 0xFF;
  return `rgba(${r},${g},${b},${a / 255})`;
}
```

---

## Pattern 8: Click Dispatch Chain

ArkUI click events must travel back through UIBridge to execute Dalvik bytecode.

```
ArkUI Button.onClick()
  │
  ├── extract viewRef: parseInt(view.id.replace('view_', ''))
  │
  ├── UIBridge.dispatchClick(viewRef)
  │     │
  │     └── clickCallbacks.get(viewRef)()   ← stored by setOnClickListener shim
  │           │
  │           └── Interpreter executes Dalvik onClick() bytecode
  │                 │
  │                 └── Android code calls setText(), etc.
  │                       │
  │                       └── UIBridge.updateViewProperty()
  │                             │
  │                             └── StateManager increments version
  │                                   │
  │                                   └── CraftPage re-renders
```

**Click callback registration** (in View shim):
```typescript
registry.register('Landroid/view/View;', 'setOnClickListener', ...,
  (interp, heap, thisRef, [listenerRef]) => {
    uiBridge.setClickCallback(thisRef, () => {
      // invoke listener.onClick(view) via interpreter
    });
    return NULL_VALUE;
  });
```

---

## Pattern 9: Timer Queue for View.post / View.postDelayed

ArkTS has no `Handler`/`Looper`. Android apps use `View.postDelayed(runnable, delayMs)` for deferred updates (e.g. clock tick). CRAFT implements this via a polling timer queue in UIBridge.

```typescript
// UIBridge maintains:
private pendingTimers: PendingTimer[] = [];
private pollingHandle: number = -1;   // setInterval handle

// On scheduleTimer():
this.pendingTimers.push({ viewRef, runnableRef, callback, fireAt: Date.now() + delayMs });
this.pollingHandle = setInterval(() => this.processPendingTimers(), 50);

// processPendingTimers():
// Fire all timers where fireAt <= Date.now(), remove from queue
// Stop polling when queue is empty
```

**Polling interval:** 50ms (20 Hz). Adequate for UI-level animation; not for high-precision timing.

**Cancellation:** `cancelTimersForRunnable(viewRef, runnableRef)` matches the Android `removeCallbacks(runnable)` API.

---

## Pattern 10: Diagnostic Timeout

Since Activity creation can fail silently (the page would show a loading spinner forever), a 3-second diagnostic timeout is used to surface errors:

```typescript
this.diagTimer = setTimeout(() => {
  if (this.isLoading) {
    this.errorMessage = this.craftError || 'Activity creation timed out.';
    this.isLoading = false;
  }
}, 3000);
```

`craftError` is set in AppStorage by the Ability if Activity creation throws. The page picks it up via `@StorageLink('craftError')`.

---

## Page State Machine

```
            aboutToAppear()
                  │
          ┌───────┴──────────┐
          │                  │
     runtime=null      runtime available
          │                  │
    isLoading=false    subscribe to state
    error='Runtime     wait for notification
     not available'         │
          │            ┌────┴──────┐
          │            │           │
          │         root arrives  3s timeout
          │            │           │
          │       isLoading=false  isLoading=false
          │       render viewTree  show error
          │
    ┌─────┴─────┐
    │  build()  │
    ├───────────┤
    │ isLoading │ → loadingView()
    │ errorMsg  │ → errorView()
    │ viewTree  │ → ForEach → renderView()
    │ (none)    │ → emptyView()
    └───────────┘
```

---

## Adding a New View Type

To add support for a new Android View (e.g. `ImageView`):

1. **Shim** (`src/shim/android/widget/image_view.ts`): register constructor, call `uiBridge.registerView(thisRef, 'ImageView')`, map properties via `uiBridge.updateViewProperty()`.

2. **OH copy** (`src/oh/entry/src/main/ets/craft/shim/android/widget/image_view.ts`): keep in sync via `npm run sync-oh`.

3. **CraftPage** (`src/oh/entry/src/main/ets/pages/CraftPage.ets`): add case to `renderView()` dispatcher and implement `renderImageView()` `@Builder`.

4. **SerializedView props**: document which props the shim writes and which the renderer reads (e.g. `src` for image URI, `scaleType`).

5. **Tests**: unit test the shim, integration test the full render path.

---

## Known Constraints

| Constraint | Cause | Workaround |
|---|---|---|
| No `Map` in AppStorage | ArkUI reactivity requires POJOs | Serialize to `Record<string, V>` |
| No `@State` mutation from callbacks | ArkUI change detection limitation | Use `AppStorage.setOrCreate()` |
| No recursive `@Builder` | ArkUI builder constraints | Dispatcher → typed builders pattern |
| No `Handler`/`Looper` | ArkTS lacks Java threading | 50ms `setInterval` polling queue |
| `ForEach` key must be content-aware | ArkUI reuses components by key | Include `text` + `updateCounter` in key |
| Initialization order is strict | AppStorage bindings resolve early | Runtime in AppStorage before `loadContent()` |

---

**See also:**
- `src/bridge/ui_bridge.ts` — UIBridge implementation
- `src/bridge/state_manager.ts` — StateManager and SerializedView
- `src/oh/entry/src/main/ets/pages/CraftPage.ets` — ArkUI renderer
- `src/oh/entry/src/main/ets/entryability/EntryAbility.ets` — Host lifecycle
- [architecture.md](architecture.md) — System overview
- [specification.md](specification.md) — Component API reference

**Last Updated:** 2026-03-10
