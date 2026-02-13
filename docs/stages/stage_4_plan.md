# Stage 4 Implementation Plan — UI Bridge & OpenHarmony Host

**Project:** CRAFT (Compatible Runtime for Android on Fuchsia/Trusty)
**Stage:** 4 — UI Bridge to ArkUI & OpenHarmony Integration
**Dependencies:** Stage 3 (Android API Shims) complete
**Duration:** ~2 weeks (Weeks 7-8 of project plan)

---

## 1. Overview

Stage 4 bridges Android Views to OpenHarmony's ArkUI framework and wraps the CRAFT runtime as an OpenHarmony UIAbility. This enables "Hello World" text from the Android APK to render natively through ArkUI.

### 1.1 Goals

- Map Android View objects to ArkUI components
- Implement reactive state management for ArkUI rendering
- Create UIAbility wrapper for CRAFT runtime
- Bridge Activity ↔ Ability lifecycle events
- Render "Hello World" text on screen

### 1.2 Success Criteria

- TextView → ArkUI Text component mapping works
- setContentView() triggers ArkUI rendering
- Activity lifecycle maps to Ability lifecycle
- Visual confirmation: "Hello World" appears on screen
- Zero regressions: All 208 existing tests pass

---

## 2. Architecture

### 2.1 Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     OpenHarmony System                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  CRAFT Runtime (Stages 1-3)             │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │    │
│  │  │   Heap   │  │  Opcode  │  │  Android API Shims   │  │    │
│  │  │          │  │ Executor │  │  (Activity, TextView)│  │    │
│  │  └──────────┘  └──────────┘  └──────────────────────┘  │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    UI Bridge (NEW)                       │    │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │    │
│  │  │  View Registry  │  │     State Manager            │  │    │
│  │  │  (View → Node)  │  │  (Observable pattern)        │  │    │
│  │  └─────────────────┘  └──────────────────────────────┘  │    │
│  │  ┌──────────────────────────────────────────────────┐   │    │
│  │  │       Lifecycle Bridge                           │   │    │
│  │  │   Activity.onCreate → Ability.onCreate           │   │    │
│  │  └──────────────────────────────────────────────────┘   │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              OpenHarmony Host (NEW)                      │    │
│  │  ┌──────────────┐  ┌──────────────────────────────┐     │    │
│  │  │ CraftAbility │  │      CraftPage               │     │    │
│  │  │ (UIAbility)  │  │  (Dynamic ArkUI Builder)     │     │    │
│  │  └──────────────┘  └──────────────────────────────┘     │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            ↓                                     │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  ArkUI Renderer                          │    │
│  │   Text { "Hello World" }                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
1. APK Loaded (Stages 1-2)
   → ClassLoader has MainActivity class

2. Activity.onCreate() called (Stage 3)
   → new TextView(this)
   → textView.setText("Hello World")
   → setContentView(textView)

3. UI Bridge captures (NEW)
   → TextView shim calls UIBridge.registerView(ref, properties)
   → setContentView calls UIBridge.setRootView(ref)

4. State Manager notifies (NEW)
   → Observable pattern triggers ArkUI @State update

5. ArkUI Re-renders (NEW)
   → CraftPage.build() reads ViewNode tree
   → Renders Text("Hello World")
```

---

## 3. Component Specifications

### 3.1 UI Bridge (`src/bridge/ui_bridge.ts`)

**Purpose:** Map Android View heap objects to ArkUI component tree

#### 3.1.1 ViewNode Structure

```typescript
interface ViewNode {
  viewRef: number;              // Heap reference to Android View object
  viewType: string;             // 'TextView', 'ViewGroup', etc.
  properties: Map<string, any>; // text, textSize, textColor, visibility, etc.
  children: ViewNode[];         // Child views (for ViewGroup)
  parent: ViewNode | null;      // Parent view
  arkuiId: string;              // Unique ID for ArkUI component
}
```

#### 3.1.2 UIBridge Class

```typescript
class UIBridge {
  private heap: Heap;
  private stateManager: StateManager;
  private viewMap: Map<number, ViewNode> = new Map();
  private rootView: ViewNode | null = null;

  // Register a view when created (called by View shim constructor)
  registerView(viewRef: number, viewType: string): void;

  // Update view property (called by setText, setTextColor, etc.)
  updateViewProperty(viewRef: number, property: string, value: any): void;

  // Set content view (called by Activity.setContentView)
  setRootView(viewRef: number): void;

  // Add child to parent (called by ViewGroup.addView)
  addChildView(parentRef: number, childRef: number): void;

  // Build ViewNode tree from heap reference
  private buildViewNode(viewRef: number): ViewNode;
}
```

#### 3.1.3 Integration Points

- **TextView shim (`src/shim/android/widget/textview.ts`)**
  - Constructor calls `uiBridge.registerView(thisRef, 'TextView')`
  - `setText()` calls `uiBridge.updateViewProperty(thisRef, 'text', value)`
  - `setTextSize()` calls `uiBridge.updateViewProperty(thisRef, 'textSize', value)`
  - `setTextColor()` calls `uiBridge.updateViewProperty(thisRef, 'textColor', value)`

- **Activity shim (`src/shim/android/app/activity.ts`)**
  - `setContentView(viewRef)` calls `uiBridge.setRootView(viewRef)`

---

### 3.2 State Manager (`src/bridge/state_manager.ts`)

**Purpose:** Reactive state for ArkUI rendering (observable pattern)

#### 3.2.1 StateManager Class

```typescript
interface ViewState {
  version: number;      // Increment on any change (triggers re-render)
  root: ViewNode | null;
}

class StateManager {
  private viewState: ViewState = { version: 0, root: null };
  private updateCallbacks: Set<() => void> = new Set();

  // Set root view and notify observers
  setRootView(node: ViewNode): void;

  // Notify that a view property changed
  notifyUpdate(): void;

  // Subscribe to state changes (called by CraftPage)
  subscribe(callback: () => void): void;

  // Get current state (called by CraftPage)
  getState(): ViewState;
}
```

#### 3.2.2 Reactive Flow

1. Android code calls `textView.setText("Hello World")`
2. TextView shim calls `uiBridge.updateViewProperty(ref, 'text', 'Hello World')`
3. UIBridge updates ViewNode properties
4. UIBridge calls `stateManager.notifyUpdate()`
5. StateManager increments `version` and calls all callbacks
6. CraftPage's `@State` variable updates
7. ArkUI triggers re-render of `build()` function

---

### 3.3 Lifecycle Bridge (`src/bridge/lifecycle_bridge.ts`)

**Purpose:** Map Android Activity lifecycle to OpenHarmony Ability lifecycle

#### 3.3.1 Lifecycle Mapping

| OpenHarmony Ability | Android Activity | Action |
|---------------------|------------------|--------|
| `onCreate(want)` | `<init>` + `onCreate(bundle)` | Create Activity instance, call onCreate |
| `onForeground()` | `onStart()` + `onResume()` | Call onStart, then onResume |
| `onBackground()` | `onPause()` + `onStop()` | Call onPause, then onStop |
| `onDestroy()` | `onDestroy()` | Call onDestroy |

#### 3.3.2 LifecycleBridge Class

```typescript
class LifecycleBridge {
  private interpreter: Interpreter;
  private activityRef: number | null = null;

  // Called by CraftAbility.onCreate()
  createActivity(mainClass: string): void;

  // Called by CraftAbility.onForeground()
  resumeActivity(): void;

  // Called by CraftAbility.onBackground()
  pauseActivity(): void;

  // Called by CraftAbility.onDestroy()
  destroyActivity(): void;
}
```

---

### 3.4 OpenHarmony Host (`src/oh/ability_host.ets`)

**Purpose:** UIAbility wrapper for CRAFT runtime

#### 3.4.1 CraftAbility Class

```typescript
import { AbilityConstant, UIAbility, Want } from '@kit.AbilityKit';
import { window } from '@kit.ArkUI';
import { CraftRuntime } from '../index';

export default class CraftAbility extends UIAbility {
  private runtime: CraftRuntime | null = null;
  private apkPath: string = '';

  onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
    // 1. Extract APK path from Want parameters
    // 2. Create CraftRuntime instance
    // 3. Load APK
    // 4. Find MainActivity
    // 5. Call lifecycle bridge to create Activity
  }

  onForeground(): void {
    // Call lifecycle bridge to resume Activity
  }

  onBackground(): void {
    // Call lifecycle bridge to pause Activity
  }

  onDestroy(): void {
    // Call lifecycle bridge to destroy Activity
  }

  onWindowStageCreate(windowStage: window.WindowStage): void {
    // Load CraftPage for rendering
    windowStage.loadContent('pages/CraftPage', (err) => {
      // Handle errors
    });
  }
}
```

---

### 3.5 Dynamic ArkUI Page (`src/oh/craft_page.ets`)

**Purpose:** Render Android View tree as ArkUI components

#### 3.5.1 CraftPage Component

```typescript
import { CraftRuntime } from '../index';

@Entry
@Component
struct CraftPage {
  @State viewState: ViewState = { version: 0, root: null };
  private runtime: CraftRuntime | null = null;

  aboutToAppear(): void {
    // Get runtime instance from global storage
    this.runtime = globalThis.craftRuntime;

    // Subscribe to state changes
    this.runtime.getStateManager().subscribe(() => {
      this.viewState = this.runtime!.getStateManager().getState();
    });
  }

  build() {
    Column() {
      if (this.viewState.root) {
        this.renderView(this.viewState.root);
      } else {
        Text('Loading...');
      }
    }
  }

  @Builder renderView(node: ViewNode) {
    if (node.viewType === 'TextView') {
      Text(node.properties.get('text') || '')
        .fontSize(node.properties.get('textSize') || 14)
        .fontColor(this.intToColor(node.properties.get('textColor')))
        .visibility(node.properties.get('visibility') === 0 ? Visibility.Visible : Visibility.Hidden);
    } else if (node.viewType === 'ViewGroup') {
      Column() {
        ForEach(node.children, (child: ViewNode) => {
          this.renderView(child);
        });
      }
    }
  }

  private intToColor(argb: number | undefined): Color {
    if (argb === undefined) return Color.Black;
    const a = (argb >> 24) & 0xFF;
    const r = (argb >> 16) & 0xFF;
    const g = (argb >> 8) & 0xFF;
    const b = argb & 0xFF;
    return `rgba(${r},${g},${b},${a/255})` as Color;
  }
}
```

---

## 4. Implementation Tasks

### 4.1 Phase 1: UI Bridge Foundation (Days 1-3)

| Task | File | Description | Tests |
|------|------|-------------|-------|
| 1.1 | `src/bridge/ui_bridge.ts` | Implement UIBridge class with ViewNode structure | Unit test: registerView() stores ViewNode |
| 1.2 | `src/bridge/ui_bridge.ts` | Implement view property updates | Unit test: updateViewProperty() updates node |
| 1.3 | `src/bridge/ui_bridge.ts` | Implement setRootView() | Unit test: setRootView() sets root |
| 1.4 | `src/bridge/state_manager.ts` | Implement StateManager with observable pattern | Unit test: notifyUpdate() calls subscribers |
| 1.5 | Integration | Wire UIBridge into TextView and Activity shims | Integration test: setText → property updated |

### 4.2 Phase 2: Lifecycle Bridge (Days 4-5)

| Task | File | Description | Tests |
|------|------|-------------|-------|
| 2.1 | `src/bridge/lifecycle_bridge.ts` | Implement LifecycleBridge class | Unit test: createActivity() calls onCreate |
| 2.2 | `src/bridge/lifecycle_bridge.ts` | Map Ability → Activity events | Unit test: resumeActivity() calls onResume |
| 2.3 | Integration | Test full lifecycle sequence | Integration test: onCreate → onResume → onPause |

### 4.3 Phase 3: OpenHarmony Integration (Days 6-10)

| Task | File | Description | Tests |
|------|------|-------------|-------|
| 3.1 | `src/oh/ability_host.ets` | Implement CraftAbility skeleton | Manual: Ability launches without crash |
| 3.2 | `src/oh/ability_host.ets` | Load APK in onCreate() | Manual: APK loads successfully |
| 3.3 | `src/oh/craft_page.ets` | Implement static Text rendering | Visual: Static "Test" text appears |
| 3.4 | `src/oh/craft_page.ets` | Implement dynamic ViewNode rendering | Visual: Dynamic text from state appears |
| 3.5 | Integration | Wire StateManager to @State | Visual: setText() updates screen |
| 3.6 | End-to-end | Load Hello World APK | Visual: "Hello World" renders |

---

## 5. Testing Strategy

### 5.1 Unit Tests (TypeScript)

**Test file:** `test/unit/bridge/ui_bridge.test.ts`

```typescript
describe('UIBridge', () => {
  it('registerView creates ViewNode');
  it('updateViewProperty updates node properties');
  it('setRootView sets root and notifies state manager');
  it('buildViewNode reads properties from heap');
});
```

**Test file:** `test/unit/bridge/state_manager.test.ts`

```typescript
describe('StateManager', () => {
  it('setRootView increments version');
  it('notifyUpdate calls all subscribers');
  it('subscribe adds callback');
});
```

**Test file:** `test/unit/bridge/lifecycle_bridge.test.ts`

```typescript
describe('LifecycleBridge', () => {
  it('createActivity invokes <init> and onCreate');
  it('resumeActivity invokes onStart and onResume');
  it('pauseActivity invokes onPause and onStop');
});
```

### 5.2 Integration Tests (TypeScript)

**Test file:** `test/integration/bridge/ui_bridge_integration.test.ts`

```typescript
it('TextView.setText updates UIBridge ViewNode');
it('Activity.setContentView sets root view');
it('Full sequence: onCreate → new TextView → setText → setContentView');
```

### 5.3 Visual Tests (OpenHarmony Device/Emulator)

**Cannot be automated - manual verification required:**

1. **Static rendering:** Hardcoded `Text("Test")` appears on screen
2. **Dynamic rendering:** Changing state variable updates Text content
3. **Hello World APK:** Loading actual APK shows "Hello World"

---

## 6. File Inventory

### 6.1 New Files (Est. ~500 lines total)

| File | Lines | Purpose |
|------|-------|---------|
| `src/bridge/ui_bridge.ts` | ~150 | View → ViewNode mapping |
| `src/bridge/state_manager.ts` | ~80 | Reactive state for ArkUI |
| `src/bridge/lifecycle_bridge.ts` | ~100 | Activity ↔ Ability lifecycle |
| `src/oh/ability_host.ets` | ~120 | UIAbility wrapper |
| `src/oh/craft_page.ets` | ~150 | Dynamic ArkUI rendering |

### 6.2 Modified Files

| File | Change |
|------|--------|
| `src/shim/android/widget/textview.ts` | Add UIBridge calls in constructor and setText |
| `src/shim/android/app/activity.ts` | Add UIBridge call in setContentView |
| `src/index.ts` | Export CraftRuntime class wrapping all components |

### 6.3 Test Files (Est. ~300 lines)

| File | Tests | Purpose |
|------|-------|---------|
| `test/unit/bridge/ui_bridge.test.ts` | ~8 | UIBridge unit tests |
| `test/unit/bridge/state_manager.test.ts` | ~5 | StateManager unit tests |
| `test/unit/bridge/lifecycle_bridge.test.ts` | ~6 | LifecycleBridge unit tests |
| `test/integration/bridge/ui_integration.test.ts` | ~4 | End-to-end bridge tests |

---

## 7. Dependencies

### 7.1 Stage 3 Completion Requirements

- ✅ Activity shim with setContentView() implemented
- ✅ TextView shim with setText(), setTextColor(), setTextSize()
- ✅ ViewGroup shim with addView(), getChildCount()
- ✅ Heap field storage for view properties
- ✅ All 208 existing tests passing

### 7.2 External Dependencies

- **OpenHarmony SDK:** API 10+ (UIAbility model)
- **ArkUI:** @kit.ArkUI, @kit.AbilityKit
- **DevEco Studio:** For .ets file development and testing

---

## 8. Risk Mitigation

### 8.1 ArkUI Learning Curve

**Risk:** Team unfamiliar with ArkUI declarative syntax
**Mitigation:**
- Start with static Text rendering before dynamic
- Use official ArkUI samples as reference
- Incremental testing (static → dynamic → APK)

### 8.2 State Synchronization

**Risk:** Android View updates don't trigger ArkUI re-render
**Mitigation:**
- Use observable pattern with version counter
- Test state updates independently before full integration
- Add logging to trace update flow

### 8.3 Lifecycle Timing

**Risk:** Ability lifecycle events fire before CRAFT runtime ready
**Mitigation:**
- Initialize runtime in onCreate before lifecycle bridge calls
- Add ready flag to prevent premature lifecycle calls
- Test lifecycle sequence in isolation

---

## 9. Success Metrics

### 9.1 Functional

- [ ] UIBridge successfully maps TextView to ViewNode
- [ ] StateManager triggers ArkUI re-renders
- [ ] Activity lifecycle events call correct Android methods
- [ ] CraftAbility loads APK without errors
- [ ] CraftPage renders static text
- [ ] CraftPage renders dynamic text from state
- [ ] Hello World APK displays "Hello World" on screen

### 9.2 Quality

- [ ] All 208 existing tests pass (zero regressions)
- [ ] New unit tests: ~20 tests covering bridge components
- [ ] New integration tests: ~4 tests covering full flow
- [ ] Zero TypeScript errors
- [ ] Zero ArkUI runtime errors

---

## 10. Deliverables

1. **Working UI Bridge** - Android Views render through ArkUI
2. **OpenHarmony Host** - CraftAbility and CraftPage functional
3. **Visual Confirmation** - "Hello World" text visible on device/emulator
4. **Comprehensive Tests** - ~24 new tests (unit + integration)
5. **Documentation** - Stage 4 results report with screenshots

---

## 11. Next Steps (Stage 5)

After Stage 4 completion:
- Full integration testing with unmodified Hello World APK
- Performance profiling and optimization
- Error handling and edge case coverage
- Documentation and demo preparation
- Final PoC demonstration

---

**Dependencies Met:** Stage 3 complete (208 tests passing)
**Ready to Start:** ✅ All prerequisites satisfied
**Estimated Duration:** 10 working days (2 weeks)
