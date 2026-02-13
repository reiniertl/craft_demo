import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import hilog from '@ohos.hilog';
import { CraftRuntime } from '../craft/runtime';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * CRAFT Entry Ability - Full runtime host for Android APKs
 *
 * Launch via:
 *   hdc shell aa start -a EntryAbility -b com.craft.runtime \
 *     --ps apk_path /data/app/hello_world.apk
 *
 * View logs:
 *   hdc hilog -T CRAFT
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
                this.runtime.destroyActivity(this.activityRef);
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
                this.runtime.pauseActivity(this.activityRef);
                hilog.info(DOMAIN, TAG, '[CraftAbility][INFO] Activity paused');
            } catch (error) {
                const msg = error instanceof Error ? error.message : String(error);
                hilog.error(DOMAIN, TAG, '[CraftAbility][ERROR] Pause failed: %{public}s', msg);
            }
        }
    }
}
