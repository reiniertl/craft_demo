# patch_arkts.ps1 - Apply ArkTS compatibility patches to CRAFT source
# Called by build_hap.bat after syncing source files
#
# ArkTS (OpenHarmony) has stricter rules than standard TypeScript:
#   - No 'fs' module (use @ohos.file.fs instead)
#   - No TextDecoder global (use manual UTF-8 decode)
#   - No 'any' type (use explicit union types)

param(
    [Parameter(Mandatory=$true)]
    [string]$CraftEtsDir
)

$ErrorActionPreference = 'Stop'

# Manual UTF-8 decoder function body (no TextDecoder in ArkTS)
$decodeUtf8Body = @'
    private static decodeUtf8(bytes: Uint8Array): string {
        let result = '';
        let i = 0;
        while (i < bytes.length) {
            const byte = bytes[i];
            if (byte < 0x80) {
                result += String.fromCharCode(byte);
                i++;
            } else if ((byte & 0xE0) === 0xC0) {
                result += String.fromCharCode(((byte & 0x1F) << 6) | (bytes[i + 1] & 0x3F));
                i += 2;
            } else if ((byte & 0xF0) === 0xE0) {
                result += String.fromCharCode(((byte & 0x0F) << 12) | ((bytes[i + 1] & 0x3F) << 6) | (bytes[i + 2] & 0x3F));
                i += 3;
            } else {
                const codePoint = ((byte & 0x07) << 18) | ((bytes[i + 1] & 0x3F) << 12) | ((bytes[i + 2] & 0x3F) << 6) | (bytes[i + 3] & 0x3F);
                const offset = codePoint - 0x10000;
                result += String.fromCharCode(0xD800 + (offset >> 10), 0xDC00 + (offset & 0x3FF));
                i += 4;
            }
        }
        return result;
    }
'@

# OH file API replacement for loadAPKFromPath
$ohFileApiCode = @'
    const ohFs = await import('@ohos.file.fs');
    const file = ohFs.default.openSync(apkPath, ohFs.default.OpenMode.READ_ONLY);
    const stat = ohFs.default.statSync(apkPath);
    const buf = new ArrayBuffer(stat.size);
    ohFs.default.readSync(file.fd, buf);
    ohFs.default.closeSync(file);
    const parser = new APKParser();
    const apkContents = parser.parse(new Uint8Array(buf));
'@

# --- Patch apk_parser.ts ---
$f = Join-Path $CraftEtsDir 'parser\apk_parser.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw

    # Remove fs import
    $c = $c -replace "import \* as fs from 'fs';\r?\n", ''

    # Replace TextDecoder with manual decode
    $c = $c -replace "new TextDecoder\('utf-8'\)\.decode\(fileNameBytes\)", 'APKParser.decodeUtf8(fileNameBytes)'

    # Replace parseFile/parseFileSync methods with decodeUtf8 static method
    $c = [regex]::Replace($c,
        '    /\*\*\s*\r?\n\s*\* Parse APK from file path\.\s*\r?\n[\s\S]*?parseFileSync\(path: string\): APKContents \{[\s\S]*?\}\r?\n',
        $decodeUtf8Body + "`r`n`r`n")

    # Remove file-based convenience exports (match through closing };)
    $c = $c -replace "export const parseAPKFile[\s\S]*?};\r?\n", ''
    $c = $c -replace "export const parseAPKFileSync[\s\S]*?};\r?\n", ''

    Set-Content $f $c -NoNewline
    Write-Host "  Patched: apk_parser.ts (removed fs, TextDecoder)"
}

# --- Patch manifest_parser.ts ---
$f = Join-Path $CraftEtsDir 'parser\manifest_parser.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw

    # Replace TextDecoder with manual decode
    $c = $c -replace "new TextDecoder\('utf-8'\)\.decode\(bytes\)", 'ManifestParser.decodeUtf8(bytes)'

    # Add decodeUtf8 method before the static parse() method
    $c = $c -replace '(    /\*\*\s*\r?\n\s*\* Static convenience method\.)', ($decodeUtf8Body + "`r`n`r`n" + '$1')

    Set-Content $f $c -NoNewline
    Write-Host "  Patched: manifest_parser.ts (removed TextDecoder)"
}

# --- Patch runtime.ts ---
$f = Join-Path $CraftEtsDir 'runtime.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw

    # Replace fs-based parseFile with OH file API
    $c = [regex]::Replace($c,
        'const parser = new APKParser\(\);\s*\r?\n\s*const apkContents = await parser\.parseFile\(apkPath\);\s*\r?\n\s*this\.loadAPKContents\(apkContents\);',
        ($ohFileApiCode + "`r`n    this.loadAPKContents(apkContents);"))

    Set-Content $f $c -NoNewline
    Write-Host "  Patched: runtime.ts (OH file API)"
}

# --- Patch index.ts ---
$f = Join-Path $CraftEtsDir 'index.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw
    $c = $c -replace ', parseAPKFile, parseAPKFileSync', ''
    Set-Content $f $c -NoNewline
    Write-Host "  Patched: index.ts (removed fs exports)"
}

# --- Patch state_manager.ts ---
$f = Join-Path $CraftEtsDir 'bridge\state_manager.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw
    $c = $c -replace 'Record<string, any>', 'Record<string, string | number | boolean>'
    $c = $c -replace 'Object\.fromEntries\(node\.properties\)', 'Object.fromEntries(node.properties) as Record<string, string | number | boolean>'
    Set-Content $f $c -NoNewline
    Write-Host "  Patched: state_manager.ts (removed any)"
}

# --- Patch ui_bridge.ts ---
$f = Join-Path $CraftEtsDir 'bridge\ui_bridge.ts'
if (Test-Path $f) {
    $c = Get-Content $f -Raw
    $c = $c -replace 'Map<string, any>', 'Map<string, string | number | boolean>'
    $c = $c -replace 'value: any\)', 'value: string | number | boolean)'
    Set-Content $f $c -NoNewline
    Write-Host "  Patched: ui_bridge.ts (removed any)"
}

Write-Host "  All ArkTS patches applied successfully."
