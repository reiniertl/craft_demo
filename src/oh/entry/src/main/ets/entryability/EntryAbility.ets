import UIAbility from '@ohos.app.ability.UIAbility';
import AbilityConstant from '@ohos.app.ability.AbilityConstant';
import Want from '@ohos.app.ability.Want';
import window from '@ohos.window';
import hilog from '@ohos.hilog';
import { CraftParser } from '../CraftParser';

const DOMAIN = 0x0000;
const TAG = 'CRAFT';

/**
 * CRAFT Entry Ability - Minimal shell for APK parsing.
 *
 * Launch via:
 *   hdc shell aa start -a EntryAbility -b com.craft.parser --ps apk_path /path/to/app.apk
 *
 * View output:
 *   hdc hilog -T CRAFT
 */
export default class EntryAbility extends UIAbility {
    private apkPath: string = '';

    onCreate(want: Want, launchParam: AbilityConstant.LaunchParam): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onCreate');

        // Extract APK path from Want parameters
        if (want.parameters && want.parameters['apk_path']) {
            this.apkPath = want.parameters['apk_path'] as string;
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] APK path received: %{public}s', this.apkPath);
        } else {
            hilog.warn(DOMAIN, TAG, '[AbilityHost][WARN] No apk_path parameter provided');
        }
    }

    onDestroy(): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onDestroy');
    }

    onWindowStageCreate(windowStage: window.WindowStage): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onWindowStageCreate');

        // Parse APK if path was provided
        if (this.apkPath) {
            this.parseApk(this.apkPath);
        }

        // Load minimal page (required by UIAbility)
        windowStage.loadContent('pages/Index', (err, data) => {
            if (err.code) {
                hilog.error(DOMAIN, TAG, '[AbilityHost][ERROR] Failed to load page: %{public}s', JSON.stringify(err));
                return;
            }
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Page loaded');
        });
    }

    onWindowStageDestroy(): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onWindowStageDestroy');
    }

    onForeground(): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onForeground');
    }

    onBackground(): void {
        hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Ability onBackground');
    }

    /**
     * Parse the APK and log results.
     */
    private async parseApk(apkPath: string): Promise<void> {
        try {
            const parser = new CraftParser();
            const result = await parser.parseApkFile(apkPath);

            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Parsing complete');
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Package: %{public}s', result.packageName);
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Main Activity: %{public}s', result.mainActivityClass);
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Class count: %{public}d', result.classCount);
            hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Method count: %{public}d', result.methodCount);

            if (result.mainActivityCodeSize !== undefined) {
                hilog.info(DOMAIN, TAG, '[AbilityHost][INFO] Main Activity bytecode: %{public}d code units', result.mainActivityCodeSize);
            }

        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            hilog.error(DOMAIN, TAG, '[AbilityHost][ERROR] Parse failed: %{public}s', errMsg);
        }
    }
}
