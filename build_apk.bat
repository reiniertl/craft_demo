@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: CRAFT - Build Demo APK (STORE compression, no DEFLATE)
:: ============================================================================
:: Usage: build_apk.bat [app_name]
::
::   build_apk.bat                 - builds hello_world (default)
::   build_apk.bat hello_world     - builds hello_world
::   build_apk.bat calculator      - builds calculator
::   build_apk.bat clock           - builds clock
::   build_apk.bat all             - builds all demo apps
::
:: Output: test\fixtures\%APP_NAME%.apk
::
:: Sources are read from demo\%APP_NAME%\
::
:: Requirements:
::   - Android Studio (bundled JDK at jbr\)
::   - Android SDK (build-tools + platform)
::   - 7-Zip (https://7-zip.org/)
::
:: The APK is built with STORE compression (no DEFLATE) because the CRAFT
:: parser only supports uncompressed ZIP entries. The manifest includes
:: uses-sdk with minSdkVersion=24 and targetSdkVersion=33 so the APK
:: can also be tested on a real Android device before deploying to
:: OpenHarmony via CRAFT.
:: ============================================================================

:: --- App selection -----------------------------------------------------------
set APP_NAME=%~1
if "%APP_NAME%"=="" set APP_NAME=hello_world

:: --- Handle "all" ------------------------------------------------------------
if "%APP_NAME%"=="all" (
    echo Building all demo apps...
    echo.
    set ALL_OK=1
    for %%A in (hello_world calculator clock) do (
        echo ================================================================
        call "%~f0" %%A
        if errorlevel 1 (
            set ALL_OK=0
            echo.
            echo FAILED: %%A
            echo.
        )
        echo.
    )
    echo ================================================================
    if "!ALL_OK!"=="1" (
        echo.
        echo SUCCESS: All demo apps built.
    ) else (
        echo.
        echo SOME BUILDS FAILED. Check the output above.
        exit /b 1
    )
    goto :end
)

:: --- Map app name to package -------------------------------------------------
if "%APP_NAME%"=="hello_world" (
    set PACKAGE=com.example.helloworld
    set PACKAGE_PATH=com\example\helloworld
) else if "%APP_NAME%"=="calculator" (
    set PACKAGE=com.example.calculator
    set PACKAGE_PATH=com\example\calculator
) else if "%APP_NAME%"=="clock" (
    set PACKAGE=com.example.clock
    set PACKAGE_PATH=com\example\clock
) else (
    echo ERROR: Unknown app "%APP_NAME%". Supported apps: hello_world, calculator, clock, all
    goto :fail
)

echo Building %APP_NAME% (package: %PACKAGE%)...
echo.

:: --- Configuration (edit these to match your system) ------------------------
set ANDROID_SDK=C:\Users\Bluezone1\AppData\Local\Android\Sdk
set BUILD_TOOLS=%ANDROID_SDK%\build-tools\36.1.0
set PLATFORM_JAR=%ANDROID_SDK%\platforms\android-36.1\android.jar
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set SEVENZIP=C:\Program Files\7-Zip\7z.exe
set CRAFT_DIR=D:\craft\craft
set WORK_DIR=D:\tmp\%APP_NAME%_apk
:: ----------------------------------------------------------------------------

:: --- Validate configuration -------------------------------------------------
if not exist "%JAVA_HOME%\bin\javac.exe" (
    echo ERROR: javac not found at %JAVA_HOME%\bin\javac.exe
    echo        Edit JAVA_HOME in this script to point to your JDK.
    goto :fail
)
if not exist "%BUILD_TOOLS%\d8.bat" (
    echo ERROR: build-tools not found at %BUILD_TOOLS%
    echo        Edit BUILD_TOOLS in this script. Check installed versions with:
    echo        dir "%ANDROID_SDK%\build-tools"
    goto :fail
)
if not exist "%PLATFORM_JAR%" (
    echo ERROR: android.jar not found at %PLATFORM_JAR%
    echo        Edit PLATFORM_JAR in this script. Check installed versions with:
    echo        dir "%ANDROID_SDK%\platforms"
    goto :fail
)
if not exist "%SEVENZIP%" (
    echo ERROR: 7-Zip not found at %SEVENZIP%
    echo        Install from https://7-zip.org/ or edit SEVENZIP in this script.
    goto :fail
)

:: --- Validate source files exist ---------------------------------------------
if not exist "%CRAFT_DIR%\demo\%APP_NAME%\MainActivity.java" (
    echo ERROR: Source not found: demo\%APP_NAME%\MainActivity.java
    goto :fail
)
if not exist "%CRAFT_DIR%\demo\%APP_NAME%\AndroidManifest.xml" (
    echo ERROR: Manifest not found: demo\%APP_NAME%\AndroidManifest.xml
    goto :fail
)
:: ----------------------------------------------------------------------------

echo [1/8] Setting up work directory...
if exist "%WORK_DIR%" rmdir /s /q "%WORK_DIR%"
mkdir "%WORK_DIR%"
mkdir "%WORK_DIR%\src\%PACKAGE_PATH%"
copy "%CRAFT_DIR%\demo\%APP_NAME%\MainActivity.java" "%WORK_DIR%\src\%PACKAGE_PATH%\" >nul
copy "%CRAFT_DIR%\demo\%APP_NAME%\AndroidManifest.xml" "%WORK_DIR%\" >nul

echo [2/8] Compiling Java to class files...
"%JAVA_HOME%\bin\javac.exe" -source 1.8 -target 1.8 -classpath "%PLATFORM_JAR%" -d "%WORK_DIR%\classes" "%WORK_DIR%\src\%PACKAGE_PATH%\MainActivity.java"
if errorlevel 1 (
    echo ERROR: javac failed.
    goto :fail
)

echo [3/8] Converting to DEX bytecode...
mkdir "%WORK_DIR%\dex_output"
call "%BUILD_TOOLS%\d8.bat" "%WORK_DIR%\classes\%PACKAGE_PATH%\MainActivity.class" --output "%WORK_DIR%\dex_output"
if errorlevel 1 (
    echo ERROR: d8 failed.
    goto :fail
)

echo [4/8] Creating base APK with aapt2 (binary manifest)...
"%BUILD_TOOLS%\aapt2.exe" link -o "%WORK_DIR%\temp_aapt.apk" --manifest "%WORK_DIR%\AndroidManifest.xml" -I "%PLATFORM_JAR%"
if errorlevel 1 (
    echo ERROR: aapt2 failed.
    goto :fail
)

echo [5/8] Repacking APK with STORE compression (no DEFLATE)...
mkdir "%WORK_DIR%\apk_contents"
"%SEVENZIP%" x -o"%WORK_DIR%\apk_contents" "%WORK_DIR%\temp_aapt.apk" >nul
copy "%WORK_DIR%\dex_output\classes.dex" "%WORK_DIR%\apk_contents\" >nul
"%SEVENZIP%" a -tzip -mx0 "%WORK_DIR%\%APP_NAME%_unsigned.apk" "%WORK_DIR%\apk_contents\*" >nul
if errorlevel 1 (
    echo ERROR: 7-Zip repack failed.
    goto :fail
)

echo [6/8] Aligning APK...
"%BUILD_TOOLS%\zipalign.exe" -f 4 "%WORK_DIR%\%APP_NAME%_unsigned.apk" "%WORK_DIR%\%APP_NAME%_aligned.apk"
if errorlevel 1 (
    echo ERROR: zipalign failed.
    goto :fail
)

echo [7/8] Signing APK...
if not exist "%WORK_DIR%\debug.keystore" (
    "%JAVA_HOME%\bin\keytool.exe" -genkeypair -v -keystore "%WORK_DIR%\debug.keystore" -alias debug -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Debug" >nul 2>&1
)
"%JAVA_HOME%\bin\java.exe" -jar "%BUILD_TOOLS%\lib\apksigner.jar" sign --ks "%WORK_DIR%\debug.keystore" --ks-pass pass:android --out "%WORK_DIR%\%APP_NAME%.apk" "%WORK_DIR%\%APP_NAME%_aligned.apk"
if errorlevel 1 (
    echo ERROR: apksigner failed.
    goto :fail
)

echo [8/8] Copying to CRAFT test fixtures...
copy "%WORK_DIR%\%APP_NAME%.apk" "%CRAFT_DIR%\test\fixtures\%APP_NAME%.apk" >nul

echo.
echo SUCCESS: %APP_NAME%.apk built and copied to test\fixtures\
echo.
echo Verify with:
echo   cd %CRAFT_DIR%
echo   npm run analyze-apk test/fixtures/%APP_NAME%.apk
echo.
echo Optional - test on Android device:
echo   adb install "%WORK_DIR%\%APP_NAME%.apk"
echo   adb shell am start -n %PACKAGE%/.MainActivity
goto :end

:fail
echo.
echo BUILD FAILED. Check the error above.
exit /b 1

:end
endlocal
