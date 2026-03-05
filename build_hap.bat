@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CRAFT - Build HAP for OpenHarmony
:: ============================================================================
:: Usage: build_hap.bat
:: Output: src\oh\entry\build\default\outputs\default\entry-default-unsigned.hap
::
:: Requirements:
::   - DevEco Studio (with OpenHarmony SDK API 21+)
::   - Node.js 18+
::
:: The HAP bundles the CRAFT runtime which loads and executes Android APKs
:: on OpenHarmony devices using the CRAFT interpreter, shim layer, and
:: ArkUI bridge.
:: ============================================================================

:: --- Configuration (edit these to match your system) ------------------------
set DEVECO_HOME=C:\Program Files\Huawei\DevEco Studio
set CRAFT_DIR=D:\craft\craft
set OH_DIR=%CRAFT_DIR%\src\oh
:: SDK path (hvigor expects versioned layout: <sdk.dir>\<apiVersion>\<component>)
set SDK_DIR=C:\Users\%USERNAME%\OpenHarmony\Sdk
:: ----------------------------------------------------------------------------

:: --- Add Java to PATH (DevEco bundles JBR) -----------------------------------
if exist "%DEVECO_HOME%\jbr\bin\java.exe" (
    set "JAVA_HOME=%DEVECO_HOME%\jbr"
    set "PATH=%DEVECO_HOME%\jbr\bin;%PATH%"
) else (
    where java >nul 2>&1
    if errorlevel 1 (
        echo ERROR: Java not found. DevEco jbr not found at %DEVECO_HOME%\jbr
        echo        and java is not on PATH.
        goto :fail
    )
)

:: --- Set HVIGOR_USER_HOME to avoid "space in path" errors -------------------
if not defined HVIGOR_USER_HOME set "HVIGOR_USER_HOME=%USERPROFILE%\.hvigor"

:: --- Ensure .npmrc exists (hvigor requires it) ------------------------------
if not exist "%USERPROFILE%\.npmrc" (
    echo registry=https://repo.huaweicloud.com/repository/npm/> "%USERPROFILE%\.npmrc"
    echo @ohos:registry=https://repo.harmonyos.com/npm/>> "%USERPROFILE%\.npmrc"
    echo NOTE: Created %USERPROFILE%\.npmrc with OpenHarmony registries.
)

:: --- Bootstrap hvigor workspace -----------------------------------------------
set "HVIGOR_TOOLS=%HVIGOR_USER_HOME%\wrapper\tools"

:: Step A: install pnpm into hvigor tools
if exist "%HVIGOR_TOOLS%\node_modules\pnpm" goto :pnpm_ok
echo NOTE: Installing pnpm into hvigor workspace...
if not exist "%HVIGOR_TOOLS%" mkdir "%HVIGOR_TOOLS%"
if not exist "%HVIGOR_TOOLS%\package.json" echo {"dependencies":{"pnpm":"8.13.1"}}> "%HVIGOR_TOOLS%\package.json"
pushd "%HVIGOR_TOOLS%"
npm install
if errorlevel 1 (
    popd
    echo ERROR: Failed to install pnpm in hvigor workspace.
    goto :fail
)
popd
:pnpm_ok

:: Step B: install hvigor plugin into project cache
set "PNPM_CMD=%HVIGOR_TOOLS%\node_modules\.bin\pnpm.cmd"
for /d %%D in ("%HVIGOR_USER_HOME%\project_caches\*") do (
    if exist "%%D\workspace\package.json" (
        if not exist "%%D\workspace\node_modules\@ohos\hvigor-ohos-plugin" (
            echo NOTE: Installing hvigor plugin in workspace cache...
            pushd "%%D\workspace"
            call "%PNPM_CMD%" install
            popd
        )
    )
)

:: --- Auto-detect tools ------------------------------------------------------
set OHPM_CMD=
set HVIGORW_CMD=
set HVIGORW_NODE=0

where ohpm >nul 2>&1
if %errorlevel% equ 0 (
    set "OHPM_CMD=ohpm"
) else (
    if exist "%DEVECO_HOME%\tools\ohpm\bin\ohpm.cmd" (
        set "OHPM_CMD=%DEVECO_HOME%\tools\ohpm\bin\ohpm.cmd"
    ) else if exist "%DEVECO_HOME%\tools\ohpm\bin\ohpm.bat" (
        set "OHPM_CMD=%DEVECO_HOME%\tools\ohpm\bin\ohpm.bat"
    )
)

where hvigorw >nul 2>&1
if %errorlevel% equ 0 (
    set "HVIGORW_CMD=hvigorw"
) else (
    if exist "%DEVECO_HOME%\tools\hvigor\bin\hvigorw.js" (
        set "HVIGORW_CMD=%DEVECO_HOME%\tools\hvigor\bin\hvigorw.js"
        set HVIGORW_NODE=1
    ) else if exist "%DEVECO_HOME%\tools\hvigor\bin\hvigorw.bat" (
        set "HVIGORW_CMD=%DEVECO_HOME%\tools\hvigor\bin\hvigorw.bat"
    )
)
:: ----------------------------------------------------------------------------

:: --- Validate configuration -------------------------------------------------
echo.
echo ============================================================
echo  CRAFT HAP Builder
echo ============================================================
echo.

if not exist "%CRAFT_DIR%\src\oh" (
    echo ERROR: CRAFT project not found at %CRAFT_DIR%
    echo        Edit CRAFT_DIR in this script.
    goto :fail
)

if "!OHPM_CMD!" == "" (
    echo ERROR: ohpm not found in PATH or DevEco installation.
    echo        Edit DEVECO_HOME in this script to point to your DevEco Studio.
    echo        Current: %DEVECO_HOME%
    goto :fail
)

if "!HVIGORW_CMD!" == "" (
    echo ERROR: hvigorw not found in PATH or DevEco installation.
    echo        Edit DEVECO_HOME in this script to point to your DevEco Studio.
    echo        Current: %DEVECO_HOME%
    goto :fail
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: node not found in PATH. Node.js 18+ is required.
    goto :fail
)

echo   CRAFT_DIR:  %CRAFT_DIR%
echo   OH_DIR:     %OH_DIR%
echo   JAVA_HOME:  %JAVA_HOME%
echo   OHPM:       "!OHPM_CMD!"
if !HVIGORW_NODE! equ 1 (
    echo   HVIGORW:    node "!HVIGORW_CMD!"
) else (
    echo   HVIGORW:    "!HVIGORW_CMD!"
)
echo.

:: --- Step 1: Sync CRAFT modules into OH project ----------------------------
echo [1/7] Syncing CRAFT modules into OH project...

set "ETS_CRAFT=%OH_DIR%\entry\src\main\ets\craft"

:: Remove stale copy and recreate
if exist "%ETS_CRAFT%" rmdir /s /q "%ETS_CRAFT%"
mkdir "%ETS_CRAFT%"

:: Copy each module
xcopy /s /q /y "%CRAFT_DIR%\src\core" "%ETS_CRAFT%\core\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy core module.
    goto :fail
)

xcopy /s /q /y "%CRAFT_DIR%\src\parser" "%ETS_CRAFT%\parser\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy parser module.
    goto :fail
)

xcopy /s /q /y "%CRAFT_DIR%\src\interpreter" "%ETS_CRAFT%\interpreter\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy interpreter module.
    goto :fail
)

xcopy /s /q /y "%CRAFT_DIR%\src\shim" "%ETS_CRAFT%\shim\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy shim module.
    goto :fail
)

xcopy /s /q /y "%CRAFT_DIR%\src\bridge" "%ETS_CRAFT%\bridge\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy bridge module.
    goto :fail
)

copy /y "%CRAFT_DIR%\src\runtime.ts" "%ETS_CRAFT%\" >nul
copy /y "%CRAFT_DIR%\src\index.ts" "%ETS_CRAFT%\" >nul

echo          Synced: core, parser, interpreter, shim, bridge, runtime, index

:: --- Step 2: Apply ArkTS patches -------------------------------------------
echo [2/7] Applying ArkTS compatibility patches...

powershell -NoProfile -ExecutionPolicy Bypass -File "%CRAFT_DIR%\tools\patch_arkts.ps1" -CraftEtsDir "%ETS_CRAFT%"
if errorlevel 1 (
    echo ERROR: ArkTS patching failed.
    goto :fail
)

:: --- Step 3: Create placeholder icons if missing ---------------------------
echo [3/7] Checking icon resources...

set "APP_MEDIA=%OH_DIR%\AppScope\resources\base\media"
set "ENTRY_MEDIA=%OH_DIR%\entry\src\main\resources\base\media"
set ICONS_CREATED=0

set "ICON_SCRIPT=%TEMP%\craft_gen_icon.ps1"
echo Add-Type -AssemblyName System.Drawing > "%ICON_SCRIPT%"
echo $bmp = New-Object System.Drawing.Bitmap(48,48) >> "%ICON_SCRIPT%"
echo $g = [System.Drawing.Graphics]::FromImage($bmp) >> "%ICON_SCRIPT%"
echo $g.Clear([System.Drawing.Color]::FromArgb(0,122,255)) >> "%ICON_SCRIPT%"
echo $g.Dispose() >> "%ICON_SCRIPT%"
echo $bmp.Save($args[0], [System.Drawing.Imaging.ImageFormat]::Png) >> "%ICON_SCRIPT%"
echo $bmp.Dispose() >> "%ICON_SCRIPT%"

if exist "%APP_MEDIA%\app_icon.png" goto :app_icon_ok
if not exist "%APP_MEDIA%" mkdir "%APP_MEDIA%"
echo          Creating placeholder app_icon.png...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ICON_SCRIPT%" "%APP_MEDIA%\app_icon.png"
if errorlevel 1 (
    echo WARNING: Could not create app_icon.png.
) else (
    set ICONS_CREATED=1
)
goto :app_icon_done
:app_icon_ok
echo          app_icon.png exists
:app_icon_done

if exist "%ENTRY_MEDIA%\icon.png" goto :entry_icon_ok
if not exist "%ENTRY_MEDIA%" mkdir "%ENTRY_MEDIA%"
echo          Creating placeholder icon.png...
powershell -NoProfile -ExecutionPolicy Bypass -File "%ICON_SCRIPT%" "%ENTRY_MEDIA%\icon.png"
if errorlevel 1 (
    echo WARNING: Could not create icon.png.
) else (
    set ICONS_CREATED=1
)
goto :entry_icon_done
:entry_icon_ok
echo          icon.png exists
:entry_icon_done

del "%ICON_SCRIPT%" >nul 2>&1
if %ICONS_CREATED% equ 1 echo          Placeholder icons created

:: --- Step 4: Validate configuration files -----------------------------------
echo [4/7] Validating configuration...

if not exist "%OH_DIR%\hvigor\hvigor-config.json5" (
    echo ERROR: hvigor-config.json5 not found at %OH_DIR%\hvigor\
    goto :fail
)
echo          hvigor-config.json5: OK

findstr /c:"CraftPage" "%OH_DIR%\entry\src\main\resources\base\profile\main_pages.json" >nul 2>&1
if errorlevel 1 (
    echo ERROR: main_pages.json does not include CraftPage.
    goto :fail
)
echo          main_pages.json: OK

findstr /c:"com.craft.runtime" "%OH_DIR%\AppScope\app.json5" >nul 2>&1
if errorlevel 1 (
    echo WARNING: Bundle name is not com.craft.runtime in app.json5
)
echo          app.json5: OK

:: --- Step 5: Ensure SDK directory structure ----------------------------------
echo [5/7] Checking SDK directory structure...

if not exist "%SDK_DIR%\21\ets" (
    echo          Setting up SDK versioned directory at %SDK_DIR%\21...
    if not exist "%SDK_DIR%\21" mkdir "%SDK_DIR%\21"
    set "SDK_SRC=%DEVECO_HOME%\sdk\default\openharmony"
    if exist "!SDK_SRC!\ets" (
        mklink /J "%SDK_DIR%\21\ets" "!SDK_SRC!\ets" >nul 2>&1
        mklink /J "%SDK_DIR%\21\js" "!SDK_SRC!\js" >nul 2>&1
        mklink /J "%SDK_DIR%\21\native" "!SDK_SRC!\native" >nul 2>&1
        mklink /J "%SDK_DIR%\21\previewer" "!SDK_SRC!\previewer" >nul 2>&1
        mklink /J "%SDK_DIR%\21\toolchains" "!SDK_SRC!\toolchains" >nul 2>&1
        echo          SDK symlinks created
    ) else (
        echo WARNING: DevEco SDK not found at !SDK_SRC!
        echo          You may need to configure sdk.dir in local.properties manually.
    )
) else (
    echo          SDK directory structure: OK
)

:: Write local.properties without trailing space
:: (cmd echo adds trailing space, so use a temp file approach)
>"%OH_DIR%\local.properties" (
    set /p "=sdk.dir=" <nul
    set "SDK_FWD=%SDK_DIR:\=/%"
    echo !SDK_FWD!
)

:: --- Step 6: Install dependencies -------------------------------------------
echo [6/7] Installing dependencies (ohpm)...

pushd "%OH_DIR%"
call "!OHPM_CMD!" install
if errorlevel 1 (
    echo ERROR: ohpm install failed.
    popd
    goto :fail
)
popd

echo          Dependencies installed

:: --- Step 7: Build HAP ------------------------------------------------------
echo [7/7] Building HAP (hvigorw assembleHap)...

:: Stop any running daemon (stale state causes "root node" errors)
pushd "%OH_DIR%"
if !HVIGORW_NODE! equ 1 (
    call node "!HVIGORW_CMD!" --stop-daemon >nul 2>&1
) else (
    call "!HVIGORW_CMD!" --stop-daemon >nul 2>&1
)

if !HVIGORW_NODE! equ 1 (
    call node "!HVIGORW_CMD!" assembleHap --no-daemon
) else (
    call "!HVIGORW_CMD!" assembleHap --no-daemon
)
set BUILD_RESULT=%errorlevel%
popd

if %BUILD_RESULT% neq 0 (
    echo.
    echo ERROR: hvigorw assembleHap failed.
    echo.
    echo Troubleshooting:
    echo   1. Open src\oh\ in DevEco Studio and try Build ^> Build Hap(s^)
    echo   2. Check that OpenHarmony SDK is installed
    echo   3. Run: "!OHPM_CMD!" install  in src\oh\
    echo   4. Check for ArkTS errors in the ets\ directory
    goto :fail
)

:: --- Report success ---------------------------------------------------------
set "HAP_PATH=%OH_DIR%\entry\build\default\outputs\default\entry-default-signed.hap"
set "HAP_UNSIGNED=%OH_DIR%\entry\build\default\outputs\default\entry-default-unsigned.hap"

echo.
echo ============================================================
echo  SUCCESS: CRAFT HAP built
echo ============================================================
echo.

if exist "%HAP_PATH%" (
    echo   Signed HAP: %HAP_PATH%
) else if exist "%HAP_UNSIGNED%" (
    echo   Unsigned HAP: %HAP_UNSIGNED%
    echo   NOTE: No signing config. Configure signing in DevEco Studio
    echo         or in build-profile.json5 signingConfigs section.
) else (
    echo   HAP output: check %OH_DIR%\entry\build\ for output files
)

echo.
echo Deploy to device:
echo   hdc install "%HAP_UNSIGNED%"
echo   hdc file send test\fixtures\hello_world.apk /data/app/hello_world.apk
echo   hdc shell aa start -a EntryAbility -b com.craft.runtime --ps apk_path /data/app/hello_world.apk
echo.
echo View logs:
echo   hdc hilog -T CRAFT
echo.
echo Uninstall:
echo   hdc uninstall com.craft.runtime
goto :end

:fail
echo.
echo BUILD FAILED. Check the error above.
exit /b 1

:end
endlocal
