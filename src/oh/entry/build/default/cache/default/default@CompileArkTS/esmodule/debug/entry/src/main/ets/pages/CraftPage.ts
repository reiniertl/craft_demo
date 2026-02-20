if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface CraftPage_Params {
    runtime?: CraftRuntime | null;
    activityRef?: number;
    viewTree?: SerializedView | null;
    updateCounter?: number;
    errorMessage?: string;
    isLoading?: boolean;
}
import type { CraftRuntime, SerializedView } from '../craft/index';
import hilog from "@ohos:hilog";
const DOMAIN = 0x0000;
const TAG = 'CRAFT';
class CraftPage extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__runtime = this.createStorageLink('craftRuntime', null, "runtime");
        this.__activityRef = this.createStorageLink('activityRef', 0, "activityRef");
        this.__viewTree = new ObservedPropertyObjectPU(null, this, "viewTree");
        this.__updateCounter = new ObservedPropertySimplePU(0, this, "updateCounter");
        this.__errorMessage = new ObservedPropertySimplePU('', this, "errorMessage");
        this.__isLoading = new ObservedPropertySimplePU(true, this, "isLoading");
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: CraftPage_Params) {
        if (params.viewTree !== undefined) {
            this.viewTree = params.viewTree;
        }
        if (params.updateCounter !== undefined) {
            this.updateCounter = params.updateCounter;
        }
        if (params.errorMessage !== undefined) {
            this.errorMessage = params.errorMessage;
        }
        if (params.isLoading !== undefined) {
            this.isLoading = params.isLoading;
        }
    }
    updateStateVars(params: CraftPage_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__runtime.purgeDependencyOnElmtId(rmElmtId);
        this.__activityRef.purgeDependencyOnElmtId(rmElmtId);
        this.__viewTree.purgeDependencyOnElmtId(rmElmtId);
        this.__updateCounter.purgeDependencyOnElmtId(rmElmtId);
        this.__errorMessage.purgeDependencyOnElmtId(rmElmtId);
        this.__isLoading.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__runtime.aboutToBeDeleted();
        this.__activityRef.aboutToBeDeleted();
        this.__viewTree.aboutToBeDeleted();
        this.__updateCounter.aboutToBeDeleted();
        this.__errorMessage.aboutToBeDeleted();
        this.__isLoading.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __runtime: ObservedPropertyAbstractPU<CraftRuntime | null>;
    get runtime() {
        return this.__runtime.get();
    }
    set runtime(newValue: CraftRuntime | null) {
        this.__runtime.set(newValue);
    }
    private __activityRef: ObservedPropertyAbstractPU<number>;
    get activityRef() {
        return this.__activityRef.get();
    }
    set activityRef(newValue: number) {
        this.__activityRef.set(newValue);
    }
    private __viewTree: ObservedPropertyObjectPU<SerializedView | null>;
    get viewTree() {
        return this.__viewTree.get();
    }
    set viewTree(newValue: SerializedView | null) {
        this.__viewTree.set(newValue);
    }
    private __updateCounter: ObservedPropertySimplePU<number>;
    get updateCounter() {
        return this.__updateCounter.get();
    }
    set updateCounter(newValue: number) {
        this.__updateCounter.set(newValue);
    }
    private __errorMessage: ObservedPropertySimplePU<string>;
    get errorMessage() {
        return this.__errorMessage.get();
    }
    set errorMessage(newValue: string) {
        this.__errorMessage.set(newValue);
    }
    private __isLoading: ObservedPropertySimplePU<boolean>;
    get isLoading() {
        return this.__isLoading.get();
    }
    set isLoading(newValue: boolean) {
        this.__isLoading.set(newValue);
    }
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
        }
        catch (error) {
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
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.backgroundColor('#FFFFFF');
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (this.isLoading) {
                this.ifElseBranchUpdateFunction(0, () => {
                    // Loading state
                    this.loadingView.bind(this)();
                });
            }
            else if (this.errorMessage) {
                this.ifElseBranchUpdateFunction(1, () => {
                    // Error state
                    this.errorView.bind(this)();
                });
            }
            else if (this.viewTree !== null) {
                this.ifElseBranchUpdateFunction(2, () => {
                    // Render Android view tree
                    this.renderView.bind(this)(ObservedObject.GetRawObject(this.viewTree));
                });
            }
            else {
                this.ifElseBranchUpdateFunction(3, () => {
                    // No content yet
                    this.emptyView.bind(this)();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    loadingView(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Loading Android App...');
            Text.fontSize(20);
            Text.fontColor('#666666');
        }, Text);
        Text.pop();
        Column.pop();
    }
    errorView(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
            Column.padding(20);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Error');
            Text.fontSize(24);
            Text.fontWeight(FontWeight.Bold);
            Text.fontColor('#FF0000');
            Text.margin({ bottom: 20 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.errorMessage);
            Text.fontSize(16);
            Text.fontColor('#666666');
            Text.textAlign(TextAlign.Center);
        }, Text);
        Text.pop();
        Column.pop();
    }
    emptyView(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
            Column.justifyContent(FlexAlign.Center);
            Column.alignItems(HorizontalAlign.Center);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('Waiting for content...');
            Text.fontSize(18);
            Text.fontColor('#999999');
        }, Text);
        Text.pop();
        Column.pop();
    }
    /**
     * Recursively render Android View as ArkUI component
     */
    renderView(view: SerializedView, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (view.type === 'TextView') {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.renderTextView.bind(this)(view);
                });
            }
            else if (view.type === 'ViewGroup') {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.renderViewGroup.bind(this)(view);
                });
            }
            else {
                this.ifElseBranchUpdateFunction(2, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // Unknown view type - render as text for debugging
                        Text.create(`Unknown View: ${view.type}`);
                        // Unknown view type - render as text for debugging
                        Text.fontSize(14);
                        // Unknown view type - render as text for debugging
                        Text.fontColor('#FF0000');
                    }, Text);
                    // Unknown view type - render as text for debugging
                    Text.pop();
                });
            }
        }, If);
        If.pop();
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
     * Render TextView as ArkUI Text component
     */
    renderTextView(view: SerializedView, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.getViewPropString(view, 'text', ''));
            Text.fontSize(this.getViewPropNumber(view, 'textSize', 14));
            Text.fontColor(this.intToColor(this.getViewPropNumber(view, 'textColor', 0xFF000000)));
        }, Text);
        Text.pop();
    }
    /**
     * Render ViewGroup as ArkUI Column
     */
    renderViewGroup(view: SerializedView, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const child = _item;
                this.renderView.bind(this)(child);
            };
            this.forEachUpdateFunction(elmtId, view.children, forEachItemGenFunction, (child: SerializedView) => child.id, false, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    /**
     * Convert Android ARGB integer to ArkUI Color
     * Format: 0xAARRGGBB
     */
    private intToColor(argb: number | undefined): string {
        if (argb === undefined) {
            return '#FF000000'; // Black
        }
        const a = (argb >> 24) & 0xFF;
        const r = (argb >> 16) & 0xFF;
        const g = (argb >> 8) & 0xFF;
        const b = argb & 0xFF;
        // Convert to CSS rgba
        const alpha = a / 255;
        return `rgba(${r},${g},${b},${alpha})`;
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "CraftPage";
    }
}
registerNamedRoute(() => new CraftPage(undefined, {}), "", { bundleName: "com.craft.runtime", moduleName: "entry", pagePath: "pages/CraftPage", pageFullPath: "entry/src/main/ets/pages/CraftPage", integratedHsp: "false", moduleType: "followWithHap" });
