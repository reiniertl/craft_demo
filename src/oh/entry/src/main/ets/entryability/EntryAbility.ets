import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import hilog from '@ohos.hilog';
import fs from '@ohos.file.fs';
import { CraftRuntime } from '../craft/runtime';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * CRAFT Entry Ability - Full runtime host for Android APKs
 *
 * Launch with external APK:
 *   hdc shell aa start -a EntryAbility -b com.craft.runtime \
 *     --ps apk_path /data/app/hello_world.apk
 *
 * Launch with bundled APK (no parameters needed):
 *   hdc shell aa start -a EntryAbility -b com.craft.runtime
 *
 * View logs:
 *   hdc hilog -T CRAFT
 */
export default class CraftAbility extends UIAbility {
    private runtime: CraftRuntime | null = null;
    private apkPath: string = '';
    private useBundledApk: boolean = false;
    private activityRef: number = 0;

    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onCreate');

        // Extract APK path from Want parameters
        if (want.parameters && want.parameters['apk_path']) {
            this.apkPath = want.parameters['apk_path'] as string;
            this.useBundledApk = false;
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] APK path: %{public}s', this.apkPath);
        } else {
            this.useBundledApk = true;
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] No apk_path provided, will use bundled APK');
        }

        // Initialize CRAFT runtime
        try {
            this.runtime = new CraftRuntime();
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Runtime initialized');
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Runtime init failed: %{public}s', msg);
        }
    }

    onDestroy(): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onDestroy');

        // Destroy Activity and cleanup
        if (this.runtime && this.activityRef) {
            try {
                this.runtime.destroyActivity();
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity destroyed');
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Destroy failed: %{public}s', msg);
            }
        }

        if (this.runtime) {
            this.runtime.shutdown();
            this.runtime = null;
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Runtime shutdown complete');
        }
    }

    onWindowStageCreate(windowStage: window.WindowStage): void {
        hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] onWindowStageCreate');

        try {
            if (!this.runtime) {
                throw new Error('Runtime not initialized');
            }

            // Load APK - either from filesystem or bundled rawfile
            // All operations are synchronous to avoid lifecycle timing issues.
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Loading APK...');
            if (this.useBundledApk) {
                const rawData = this.context.resourceManager.getRawFileContentSync('hello_world.apk');
                const apkData = new Uint8Array(rawData.buffer);
                this.runtime.loadAPK(apkData);
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Bundled APK loaded (%{public}d bytes)', apkData.length);
            } else {
                // Read external APK synchronously (no dynamic import needed)
                const file = fs.openSync(this.apkPath, fs.OpenMode.READ_ONLY);
                const stat = fs.statSync(this.apkPath);
                const buf = new ArrayBuffer(stat.size);
                fs.readSync(file.fd, buf);
                fs.closeSync(file);
                this.runtime.loadAPK(new Uint8Array(buf));
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] APK loaded from path (%{public}d bytes)', stat.size);
            }

            // Share runtime with page via AppStorage BEFORE loading page.
            // CraftPage.aboutToAppear() runs during loadContent, so the runtime
            // must already be in AppStorage for the page to subscribe to state.
            AppStorage.setOrCreate('craftRuntime', this.runtime);
            hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Runtime stored in AppStorage');

            // Load CraftPage - page subscribes to state updates in aboutToAppear()
            windowStage.loadContent('pages/CraftPage', (err) => {
                if (err && err.code) {
                    hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Failed to load page: %{public}s', JSON.stringify(err));
                    AppStorage.setOrCreate('craftError', `Page load failed: ${JSON.stringify(err)}`);
                    return;
                }

                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] CraftPage loaded');

                // Create Activity AFTER page is loaded and subscribed to state.
                // createActivity() calls Activity.onCreate() which calls
                // setContentView(), firing state notifications to CraftPage.
                try {
                    hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Creating Activity...');
                    this.activityRef = this.runtime!.createActivity();
                    AppStorage.setOrCreate('activityRef', this.activityRef);
                    hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity created: ref=%{public}d', this.activityRef);

                    this.runtime!.resumeActivity();
                    hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity resumed');
                } catch (error) {
                    const msg = error instanceof Error ? error.message : String(error);
                    hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Activity creation failed: %{public}s', msg);
                    AppStorage.setOrCreate('craftError', msg);
                }
            });

        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Setup failed: %{public}s', msg);
            AppStorage.setOrCreate('craftError', msg);
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
                this.runtime.resumeActivity();
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity resumed');
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
                this.runtime.pauseActivity();
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity paused');
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Pause failed: %{public}s', msg);
            }
        }
    }
}
