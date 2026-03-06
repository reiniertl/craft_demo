import { CraftRuntime, SerializedView } from '../craft/index';
import hilog from '@ohos.hilog';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * CraftPage - Dynamic ArkUI page that renders Android Views
 *
 * This page:
 * 1. Retrieves CraftRuntime from AppStorage
 * 2. Subscribes to StateManager updates
 * 3. Renders ViewNode tree as ArkUI components
 * 4. Maps Android View types to ArkUI equivalents:
 *    - TextView → Text
 *    - Button → Button (with click handling via UIBridge)
 *    - LinearLayout → Column (vertical) or Row (horizontal)
 *    - ViewGroup → Column
 */
@Entry
@Component
struct CraftPage {
    @StorageLink('craftRuntime') runtime: CraftRuntime | null = null;
    @StorageLink('activityRef') activityRef: number = 0;
    @StorageLink('craftError') craftError: string = '';

    @State viewTree: SerializedView | null = null;
    @State updateCounter: number = 0;
    @State errorMessage: string = '';
    @State isLoading: boolean = true;
    private diagTimer: number = -1;

    aboutToAppear(): void {
        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] aboutToAppear');
        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] runtime available: %{public}s', String(this.runtime !== null));

        if (!this.runtime) {
            this.errorMessage = 'Runtime not available';
            this.isLoading = false;
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Runtime not found in AppStorage');
            return;
        }

        try {
            // Subscribe to UI updates from StateManager
            const stateManager = this.runtime.getUIBridge().getStateManager();
            hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Subscribed to state updates');

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

            // Diagnostic timeout: if still loading after 3 seconds, show status
            this.diagTimer = setTimeout(() => {
                if (this.isLoading) {
                    hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Still loading after 3s, craftError=%{public}s', this.craftError);
                    if (this.craftError) {
                        this.errorMessage = this.craftError;
                    } else {
                        this.errorMessage = 'Activity creation timed out. Check hdc hilog -T CRAFT for details.';
                    }
                    this.isLoading = false;
                }
            }, 3000) as number;

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.errorMessage = `Setup failed: ${msg}`;
            this.isLoading = false;
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Setup failed: %{public}s', msg);
        }
    }

    aboutToDisappear(): void {
        hilog.info(DOMAIN, TAG, '[CraftPage][INFO] aboutToDisappear');
        if (this.diagTimer !== -1) {
            clearTimeout(this.diagTimer);
            this.diagTimer = -1;
        }
    }

    build() {
        Column() {
            if (this.isLoading) {
                this.loadingView();
            } else if (this.errorMessage) {
                this.errorView();
            } else if (this.viewTree !== null) {
                this.renderView(this.viewTree);
            } else {
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
        } else if (view.type === 'Button') {
            this.renderButton(view);
        } else if (view.type === 'LinearLayout') {
            this.renderLinearLayout(view);
        } else if (view.type === 'ViewGroup') {
            this.renderViewGroup(view);
        } else {
            Text(`Unknown View: ${view.type}`)
                .fontSize(14)
                .fontColor('#FF0000')
        }
    }

    private getViewPropString(view: SerializedView, key: string, fallback: string): string {
        const val = view.props[key];
        return (val !== undefined && val !== null) ? String(val) : fallback;
    }

    private getViewPropNumber(view: SerializedView, key: string, fallback: number): number {
        const val = view.props[key];
        return (val !== undefined && val !== null) ? Number(val) : fallback;
    }

    /**
     * Extract viewRef from SerializedView id ('view_123' → 123)
     */
    private getViewRef(view: SerializedView): number {
        return parseInt(view.id.replace('view_', ''));
    }

    /**
     * Handle click on a view - dispatches through UIBridge
     */
    private handleClick(view: SerializedView): void {
        if (!this.runtime) {
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Click ignored: runtime is null');
            return;
        }
        try {
            const viewRef = this.getViewRef(view);
            hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Click on viewRef=%{public}d type=%{public}s', viewRef, view.type);
            const handled = this.runtime.getUIBridge().dispatchClick(viewRef);
            hilog.info(DOMAIN, TAG, '[CraftPage][INFO] Click dispatched: handled=%{public}s', String(handled));
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error && error.stack ? error.stack : '';
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Click handler failed: %{public}s', msg);
            hilog.error(DOMAIN, TAG, '[CraftPage][ERROR] Stack: %{public}s', stack);
        }
    }

    /**
     * Render TextView as ArkUI Text component
     */
    @Builder
    renderTextView(view: SerializedView) {
        Text(this.getViewPropString(view, 'text', ''))
            .fontSize(this.getViewPropNumber(view, 'textSize', 14))
            .fontColor(this.intToColor(this.getViewPropNumber(view, 'textColor', 0xFF000000)))
            .padding(4)
    }

    /**
     * Render Button as ArkUI Button component with click handling
     */
    @Builder
    renderButton(view: SerializedView) {
        Button(this.getViewPropString(view, 'text', ''))
            .fontSize(this.getViewPropNumber(view, 'textSize', 14))
            .fontColor(this.intToColor(this.getViewPropNumber(view, 'textColor', 0xFF000000)))
            .layoutWeight(1)
            .height(56)
            .margin(2)
            .onClick(() => {
                this.handleClick(view);
            })
    }

    /**
     * Render LinearLayout as Column (vertical) or Row (horizontal)
     */
    @Builder
    renderLinearLayout(view: SerializedView) {
        if (this.getViewPropNumber(view, 'orientation', 0) === 1) {
            // VERTICAL
            Column() {
                ForEach(view.children, (child: SerializedView) => {
                    this.renderView(child);
                }, (child: SerializedView) => `${child.id}_${this.updateCounter}`)
            }
            .width('100%')
        } else {
            // HORIZONTAL
            Row() {
                ForEach(view.children, (child: SerializedView) => {
                    this.renderView(child);
                }, (child: SerializedView) => `${child.id}_${this.updateCounter}`)
            }
            .width('100%')
        }
    }

    /**
     * Render ViewGroup as ArkUI Column (fallback)
     */
    @Builder
    renderViewGroup(view: SerializedView) {
        Column() {
            ForEach(view.children, (child: SerializedView) => {
                this.renderView(child);
            }, (child: SerializedView) => `${child.id}_${this.updateCounter}`)
        }
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
