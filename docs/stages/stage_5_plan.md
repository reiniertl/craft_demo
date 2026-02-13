# Stage 5 Implementation Plan - Integration & Polish

**Project:** CRAFT (Compatibility Runtime for Android Framework Translation)
**Stage:** 5 — Integration & Polish
**Status:** 📋 PLANNED
**Date:** 2026-02-13
**Prerequisites:** Stages 1-4 Complete (263 tests passing)

---

## Executive Summary

Stage 5 is the final stage of the CRAFT PoC, focusing on end-to-end integration, OpenHarmony deployment, and demonstration readiness. This stage brings together all components (APK parser, DEX interpreter, Android API shims, and UI Bridge) into a working OpenHarmony application that can load and run a real Android APK.

**Goal:** Demonstrate "Hello World" from an Android APK running on OpenHarmony, rendered through ArkUI.

**Estimated Duration:** 1-2 weeks

**Key Deliverables:**
1. OpenHarmony CraftAbility and CraftPage implementation
2. End-to-end integration with real Android APK
3. Visual confirmation on OpenHarmony device/emulator
4. Performance profiling and optimization
5. Comprehensive documentation
6. Working demo preparation

---

## Current State Analysis

### ✅ Completed Components (Stages 1-4)

| Component | Status | Tests | Notes |
|-----------|--------|-------|-------|
| APK Parser | ✅ Complete | 58/58 | ZIP extraction, manifest parsing |
| DEX Parser | ✅ Complete | 58/58 | Full DEX format support |
| Bytecode Interpreter | ✅ Complete | 115/115 | 27 opcodes, frame-based execution |
| Android API Shims | ✅ Complete | 35/35 | 7 classes, 35 methods |
| UI Bridge | ✅ Complete | 55/55 | ViewNode mapping, reactive state |
| **Total** | **✅ Complete** | **263/263** | **100% passing** |

### 🚧 Remaining Work (Stage 5)

| Component | Status | Description |
|-----------|--------|-------------|
| OpenHarmony CraftAbility | 🔴 Needs Update | Currently only supports Stage 1 parsing |
| CraftPage (Dynamic UI) | 🔴 Not Implemented | ArkUI page for dynamic rendering |
| End-to-End Integration | 🔴 Not Tested | Full APK → Screen workflow |
| Real APK Support | ⚠️ Partial | Current test APK is minimal |
| Performance Profiling | 🔴 Not Done | Need benchmarks and optimization |
| Documentation | ⚠️ Partial | Final docs and demo guide needed |

### 📊 Test Coverage

```
✅ Unit Tests: 263 passing
✅ Integration Tests: Included above
✅ Component Tests: All components isolated
🔴 E2E Tests: Not yet implemented
🔴 Visual Tests: Not yet implemented
🔴 Performance Tests: Not yet implemented
```

---

## Stage 5 Goals

### Primary Goals

1. **Full OpenHarmony Integration**
   - Update EntryAbility to use CraftRuntime
   - Implement CraftPage for dynamic ArkUI rendering
   - Wire lifecycle events correctly
   - Handle APK loading from file system

2. **End-to-End Functionality**
   - Load real Android Hello World APK
   - Execute MainActivity.onCreate()
   - Render TextView through ArkUI
   - Display "Hello World" on screen

3. **Visual Confirmation**
   - Run on OpenHarmony device/emulator
   - Screenshot of working demo
   - Verify lifecycle events
   - Confirm state updates

4. **Testing & Validation**
   - End-to-end integration tests
   - Visual regression tests (manual)
   - Error handling tests
   - Edge case validation

5. **Performance & Optimization**
   - Profiling interpreter performance
   - Measuring render times
   - Identifying bottlenecks
   - Basic optimizations

6. **Documentation & Demo**
   - Complete API documentation
   - Deployment guide
   - Demo script
   - Architecture diagrams update

### Secondary Goals (Nice to Have)

1. **Enhanced Test APK**
   - More realistic Hello World app
   - Multiple TextViews
   - Text styling (size, color)
   - Basic layout

2. **Developer Experience**
   - Better error messages
   - Debugging tools
   - Logging improvements
   - DevEco Studio integration

3. **Extensibility**
   - Extension guide updates
   - Adding new views guide
   - Adding new opcodes guide
   - Performance tuning guide

---

## Implementation Tasks

### Task 1: Complete Test APK (Priority: High)

**Goal:** Complete the Hello World Android APK with full MainActivity implementation.

**Current State (Stage 1 Stub):**
- Stage 1 created a minimal stub APK for parser testing only
- Contains MainActivity with onCreate() that just calls `super.onCreate()`
- Only 2 methods, 7 instructions total
- Missing opcode 0x20 (instance-of) - now implemented in Stage 5
- **No Android API usage:** No TextView creation, setText, or setContentView

**Why Completion is Needed:**
Stage 1 stub was intentionally minimal to test the parser. To test Stages 2-5 functionality (interpreter, shims, UI bridge), we need onCreate() to actually create views and make Android API calls.

**Requirements:**
```java
package com.example.helloworld;

import android.app.Activity;
import android.os.Bundle;
import android.widget.TextView;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        TextView textView = new TextView(this);
        textView.setText("Hello World");
        textView.setTextSize(24.0f);
        textView.setTextColor(0xFF000000);

        setContentView(textView);
    }
}
```

**Deliverables:**
- [ ] Compile proper Hello World APK with Android SDK
- [ ] Verify APK structure (classes.dex, AndroidManifest.xml)
- [ ] Analyze APK with `npm run analyze-apk`
- [ ] Implement any missing opcodes (likely 0x20 instance-of)
- [ ] Place in `test/fixtures/hello_world_complete.apk`
- [ ] Update test references

**Acceptance Criteria:**
- APK contains complete MainActivity with onCreate()
- APK includes proper AndroidManifest.xml with MainActivity declared
- All opcodes used in APK are implemented in interpreter
- APK parses successfully with CRAFT tools

**Estimated Time:** 2-3 hours

---

### Task 2: Update CraftAbility.ets (Priority: High)

**Goal:** Transform EntryAbility from Stage 1 parser into full CRAFT runtime host.

**Current State:**
- `src/oh/entry/src/main/ets/entryability/EntryAbility.ets` only parses APK
- Uses CraftParser (Stage 1 only)
- No interpreter or UI integration

**New Implementation:**
```typescript
import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import hilog from '@ohos.hilog';
import { CraftRuntime } from '../../../../../runtime';  // Import from TypeScript core

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * CRAFT Entry Ability - Full runtime host for Android APKs
 *
 * Launch via:
 *   hdc shell aa start -a EntryAbility -b com.craft.runtime \
 *     --ps apk_path /data/app/hello_world.apk
 */
export default class CraftAbility extends UIAbility {
    private runtime: CraftRuntime | null = null;
    private apkPath: string = '';
    private activityRef: number = 0;

    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onCreate');

        // Extract APK path from Want parameters
        if (want.parameters && want.parameters['apk_path']) {
            this.apkPath = want.parameters['apk_path'] as string;
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] APK: %{public}s', this.apkPath);
        } else {
            hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] No apk_path provided');
            this.apkPath = '/data/app/hello_world.apk';  // Default fallback
        }

        // Initialize CRAFT runtime
        this.runtime = new CraftRuntime();
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Runtime initialized');
    }

    onDestroy(): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onDestroy');

        // Destroy Activity and cleanup
        if (this.runtime && this.activityRef) {
            this.runtime.destroyActivity(this.activityRef);
        }

        if (this.runtime) {
            this.runtime.shutdown();
            this.runtime = null;
        }
    }

    async onWindowStageCreate(windowStage: window.WindowStage): Promise<void> {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onWindowStageCreate');

        try {
            if (!this.runtime) {
                throw new Error('Runtime not initialized');
            }

            // Load APK
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Loading APK...');
            await this.runtime.loadAPKFromPath(this.apkPath);
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] APK loaded successfully');

            // Create Activity instance
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Creating Activity...');
            this.activityRef = this.runtime.createActivity('com.example.helloworld.MainActivity');
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity created: ref=%{public}d', this.activityRef);

            // Load CraftPage (will subscribe to state updates)
            windowStage.loadContent('pages/CraftPage', (err) => {
                if (err.code) {
                    hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Failed to load page: %{public}s', JSON.stringify(err));
                    return;
                }

                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] CraftPage loaded');

                // Share runtime with page via AppStorage
                AppStorage.setOrCreate('craftRuntime', this.runtime);
                AppStorage.setOrCreate('activityRef', this.activityRef);

                // Now call Activity.onCreate() - this will trigger UI updates
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Calling Activity.onCreate()...');
                try {
                    this.runtime!.callActivityLifecycle(this.activityRef, 'onCreate', null);
                    hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity.onCreate() complete');
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] onCreate failed: %{public}s', msg);
                }
            });

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Setup failed: %{public}s', msg);
        }
    }

    onWindowStageDestroy(): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onWindowStageDestroy');
    }

    onForeground(): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onForeground');

        // Resume Activity
        if (this.runtime && this.activityRef) {
            try {
                this.runtime.resumeActivity(this.activityRef);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Resume failed: %{public}s', msg);
            }
        }
    }

    onBackground(): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onBackground');

        // Pause Activity
        if (this.runtime && this.activityRef) {
            try {
                this.runtime.pauseActivity(this.activityRef);
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Pause failed: %{public}s', msg);
            }
        }
    }
}
```

**Key Changes:**
1. Import CraftRuntime from TypeScript core
2. Initialize full runtime in onCreate()
3. Load APK and create Activity in onWindowStageCreate()
4. Share runtime via AppStorage
5. Map lifecycle events (onForeground → resume, onBackground → pause)
6. Proper error handling and logging

**Deliverables:**
- [ ] Update EntryAbility.ets with full runtime integration
- [ ] Add error handling for all lifecycle events
- [ ] Add comprehensive logging
- [ ] Test lifecycle event mapping
- [ ] Verify AppStorage communication

**Acceptance Criteria:**
- CraftRuntime initializes successfully
- APK loads without errors
- Activity creates and calls onCreate()
- Lifecycle events map correctly
- Errors are logged clearly

**Estimated Time:** 3-4 hours

---

### Task 3: Implement CraftPage.ets (Priority: High)

**Goal:** Create dynamic ArkUI page that renders Android Views.

**Location:** `src/oh/entry/src/main/ets/pages/CraftPage.ets`

**Implementation:**
```typescript
import { CraftRuntime } from '../../../../../../runtime';
import hilog from '@ohos.hilog';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * Serialized view structure from StateManager
 */
interface SerializedView {
    id: string;
    type: string;
    props: Record<string, ESObject>;
    children: SerializedView[];
}

/**
 * CraftPage - Dynamic ArkUI page that renders Android Views
 *
 * This page:
 * 1. Retrieves CraftRuntime from AppStorage
 * 2. Subscribes to StateManager updates
 * 3. Renders ViewNode tree as ArkUI components
 * 4. Maps Android View types to ArkUI equivalents
 */
@Entry
@Component
struct CraftPage {
    @StorageLink('craftRuntime') runtime: CraftRuntime | null = null;
    @StorageLink('activityRef') activityRef: number = 0;

    @State viewTree: SerializedView | null = null;
    @State updateCounter: number = 0;
    @State errorMessage: string = '';
    @State isLoading: boolean = true;

    aboutToAppear(): void {
        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] aboutToAppear');

        if (!this.runtime) {
            this.errorMessage = 'Runtime not available';
            this.isLoading = false;
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Runtime not found in AppStorage');
            return;
        }

        try {
            // Subscribe to UI updates from StateManager
            const stateManager = this.runtime.getUIBridge().getStateManager();

            stateManager.subscribe(() => {
                hilog.info(DOMAIN, TAG, '[CraftPage][INFO] State update received');
                const state = stateManager.getState();
                this.viewTree = state.root as SerializedView;
                this.updateCounter++;
                this.isLoading = false;

                hilog.info(DOMAIN, TAG, '[CraftPage][INFO] View tree updated: counter=%{public}d', this.updateCounter);

                if (this.viewTree) {
                    hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Root view type: %{public}s', this.viewTree.type);
                }
            });

            // Get initial state
            const initialState = stateManager.getState();
            if (initialState.root) {
                this.viewTree = initialState.root as SerializedView;
                this.isLoading = false;
                hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Initial state loaded');
            }

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.errorMessage = `Setup failed: ${msg}`;
            this.isLoading = false;
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Setup failed: %{public}s', msg);
        }
    }

    aboutToDisappear(): void {
        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] aboutToDisappear');
        // Unsubscribe handled by runtime shutdown
    }

    build() {
        Column() {
            if (this.isLoading) {
                // Loading state
                this.loadingView();
            } else if (this.errorMessage) {
                // Error state
                this.errorView();
            } else if (this.viewTree !== null) {
                // Render Android view tree
                this.renderView(this.viewTree);
            } else {
                // No content yet
                this.emptyView();
            }
        }
        .width('100%')
        .height('100%')
        .backgroundColor('#FFFFFF')
    }

    @Builder
    loadingView() {
        Column() {
            Text('Loading Android App...')
                .fontSize(20)
                .fontColor('#666666')
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
    }

    @Builder
    errorView() {
        Column() {
            Text('Error')
                .fontSize(24)
                .fontWeight(FontWeight.Bold)
                .fontColor('#FF0000')
                .margin({ bottom: 20 })

            Text(this.errorMessage)
                .fontSize(16)
                .fontColor('#666666')
                .textAlign(TextAlign.Center)
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
        .padding(20)
    }

    @Builder
    emptyView() {
        Column() {
            Text('Waiting for content...')
                .fontSize(18)
                .fontColor('#999999')
        }
        .width('100%')
        .height('100%')
        .justifyContent(FlexAlign.Center)
        .alignItems(HorizontalAlign.Center)
    }

    /**
     * Recursively render Android View as ArkUI component
     */
    @Builder
    renderView(view: SerializedView) {
        if (view.type === 'TextView') {
            this.renderTextView(view);
        } else if (view.type === 'ViewGroup') {
            this.renderViewGroup(view);
        } else {
            // Unknown view type - render as text for debugging
            Text(`Unknown View: ${view.type}`)
                .fontSize(14)
                .fontColor('#FF0000')
        }
    }

    /**
     * Render TextView as ArkUI Text component
     */
    @Builder
    renderTextView(view: SerializedView) {
        const text = (view.props['text'] as string) || '';
        const textSize = (view.props['textSize'] as number) || 14;
        const textColor = (view.props['textColor'] as number) || 0xFF000000;

        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Rendering TextView: text="%{public}s", size=%{public}f',
                   text, textSize);

        Text(text)
            .fontSize(textSize)
            .fontColor(this.intToColor(textColor))
            .key(view.id)
    }

    /**
     * Render ViewGroup as ArkUI Column
     */
    @Builder
    renderViewGroup(view: SerializedView) {
        Column() {
            ForEach(view.children, (child: SerializedView) => {
                this.renderView(child);
            }, (child: SerializedView) => child.id)
        }
        .key(view.id)
    }

    /**
     * Convert Android ARGB integer to ArkUI Color
     * Format: 0xAARRGGBB
     */
    private intToColor(argb: number | undefined): string {
        if (argb === undefined) {
            return '#FF000000';  // Black
        }

        const a = (argb >> 24) & 0xFF;
        const r = (argb >> 16) & 0xFF;
        const g = (argb >> 8) & 0xFF;
        const b = argb & 0xFF;

        // Convert to CSS rgba
        const alpha = a / 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }
}
```

**Key Features:**
1. Retrieves runtime from AppStorage
2. Subscribes to StateManager for reactive updates
3. Renders different states (loading, error, empty, content)
4. Maps TextView → Text component
5. Maps ViewGroup → Column component
6. Converts Android color format to ArkUI
7. Comprehensive logging

**Deliverables:**
- [ ] Create CraftPage.ets with dynamic rendering
- [ ] Implement view type mapping (TextView, ViewGroup)
- [ ] Add loading and error states
- [ ] Implement color conversion
- [ ] Add logging for debugging
- [ ] Test state updates trigger re-render

**Acceptance Criteria:**
- Page loads without errors
- Subscribes to StateManager successfully
- TextView renders as ArkUI Text
- Text properties (text, size, color) display correctly
- View updates trigger re-renders
- Errors are displayed clearly

**Estimated Time:** 4-5 hours

---

### Task 4: TypeScript Build & Packaging (Priority: High)

**Goal:** Bundle TypeScript runtime for use in ArkTS environment.

**Challenge:** OpenHarmony ArkTS modules cannot directly import from `src/` directory. Need to build and package TypeScript code.

**Options:**

**Option A: Build to HAR (Recommended)**
- Build TypeScript to JavaScript
- Package as OpenHarmony HAR (Harmony Archive)
- Import in ArkTS files

**Option B: Direct Copy (Simpler for PoC)**
- Copy TypeScript files to oh/entry/src/main/ets/
- Use relative imports
- Simpler but less maintainable

**Recommended Approach: Option B for PoC**

```bash
# Create symlink or copy TypeScript core to OH project
mkdir -p src/oh/entry/src/main/ets/craft
cp -r src/{core,parser,interpreter,shim,bridge,runtime.ts} \
      src/oh/entry/src/main/ets/craft/

# Update imports in CraftAbility and CraftPage
# From: import { CraftRuntime } from '../../../../../runtime'
# To: import { CraftRuntime } from '../craft/runtime'
```

**Deliverables:**
- [ ] Create build script or copy strategy
- [ ] Update import paths in ArkTS files
- [ ] Verify TypeScript compiles in ArkTS context
- [ ] Test imports work correctly
- [ ] Document build process

**Acceptance Criteria:**
- ArkTS files can import TypeScript modules
- No compilation errors
- Runtime initializes successfully
- All features work as expected

**Estimated Time:** 2-3 hours

---

### Task 5: End-to-End Integration Testing (Priority: High)

**Goal:** Validate complete APK → Screen workflow.

**Test Scenarios:**

**Test 1: APK Loading**
- ✓ APK file loads from file system
- ✓ Manifest parses correctly
- ✓ DEX file parses correctly
- ✓ Classes and methods load

**Test 2: Activity Lifecycle**
- ✓ Activity instance creates
- ✓ onCreate(Bundle) executes
- ✓ super.onCreate() calls work
- ✓ Lifecycle state transitions

**Test 3: View Creation**
- ✓ new TextView(context) creates view
- ✓ View registers with UIBridge
- ✓ TextView.setText() updates property
- ✓ StateManager receives update

**Test 4: UI Rendering**
- ✓ setContentView() sets root view
- ✓ StateManager serializes view tree
- ✓ CraftPage subscribes successfully
- ✓ ArkUI renders Text component
- ✓ "Hello World" displays on screen

**Test 5: State Updates**
- ✓ Property changes trigger re-renders
- ✓ Multiple TextViews render correctly
- ✓ View hierarchy renders properly

**Test 6: Lifecycle Events**
- ✓ onForeground → onStart + onResume
- ✓ onBackground → onPause + onStop
- ✓ onDestroy → cleanup

**Test 7: Error Handling**
- ✓ Invalid APK path
- ✓ Missing classes
- ✓ Missing methods
- ✓ Unsupported opcodes
- ✓ Invalid view types

**Deliverables:**
- [ ] Create E2E test suite
- [ ] Manual testing checklist
- [ ] Automated integration tests (if possible)
- [ ] Visual confirmation screenshots
- [ ] Test results documentation

**Acceptance Criteria:**
- All test scenarios pass
- No crashes or hangs
- Error handling works correctly
- Performance is acceptable
- Screenshots confirm visual output

**Estimated Time:** 4-6 hours

---

### Task 6: Performance Profiling (Priority: Medium)

**Goal:** Measure and optimize interpreter performance.

**Metrics to Collect:**

1. **APK Loading Time**
   - File I/O time
   - Parsing time (APK, manifest, DEX)
   - Class loading time

2. **Interpretation Performance**
   - Instructions per second
   - Method invocation overhead
   - Shim call overhead
   - Memory allocation time

3. **UI Bridge Performance**
   - View registration time
   - Property update time
   - State serialization time
   - ArkUI render time

4. **Lifecycle Performance**
   - Activity creation time
   - onCreate execution time
   - Full startup time (APK → Screen)

**Profiling Tools:**
- ArkTS hilog timestamps
- Performance.now() for JavaScript timing
- OpenHarmony DevTools
- Manual instrumentation

**Optimization Targets:**
- Interpreter: >10,000 instructions/sec
- Startup time: <2 seconds (APK load → render)
- Frame time: <16ms for smooth 60fps

**Deliverables:**
- [ ] Add performance instrumentation
- [ ] Collect baseline metrics
- [ ] Identify bottlenecks
- [ ] Implement optimizations
- [ ] Document performance results

**Acceptance Criteria:**
- Performance metrics collected
- Bottlenecks identified
- Basic optimizations implemented
- Startup time acceptable (<5 seconds)
- No frame drops during rendering

**Estimated Time:** 4-5 hours

---

### Task 7: Documentation (Priority: High)

**Goal:** Complete documentation for deployment and usage.

**Documents to Create/Update:**

**1. Stage 5 Results** (`docs/stages/stage_5_results.md`)
- Completion summary
- Test results
- Performance metrics
- Screenshots
- Known issues
- Future work

**2. Deployment Guide** (`docs/deployment_guide.md`)
- Prerequisites (DevEco Studio, OpenHarmony SDK)
- Build instructions
- Installation steps
- APK placement
- Launch commands
- Troubleshooting

**3. Demo Script** (`docs/demo_script.md`)
- Step-by-step demo walkthrough
- What to show
- Expected outputs
- Common issues
- Q&A preparation

**4. API Documentation** (Update existing docs)
- CraftRuntime API complete
- OpenHarmony integration guide
- Extension examples

**5. Architecture Updates** (`docs/architecture.md`)
- Update diagrams with final implementation
- Add OpenHarmony integration section
- Document data flow end-to-end

**6. Main README** (Update `/mnt/d/craft/README.md` and `/mnt/d/craft/craft/README.md`)
- Mark Stage 5 complete
- Add screenshots
- Update metrics
- Add demo links

**Deliverables:**
- [ ] Stage 5 results document
- [ ] Deployment guide
- [ ] Demo script
- [ ] Updated architecture docs
- [ ] Updated README files
- [ ] Screenshots and videos

**Acceptance Criteria:**
- All documentation complete and accurate
- Instructions tested by following step-by-step
- Screenshots/videos show working demo
- Architecture diagrams match implementation

**Estimated Time:** 4-6 hours

---

### Task 8: Demo Preparation (Priority: High)

**Goal:** Prepare polished demonstration of CRAFT PoC.

**Demo Components:**

**1. Slide Deck**
- Problem statement
- Solution approach
- Architecture overview
- Technical highlights
- Live demo walkthrough
- Results and metrics
- Future roadmap

**2. Live Demo**
- Pre-configured OpenHarmony device/emulator
- Hello World APK ready
- Launch command prepared
- Expected output documented
- Fallback recorded video

**3. Demo Script**
- Introduction (2 min)
- Architecture overview (3 min)
- Technical deep-dive (5 min)
- Live demo (5 min)
- Q&A (5 min)

**4. Backup Materials**
- Recorded video of working demo
- Screenshots at key points
- Code walkthrough
- Test results

**Deliverables:**
- [ ] Create presentation slides
- [ ] Prepare demo environment
- [ ] Record demo video (backup)
- [ ] Write demo script
- [ ] Rehearse demo
- [ ] Prepare Q&A responses

**Acceptance Criteria:**
- Presentation is clear and compelling
- Demo runs smoothly
- Backup video available
- Script is well-rehearsed
- Q&A preparation complete

**Estimated Time:** 6-8 hours

---

## Implementation Timeline

### Week 1: Core Integration (Days 1-5)

**Day 1: APK and Opcode Work**
- Task 1: Create proper Hello World APK
- Implement missing opcode 0x20 if needed
- Test APK with analyzer

**Day 2-3: OpenHarmony Integration**
- Task 2: Update CraftAbility.ets
- Task 3: Implement CraftPage.ets
- Task 4: Build & packaging setup

**Day 4-5: Testing and Debugging**
- Task 5: End-to-end integration testing
- Fix bugs and issues
- Visual confirmation

### Week 2: Polish and Demo (Days 6-10)

**Day 6-7: Performance and Optimization**
- Task 6: Performance profiling
- Implement optimizations
- Re-test after changes

**Day 8-9: Documentation**
- Task 7: Complete all documentation
- Screenshots and videos
- Update READMEs

**Day 10: Demo Preparation**
- Task 8: Prepare demo materials
- Rehearse presentation
- Final testing

---

## Success Criteria

### Must Have (Required for Completion)

- [x] Stages 1-4 complete (263 tests passing) ✅
- [ ] Completed Hello World APK with full Activity
- [ ] CraftAbility.ets using full runtime
- [ ] CraftPage.ets with dynamic rendering
- [ ] End-to-end APK → Screen workflow working
- [ ] Visual confirmation: "Hello World" on screen
- [ ] Lifecycle events working correctly
- [ ] All existing tests still passing (no regressions)
- [ ] Complete documentation
- [ ] Working demo prepared

### Should Have (High Priority)

- [ ] Performance profiling complete
- [ ] Basic optimizations implemented
- [ ] Comprehensive error handling
- [ ] Multiple test scenarios validated
- [ ] Screenshots and demo video
- [ ] Deployment guide tested

### Nice to Have (Optional)

- [ ] Multiple TextViews working
- [ ] Text styling (size, color) working
- [ ] Enhanced test APK with layout
- [ ] Debugging tools
- [ ] Developer guide enhancements

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ArkTS import issues | Medium | High | Use direct copy approach, test early |
| Missing opcodes in real APK | Medium | Medium | Analyze APK first, implement before integration |
| State update not triggering render | Low | High | Test StateManager subscription early |
| Performance unacceptable | Medium | Medium | Profile early, optimize critical paths |
| OpenHarmony device unavailable | Low | High | Use emulator, prepare recorded demo |
| Lifecycle mapping incorrect | Low | Medium | Test each event, add logging |

---

## Dependencies

### External Dependencies

1. **DevEco Studio** - OpenHarmony IDE
   - Version: 4.0+ recommended
   - OpenHarmony SDK API 10+

2. **OpenHarmony Device/Emulator**
   - Physical device preferred for performance testing
   - Emulator acceptable for functional testing

3. **Android SDK** (for building test APK)
   - Android Studio or command-line tools
   - Target API 28-33

### Internal Dependencies

1. **All Stage 1-4 components** (Complete ✅)
2. **Test fixtures** (Need completed APK)
3. **Development tools** (All implemented ✅)

---

## Testing Strategy

### Unit Tests (Existing)
- ✅ 263 tests passing
- ✅ All components tested in isolation
- Continue to run after each change

### Integration Tests (New)
- CraftRuntime initialization
- APK loading end-to-end
- Activity lifecycle execution
- UI Bridge integration
- StateManager updates

### End-to-End Tests (New)
- Full APK → Screen workflow
- Lifecycle event flow
- Multiple view rendering
- Error handling scenarios

### Manual Tests (New)
- Visual confirmation on device
- Performance testing
- User interaction (if any)
- Edge cases

### Regression Tests
- Run all existing tests after changes
- Verify no functionality breaks
- Check performance doesn't degrade

---

## Deliverables Checklist

### Code Deliverables
- [ ] Completed Hello World APK
- [ ] Updated CraftAbility.ets
- [ ] New CraftPage.ets
- [ ] Build/packaging scripts
- [ ] Missing opcode implementations
- [ ] Integration test suite

### Documentation Deliverables
- [ ] stage_5_results.md
- [ ] deployment_guide.md
- [ ] demo_script.md
- [ ] Updated architecture.md
- [ ] Updated README files
- [ ] API documentation updates

### Demo Deliverables
- [ ] Presentation slides
- [ ] Demo video (recorded)
- [ ] Screenshots
- [ ] Demo environment setup
- [ ] Q&A preparation

### Test Deliverables
- [ ] E2E test suite
- [ ] Test results document
- [ ] Performance metrics
- [ ] Regression test results

---

## Post-Stage 5 Roadmap (Future Work)

### Phase 2: Enhanced Views
- Button, EditText, ImageView
- LinearLayout, RelativeLayout
- Basic event handling (onClick)

### Phase 3: More APIs
- Intent and Intent filters
- Resources (strings, layouts)
- Shared Preferences
- File I/O

### Phase 4: Performance
- JIT compilation for hot paths
- Opcode caching
- Memory optimization
- Faster method dispatch

### Phase 5: Real Apps
- Support more complex apps
- Multiple activities
- Fragments
- Services (background tasks)

---

## Appendix

### Appendix A: Missing Opcodes Analysis

Based on current test APK analysis:
- Missing opcode 0x20 (likely instance-of or check-cast)
- Need to analyze full Hello World APK for complete list

### Appendix B: OpenHarmony File Paths

Standard APK locations on OpenHarmony:
- `/data/app/<package>/` - Installed app data
- `/sdcard/` - External storage (if available)
- Test fixtures: Bundle with HAP or push via hdc

### Appendix C: Performance Targets

**Acceptable Performance:**
- APK load time: < 5 seconds
- Activity creation: < 500ms
- UI render: < 100ms
- Startup (total): < 10 seconds

**Good Performance:**
- APK load time: < 2 seconds
- Activity creation: < 200ms
- UI render: < 50ms
- Startup (total): < 5 seconds

### Appendix D: Useful Commands

```bash
# Build OpenHarmony HAP
cd /mnt/d/craft/craft/src/oh
hvigorw assembleHap

# Install HAP on device
hdc install entry/build/default/outputs/default/entry-default-signed.hap

# Launch with APK path
hdc shell aa start -a EntryAbility -b com.craft.runtime \
  --ps apk_path /data/app/hello_world.apk

# View logs
hdc hilog -T CRAFT

# Push APK to device
hdc file send test/fixtures/hello_world.apk /data/app/hello_world.apk

# Clear app data
hdc shell aa force-stop com.craft.runtime
hdc shell bm uninstall -n com.craft.runtime
```

---

## Conclusion

Stage 5 represents the culmination of the CRAFT PoC project. Success means demonstrating that Android APKs can run on OpenHarmony through pure bytecode interpretation, bridging the Android and OpenHarmony ecosystems.

**Key Milestones:**
1. ✅ Stages 1-4 complete (263 tests)
2. 🔲 OpenHarmony integration complete
3. 🔲 End-to-end demo working
4. 🔲 Performance acceptable
5. 🔲 Documentation complete

**Expected Outcome:** A working demonstration of "Hello World" from an Android APK, rendered through OpenHarmony's ArkUI, validating the CRAFT architecture and approach.

---

**Status:** 📋 PLANNED - Ready for implementation
**Next Step:** Begin Task 1 (Enhanced Test APK)
**Estimated Completion:** 1-2 weeks from start
**Last Updated:** 2026-02-13
