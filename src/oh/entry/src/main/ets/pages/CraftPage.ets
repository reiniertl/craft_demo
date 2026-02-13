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
