# CRAFT Stage 1 Specification

## Executive Summary

### Scope and Goals

Stage 1 establishes the foundation for CRAFT (Compatible Runtime for Android on Fuchsia/Trusty) by implementing the file parsing infrastructure needed to read and understand Android APK files. This stage focuses exclusively on **parsing** - extracting and understanding the structure of APK contents without executing any code.

### Success Criteria

Stage 1 is complete when:
- A real Android APK can be opened and its contents extracted
- The DEX bytecode file can be fully parsed and its structure understood
- The AndroidManifest.xml binary format can be decoded to extract essential metadata
- A minimal OpenHarmony shell application can load an APK path and report parsing results
- All parsing code runs correctly on both desktop (Node.js) and OpenHarmony runtime

### Components In Scope

| Component | File | Purpose |
|-----------|------|---------|
| Core Utilities | `src/core/utils.ts` | LEB128, MUTF-8 encoding/decoding |
| Error Types | `src/core/errors.ts` | Custom error classes |
| APK Parser | `src/parser/apk_parser.ts` | ZIP extraction (STORE only) |
| DEX Types | `src/parser/dex_types.ts` | DEX data structure definitions |
| DEX Parser | `src/parser/dex_parser.ts` | DEX file parsing |
| Manifest Parser | `src/parser/manifest_parser.ts` | Binary XML parsing |
| DEX Dumper | `tools/dex_dumper.ts` | CLI tool for debugging DEX contents |
| OH Ability Shell | `src/oh/ability_host.ets` | Minimal UIAbility to load APK path |

### Out of Scope

- Bytecode interpretation/execution (Stage 2)
- Android API shims (Stage 3)
- UI rendering (Stage 4)
- Resource parsing (resources.arsc)
- Multi-DEX handling beyond extraction
- APK signature verification
- DEFLATE decompression (test APK uses STORE compression)
- **APK installation/caching** - Stage 1 parses fresh each run (see Runtime Model below)

### Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| OpenHarmony SDK | 4.x (API 10-11) | Target runtime platform |
| TypeScript | 5.x | Implementation language |
| Node.js | 18+ | Desktop testing environment |
| Android SDK | Any recent | Building test APK only |

**No external ZIP or compression libraries** - STORE-only compression eliminates this dependency.

---

## Architecture

### Design Principles

The Stage 1 codebase follows a **portable core + platform adapter** architecture. The core parsing logic is platform-agnostic TypeScript that operates on `Uint8Array` data, with thin platform-specific adapters for file I/O and logging.

```
┌─────────────────────────────────────────────────────────────┐
│                   Core Parsers (Portable)                   │
│                                                             │
│   src/core/utils.ts      - LEB128, MUTF-8 encoding          │
│   src/core/errors.ts     - Error types                      │
│   src/parser/apk_parser.ts   - ZIP/APK extraction           │
│   src/parser/dex_parser.ts   - DEX file parsing             │ 
│   src/parser/dex_types.ts    - Type definitions             │
│   src/parser/manifest_parser.ts - Binary XML parsing        │
│                                                             │
│   Pure Uint8Array manipulation - no OS dependencies         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│    Desktop (Node.js)      │   │    OpenHarmony Device     │
│                           │   │                           │
│  tools/dex_dumper.ts      │   │  src/oh/ability_host.ets  │
│                           │   │                           │
│  File I/O:                │   │  File I/O:                │
│    fs.readFileSync()      │   │    @ohos.file.fs          │
│    fs.promises.readFile() │   │                           │
│                           │   │  Logging:                 │
│  Logging:                 │   │    hilog                  │
│    console.log()          │   │                           │
│                           │   │  Entry:                   │
│  Entry:                   │   │    UIAbility lifecycle    │
│    CLI main()             │   │                           │
└───────────────────────────┘   └───────────────────────────┘
```

### Platform-Specific Adapters

Only three aspects require platform-specific code:

| Aspect | Desktop (Node.js) | OpenHarmony |
|--------|-------------------|-------------|
| **File Reading** | `fs.readFileSync(path)` | `@ohos.file.fs` module |
| **Logging** | `console.log/error/warn` | `hilog` module |
| **Entry Point** | CLI `main()` function | UIAbility `onCreate()` lifecycle |

The core parsers accept `Uint8Array` and return parsed data structures. They have no knowledge of where the bytes came from or where output goes.

### Project Structure

```
craft/
├── src/
│   ├── core/                    # Portable core utilities
│   │   ├── utils.ts             # LEB128, MUTF-8
│   │   └── errors.ts            # Error types
│   │
│   ├── parser/                  # Portable parsers
│   │   ├── apk_parser.ts        # ZIP/APK extraction
│   │   ├── dex_parser.ts        # DEX parsing
│   │   ├── dex_types.ts         # Type definitions
│   │   └── manifest_parser.ts   # Binary XML parsing
│   │
│   └── oh/                      # OpenHarmony-specific
│       └── entry/
│           └── ets/
│               ├── entryability/
│               │   └── EntryAbility.ets
│               ├── pages/
│               │   └── Index.ets
│               └── CraftParser.ets   # OH adapter wrapping core parsers
│
├── tools/                       # Desktop CLI tools
│   └── dex_dumper.ts            # DEX inspection CLI
│
├── test/
│   ├── fixtures/                # Test data
│   │   ├── hello_world.apk
│   │   ├── hello_world.dex
│   │   ├── manifest_binary.xml
│   │   └── expected_output.txt
│   │
│   ├── unit/                    # Unit tests
│   │   ├── leb128.test.ts
│   │   ├── mutf8.test.ts
│   │   ├── zip_parser.test.ts
│   │   └── dex_parser.test.ts
│   │
│   └── integration/             # Integration tests
│       └── apk_parsing.test.ts
│
├── package.json                 # Node.js dependencies (desktop)
├── tsconfig.json                # TypeScript config (desktop)
├── oh-package.json5             # OpenHarmony project config
├── build-profile.json5          # OH build config
└── hvigorfile.ts                # OH build script
```

### Build Workflows

#### Desktop Build (Node.js)

Development and testing on the host machine:

```
# Install dependencies
npm install

# Run unit tests
npm test

# Run DEX dumper CLI
npx ts-node tools/dex_dumper.ts test/fixtures/hello_world.dex --all

# Run integration tests
npm run test:integration
```

#### OpenHarmony Build

Build HAP for device deployment:

```
# Using DevEco Studio
# 1. Open project in DevEco Studio
# 2. Build > Build Hap(s)/APP(s) > Build Hap(s)

# Using command line (hvigor)
hvigorw assembleHap --mode module -p product=default

# Output location
build/default/outputs/default/entry-default-signed.hap
```

### Deployment Workflow

#### Installing the CRAFT HAP on Device

```
# Connect device via USB
hdc list targets

# Install the HAP
hdc install build/default/outputs/default/entry-default-signed.hap

# Verify installation
hdc shell bm dump -n com.craft.parser
```

#### Transferring Test APK Files to Device

Test APK files must be pushed to a location the CRAFT app can access:

**Option 1: App sandbox directory (Recommended)**
```
# Push to app's files directory
hdc file send test/fixtures/hello_world.apk \
    /data/app/el2/100/base/com.craft.parser/haps/entry/files/hello_world.apk
```

**Option 2: Shared temporary directory**
```
# Push to /data/local/tmp (requires app to have appropriate permissions)
hdc file send test/fixtures/hello_world.apk /data/local/tmp/hello_world.apk
```

**Option 3: Bundle test APK in HAP**

Include the test APK as a raw resource in the HAP itself:
- Place APK in `src/oh/entry/resources/rawfile/hello_world.apk`
- Access via `resourceManager.getRawFileContent('hello_world.apk')`
- No file transfer needed, but requires HAP rebuild for each test APK

#### Running CRAFT on Device

**Launch via shell command:**
```
# Start the ability with APK path parameter
hdc shell aa start \
    -a EntryAbility \
    -b com.craft.parser \
    --ps apk_path /data/app/el2/100/base/com.craft.parser/haps/entry/files/hello_world.apk
```

**View output logs:**
```
# Stream logs filtered to CRAFT output
hdc hilog -T CRAFT

# Or capture to file
hdc hilog -T CRAFT > craft_output.log
```

**Expected output:**
```
[CRAFT][AbilityHost][INFO] APK path received: /data/.../hello_world.apk
[CRAFT][APKParser][INFO] APK loaded: 3 files found
[CRAFT][ManifestParser][INFO] Package: com.example.hello, Main Activity: com.example.hello.MainActivity
[CRAFT][DexParser][INFO] DEX parsed: 1 classes, 2 methods
[CRAFT][AbilityHost][INFO] Parsing complete - Main Activity bytecode: 7 code units
```

#### Complete Test Cycle

```
# 1. Build and test on desktop first
npm test
npx ts-node tools/dex_dumper.ts test/fixtures/hello_world.dex --all

# 2. Build OH HAP
hvigorw assembleHap --mode module -p product=default

# 3. Deploy to device
hdc install build/default/outputs/default/entry-default-signed.hap

# 4. Push test APK
hdc file send test/fixtures/hello_world.apk \
    /data/app/el2/100/base/com.craft.parser/haps/entry/files/hello_world.apk

# 5. Run and capture output
hdc shell aa start -a EntryAbility -b com.craft.parser \
    --ps apk_path /data/app/el2/100/base/com.craft.parser/haps/entry/files/hello_world.apk
hdc hilog -T CRAFT
```

### Runtime Model (Stage 1)

Stage 1 uses a **parse-every-time** model with no persistence:

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  APK File   │ ---> │   Parser    │ ---> │   Output    │
│  (on disk)  │      │  (in memory)│      │   (logs)    │
└─────────────┘      └─────────────┘      └─────────────┘
                            │
                     No persistence
                     No caching
                     Fresh parse each run
```

**Why no installation/caching in Stage 1:**

1. **Simplicity** - Fewer moving parts, focus on parsing correctness
2. **Test APK is tiny** - Parsing takes milliseconds, caching overhead not justified
3. **No bytecode execution** - Without execution, there's nothing to optimize for repeated runs

**Stage 2 will introduce installation:**

When bytecode interpretation is added, an "install" step becomes valuable:

```
Stage 2 Model (Future):

┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  APK File   │ ---> │  Installer  │ ---> │ Cached Data │
└─────────────┘      └─────────────┘      └─────────────┘
                                                 │
                     One-time install            │
                     Parses + indexes            │
                     Stores to device            ▼
                                          ┌─────────────┐
                                          │  Runtime    │
                                          │  (loads     │
                                          │   from      │
                                          │   cache)    │
                                          └─────────────┘
```

The install step would:
- Parse APK and DEX files once
- Build optimized class/method lookup indices
- Cache parsed structures to device storage
- Subsequent launches load from cache

This architectural decision is deferred to Stage 2 when execution requirements clarify what should be cached.

### ArkTS Compatibility Notes

The core TypeScript code must be compatible with ArkTS. Key restrictions:

| Feature | TypeScript | ArkTS | Mitigation |
|---------|------------|-------|------------|
| `any` type | Allowed | Restricted | Use explicit types |
| Dynamic properties | Allowed | Not allowed | Use defined interfaces |
| `eval()` | Allowed | Not allowed | Not needed for parsing |
| Structural typing | Full | Limited | Use explicit interfaces |

The parsing code naturally avoids these issues since it works with well-defined binary structures and typed interfaces.

---

## File Format Specifications

### ZIP/PKZIP Format

APK files are ZIP archives. This section provides a complete specification for parsing ZIP files with STORE compression.

#### Overview

A ZIP file consists of:
1. **Local File Headers** - One per file, immediately followed by file data
2. **Central Directory** - Index of all files at end of archive
3. **End of Central Directory (EOCD)** - Locator for Central Directory

Parsing strategy: Read EOCD first (from end of file), then Central Directory, then extract files using Local File Headers.

#### End of Central Directory (EOCD)

Located at the end of the ZIP file. Search backwards from EOF for signature `0x06054b50`.

```
Offset  Size  Field
------  ----  -----
0       4     Signature (0x06054b50)
4       2     Disk number (0 for single-file archives)
6       2     Disk with central directory start (0)
8       2     Central directory entries on this disk
10      2     Total central directory entries
12      4     Central directory size (bytes)
16      4     Central directory offset (from start of file)
20      2     Comment length
22      var   Comment (if any)
```

**Total minimum size: 22 bytes**

#### Central Directory Entry

One entry per file in the archive.

```
Offset  Size  Field
------  ----  -----
0       4     Signature (0x02014b50)
4       2     Version made by
6       2     Version needed to extract
8       2     General purpose bit flag
10      2     Compression method (0=STORE, 8=DEFLATE)
12      2     Last modified time (DOS format)
14      2     Last modified date (DOS format)
16      4     CRC-32 of uncompressed data
20      4     Compressed size
24      4     Uncompressed size
28      2     Filename length
30      2     Extra field length
32      2     File comment length
34      2     Disk number start (0)
36      2     Internal file attributes
38      4     External file attributes
42      4     Relative offset of local header
46      var   Filename (UTF-8 or CP437)
46+n    var   Extra field
        var   File comment
```

**Minimum size: 46 bytes + filename length**

#### Local File Header

Precedes each file's data in the archive.

```
Offset  Size  Field
------  ----  -----
0       4     Signature (0x04034b50)
4       2     Version needed to extract
6       2     General purpose bit flag
8       2     Compression method
10      2     Last modified time
12      2     Last modified date
14      4     CRC-32
18      4     Compressed size
22      4     Uncompressed size
26      2     Filename length
28      2     Extra field length
30      var   Filename
30+n    var   Extra field
```

**Minimum size: 30 bytes + filename length**

File data immediately follows the Local File Header (after extra field).

#### Compression Methods

| Value | Method | Stage 1 Support |
|-------|--------|-----------------|
| 0 | STORE (no compression) | **Yes** |
| 8 | DEFLATE | No |

For Stage 1, we only support STORE compression. The test APK will be built with STORE compression to avoid DEFLATE dependency.

#### APK-Specific Files

Key files within an APK:

| Path | Content |
|------|---------|
| `AndroidManifest.xml` | Binary XML manifest |
| `classes.dex` | Primary DEX bytecode |
| `classes2.dex`, etc. | Additional DEX files (multi-dex) |
| `resources.arsc` | Compiled resources (out of scope) |
| `res/` | Resource files (out of scope) |

---

### DEX File Format

DEX (Dalvik Executable) is the bytecode format for Android applications.

#### File Layout

```
+------------------+
| Header (112 B)   |
+------------------+
| String IDs       |
+------------------+
| Type IDs         |
+------------------+
| Proto IDs        |
+------------------+
| Field IDs        |
+------------------+
| Method IDs       |
+------------------+
| Class Defs       |
+------------------+
| Call Site IDs    | (DEX 038+, optional)
+------------------+
| Method Handles   | (DEX 038+, optional)
+------------------+
| Data Section     |
+------------------+
| Link Data        | (usually empty)
+------------------+
```

#### Header (112 bytes)

```
Offset  Size  Field                Description
------  ----  -----                -----------
0       8     magic                "dex\n035\0" or "dex\n039\0"
8       4     checksum             Adler32 of bytes [12..file_size]
12      20    signature            SHA-1 of bytes [32..file_size]
32      4     file_size            Total file size in bytes
36      4     header_size          Always 0x70 (112)
40      4     endian_tag           0x12345678 = little endian
44      4     link_size            Size of link section (usually 0)
48      4     link_off             Offset to link section
52      4     map_off              Offset to map_list
56      4     string_ids_size      Number of strings
60      4     string_ids_off       Offset to string_id_item array
64      4     type_ids_size        Number of type identifiers
68      4     type_ids_off         Offset to type_id_item array
72      4     proto_ids_size       Number of method prototypes
76      4     proto_ids_off        Offset to proto_id_item array
80      4     field_ids_size       Number of field identifiers
84      4     field_ids_off        Offset to field_id_item array
88      4     method_ids_size      Number of method identifiers
92      4     method_ids_off       Offset to method_id_item array
96      4     class_defs_size      Number of class definitions
100     4     class_defs_off       Offset to class_def_item array
104     4     data_size            Size of data section
108     4     data_off             Offset to data section
```

#### Magic Number

Valid magic values:
- `dex\n035\0` (0x64 0x65 0x78 0x0A 0x30 0x33 0x35 0x00) - Original DEX
- `dex\n037\0` - Default methods support
- `dex\n038\0` - Call site and method handle support
- `dex\n039\0` - Const-method-handle/type support

For Stage 1, accept all versions but only parse structures common to all.

#### String ID Item (4 bytes each)

```
Offset  Size  Field
------  ----  -----
0       4     string_data_off     Offset to string_data_item
```

#### String Data Item (variable size)

Located in data section at offset specified by string_id_item.

```
Offset  Size  Field
------  ----  -----
0       var   utf16_size          ULEB128: string length in UTF-16 code units
var     var   data                MUTF-8 encoded string data
        1     terminator          0x00 null terminator
```

#### Type ID Item (4 bytes each)

```
Offset  Size  Field
------  ----  -----
0       4     descriptor_idx      Index into string_ids for type descriptor
```

Type descriptor format:
| Descriptor | Type |
|------------|------|
| `V` | void |
| `Z` | boolean |
| `B` | byte |
| `S` | short |
| `C` | char |
| `I` | int |
| `J` | long |
| `F` | float |
| `D` | double |
| `Lfully/qualified/Name;` | object type |
| `[type` | array of type |

Examples:
- `Ljava/lang/String;` - java.lang.String
- `[I` - int[]
- `[[Ljava/lang/Object;` - Object[][]

#### Proto ID Item (12 bytes each)

Method prototype (return type and parameter types).

```
Offset  Size  Field
------  ----  -----
0       4     shorty_idx          Index to shorty descriptor string
4       4     return_type_idx     Index into type_ids for return type
8       4     parameters_off      Offset to type_list, or 0 if no params
```

Shorty descriptor: compact form using single chars (V, Z, B, S, C, I, J, F, D, L for objects).

#### Type List (variable size)

```
Offset  Size  Field
------  ----  -----
0       4     size                Number of entries
4       2*n   list                Array of type_idx (2 bytes each)
```

#### Field ID Item (8 bytes each)

```
Offset  Size  Field
------  ----  -----
0       2     class_idx           Index into type_ids for defining class
2       2     type_idx            Index into type_ids for field type
4       4     name_idx            Index into string_ids for field name
```

#### Method ID Item (8 bytes each)

```
Offset  Size  Field
------  ----  -----
0       2     class_idx           Index into type_ids for defining class
2       2     proto_idx           Index into proto_ids for prototype
4       4     name_idx            Index into string_ids for method name
```

#### Class Def Item (32 bytes each)

```
Offset  Size  Field
------  ----  -----
0       4     class_idx           Index into type_ids for this class
4       4     access_flags        ACC_PUBLIC, ACC_FINAL, etc.
8       4     superclass_idx      Index into type_ids, or NO_INDEX
12      4     interfaces_off      Offset to type_list, or 0
16      4     source_file_idx     Index into string_ids, or NO_INDEX
20      4     annotations_off     Offset to annotations, or 0
24      4     class_data_off      Offset to class_data_item, or 0
28      4     static_values_off   Offset to encoded_array, or 0
```

**NO_INDEX = 0xFFFFFFFF**

Access flags (subset):
| Flag | Value | Meaning |
|------|-------|---------|
| ACC_PUBLIC | 0x0001 | public |
| ACC_PRIVATE | 0x0002 | private |
| ACC_PROTECTED | 0x0004 | protected |
| ACC_STATIC | 0x0008 | static |
| ACC_FINAL | 0x0010 | final |
| ACC_SYNCHRONIZED | 0x0020 | synchronized |
| ACC_VOLATILE | 0x0040 | volatile |
| ACC_BRIDGE | 0x0040 | bridge method |
| ACC_TRANSIENT | 0x0080 | transient |
| ACC_VARARGS | 0x0080 | varargs method |
| ACC_NATIVE | 0x0100 | native |
| ACC_INTERFACE | 0x0200 | interface |
| ACC_ABSTRACT | 0x0400 | abstract |
| ACC_STRICT | 0x0800 | strictfp |
| ACC_SYNTHETIC | 0x1000 | synthetic |
| ACC_ANNOTATION | 0x2000 | annotation type |
| ACC_ENUM | 0x4000 | enum |
| ACC_CONSTRUCTOR | 0x10000 | constructor |
| ACC_DECLARED_SYNCHRONIZED | 0x20000 | declared synchronized |

#### Class Data Item (variable size)

Located in data section at class_data_off.

```
Field              Encoding
-----              --------
static_fields_size ULEB128
instance_fields_size ULEB128
direct_methods_size ULEB128
virtual_methods_size ULEB128
static_fields      encoded_field[static_fields_size]
instance_fields    encoded_field[instance_fields_size]
direct_methods     encoded_method[direct_methods_size]
virtual_methods    encoded_method[virtual_methods_size]
```

Direct methods: static, private, and constructors.
Virtual methods: everything else (can be overridden).

#### Encoded Field (variable size)

```
Field         Encoding
-----         --------
field_idx_diff ULEB128   Difference from previous field_idx (or absolute if first)
access_flags   ULEB128   Access flags
```

#### Encoded Method (variable size)

```
Field          Encoding
-----          --------
method_idx_diff ULEB128  Difference from previous method_idx (or absolute if first)
access_flags    ULEB128  Access flags
code_off        ULEB128  Offset to code_item, or 0 if abstract/native
```

#### Code Item

Located at code_off from encoded_method.

```
Offset  Size  Field
------  ----  -----
0       2     registers_size      Number of registers used
2       2     ins_size            Number of words of incoming arguments
4       2     outs_size           Number of words of outgoing arguments
6       2     tries_size          Number of try_item entries
8       4     debug_info_off      Offset to debug_info, or 0
12      4     insns_size          Size of instructions in code units (2 bytes each)
16      var   insns               Actual bytecode (2*insns_size bytes)
        var   padding             2 bytes if tries_size > 0 and insns_size is odd
        var   tries               try_item[tries_size]
        var   handlers            encoded_catch_handler_list
```

#### Try Item (8 bytes each)

```
Offset  Size  Field
------  ----  -----
0       4     start_addr          Start address in code units
4       2     insn_count          Number of code units covered
6       2     handler_off         Offset in encoded_catch_handler_list
```

#### Encoded Catch Handler List

```
Field    Encoding
-----    --------
size     ULEB128          Number of encoded_catch_handler entries
list     encoded_catch_handler[size]
```

#### Encoded Catch Handler

```
Field         Encoding
-----         --------
size          SLEB128    Number of catch types (negative = has catch-all)
handlers      encoded_type_addr_pair[abs(size)]
catch_all_addr ULEB128   Only present if size <= 0
```

#### Encoded Type Addr Pair

```
Field     Encoding
-----     --------
type_idx  ULEB128   Index into type_ids for exception type
addr      ULEB128   Bytecode address of handler
```

---

### Binary XML Format (AndroidManifest.xml)

Android's binary XML is a compiled form of XML optimized for size and parsing speed.

#### File Structure

```
+------------------+
| XML Header       |
+------------------+
| String Pool      |
+------------------+
| Resource Map     | (optional)
+------------------+
| XML Content      |
|  - Namespaces    |
|  - Elements      |
+------------------+
```

#### Chunk Header (8 bytes)

Every chunk starts with this header:

```
Offset  Size  Field
------  ----  -----
0       2     type            Chunk type identifier
2       2     header_size     Size of this header (usually 8)
4       4     size            Total chunk size including header
```

Chunk types:
| Type | Value | Description |
|------|-------|-------------|
| RES_NULL_TYPE | 0x0000 | Null/placeholder |
| RES_STRING_POOL_TYPE | 0x0001 | String pool |
| RES_TABLE_TYPE | 0x0002 | Resource table |
| RES_XML_TYPE | 0x0003 | XML document |
| RES_XML_START_NAMESPACE_TYPE | 0x0100 | Start namespace |
| RES_XML_END_NAMESPACE_TYPE | 0x0101 | End namespace |
| RES_XML_START_ELEMENT_TYPE | 0x0102 | Start element |
| RES_XML_END_ELEMENT_TYPE | 0x0103 | End element |
| RES_XML_CDATA_TYPE | 0x0104 | CDATA section |
| RES_XML_RESOURCE_MAP_TYPE | 0x0180 | Resource ID map |

#### XML Header

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0003 (RES_XML_TYPE)
2       2     header_size     8
4       4     size            Total file size
```

#### String Pool

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0001 (RES_STRING_POOL_TYPE)
2       2     header_size     28
4       4     size            Total chunk size
8       4     string_count    Number of strings
12      4     style_count     Number of styles (usually 0)
16      4     flags           0x100 = UTF-8, 0x000 = UTF-16
20      4     strings_start   Offset to string data (from chunk start)
24      4     styles_start    Offset to style data (from chunk start)
28      var   string_offsets  uint32[string_count] - offsets to each string
        var   style_offsets   uint32[style_count] - offsets to each style
        var   string_data     Actual string data
        var   style_data      Style span data
```

String encoding within pool:

**UTF-8 (flags & 0x100):**
```
Offset  Size  Field
------  ----  -----
0       1-2   char_length     String length in UTF-16 code units (encoded)
var     1-2   byte_length     String length in bytes (encoded)
var     var   data            UTF-8 string data
        1     terminator      0x00
```

Length encoding: if first byte >= 0x80, it's a 2-byte length where high bit indicates continuation.

**UTF-16 (flags & 0x100 == 0):**
```
Offset  Size  Field
------  ----  -----
0       2-4   length          String length (2 bytes, or 4 if high bit set)
var     var   data            UTF-16LE string data
        2     terminator      0x0000
```

#### Resource Map (Optional)

Maps string pool indices to resource IDs for attribute names.

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0180 (RES_XML_RESOURCE_MAP_TYPE)
2       2     header_size     8
4       4     size            Total chunk size
8       var   ids             uint32[] resource IDs
```

Number of entries = (size - 8) / 4

#### Start Namespace

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0100
2       2     header_size     16
4       4     size            24
8       4     line_number     Source line number
12      4     comment         String pool index, or -1
16      4     prefix          String pool index for prefix (e.g., "android")
20      4     uri             String pool index for namespace URI
```

#### End Namespace

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0101
2       2     header_size     16
4       4     size            24
8       4     line_number     Source line number
12      4     comment         String pool index, or -1
16      4     prefix          String pool index for prefix
20      4     uri             String pool index for URI
```

#### Start Element

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0102
2       2     header_size     16
4       4     size            Total chunk size
8       4     line_number     Source line number
12      4     comment         String pool index, or -1
16      4     namespace       String pool index for element namespace, or -1
20      4     name            String pool index for element name
24      4     attribute_start Offset to first attribute (always 0x14 = 20)
28      2     attribute_size  Size of each attribute (always 20)
30      2     attribute_count Number of attributes
32      2     id_index        Index of "id" attribute + 1, or 0
34      2     class_index     Index of "class" attribute + 1, or 0
36      2     style_index     Index of "style" attribute + 1, or 0
38      var   attributes      attribute[attribute_count]
```

#### Attribute (20 bytes each)

```
Offset  Size  Field
------  ----  -----
0       4     namespace       String pool index for namespace, or -1
4       4     name            String pool index for attribute name
8       4     raw_value       String pool index for raw string value, or -1
12      2     size            Always 8
14      1     reserved        Always 0
15      1     type            Value type (see below)
16      4     data            Typed value data
```

Value types:
| Type | Value | Description |
|------|-------|-------------|
| TYPE_NULL | 0x00 | No data |
| TYPE_REFERENCE | 0x01 | Resource reference (@drawable/foo) |
| TYPE_ATTRIBUTE | 0x02 | Attribute reference (?attr/foo) |
| TYPE_STRING | 0x03 | String (use raw_value) |
| TYPE_FLOAT | 0x04 | IEEE 754 float |
| TYPE_DIMENSION | 0x05 | Dimension (px, dp, sp, etc.) |
| TYPE_FRACTION | 0x06 | Fraction |
| TYPE_INT_DEC | 0x10 | Decimal integer |
| TYPE_INT_HEX | 0x11 | Hexadecimal integer |
| TYPE_INT_BOOLEAN | 0x12 | Boolean (0 or -1) |
| TYPE_INT_COLOR_ARGB8 | 0x1C | #AARRGGBB color |
| TYPE_INT_COLOR_RGB8 | 0x1D | #RRGGBB color |
| TYPE_INT_COLOR_ARGB4 | 0x1E | #ARGB color |
| TYPE_INT_COLOR_RGB4 | 0x1F | #RGB color |

#### End Element

```
Offset  Size  Field
------  ----  -----
0       2     type            0x0103
2       2     header_size     16
4       4     size            24
8       4     line_number     Source line number
12      4     comment         String pool index, or -1
16      4     namespace       String pool index for namespace, or -1
20      4     name            String pool index for element name
```

#### Minimal Parsing for Stage 1

For Stage 1, extract only:
1. **Package name**: `<manifest package="...">` attribute
2. **Main Activity class**: `<activity>` with `<intent-filter>` containing:
   - `<action android:name="android.intent.action.MAIN"/>`
   - `<category android:name="android.intent.category.LAUNCHER"/>`

---

## Utility Functions

### LEB128 Encoding

LEB128 (Little Endian Base 128) is a variable-length integer encoding used throughout DEX files.

#### ULEB128 (Unsigned)

Each byte contributes 7 bits of data. High bit indicates continuation (1 = more bytes follow).

```
Value Range          Bytes
-----------          -----
0 - 127              1
128 - 16383          2
16384 - 2097151      3
2097152 - 268435455  4
268435456 - max      5
```

**Decoding Algorithm:**

```
function decodeUleb128(data: Uint8Array, offset: number): [value: number, newOffset: number] {
    let result = 0;
    let shift = 0;
    let byte: number;
    let position = offset;

    do {
        byte = data[position++];
        result |= (byte & 0x7F) << shift;
        shift += 7;
    } while (byte & 0x80);

    return [result, position];
}
```

**Examples:**
| Bytes | Value |
|-------|-------|
| `0x00` | 0 |
| `0x01` | 1 |
| `0x7F` | 127 |
| `0x80 0x01` | 128 |
| `0xFF 0x01` | 255 |
| `0x80 0x80 0x01` | 16384 |

#### SLEB128 (Signed)

Same encoding, but the final byte's second-highest bit determines sign.

**Decoding Algorithm:**

```
function decodeSleb128(data: Uint8Array, offset: number): [value: number, newOffset: number] {
    let result = 0;
    let shift = 0;
    let byte: number;
    let position = offset;

    do {
        byte = data[position++];
        result |= (byte & 0x7F) << shift;
        shift += 7;
    } while (byte & 0x80);

    // Sign extend if negative
    if (shift < 32 && (byte & 0x40)) {
        result |= (~0 << shift);
    }

    return [result, position];
}
```

**Examples:**
| Bytes | Value |
|-------|-------|
| `0x00` | 0 |
| `0x01` | 1 |
| `0x7F` | -1 |
| `0x80 0x01` | 128 |
| `0x80 0x7F` | -128 |

#### ULEB128p1

Used for optional indices. Encodes `value + 1` as ULEB128, so:
- Encoded 0 = actual value -1 (NO_INDEX)
- Encoded 1 = actual value 0
- Encoded N = actual value N-1

---

### MUTF-8 Encoding

DEX uses Modified UTF-8 (MUTF-8), which differs from standard UTF-8:

#### Differences from UTF-8

1. **Null character (`\u0000`)**: Encoded as `0xC0 0x80` (2 bytes), not `0x00`
2. **Supplementary characters (> U+FFFF)**: Encoded as surrogate pairs, each surrogate encoded in 3-byte UTF-8

#### Encoding Table

| Code Point | MUTF-8 Encoding | Standard UTF-8 |
|------------|-----------------|----------------|
| U+0000 | C0 80 | 00 |
| U+0001 - U+007F | 1 byte | 1 byte |
| U+0080 - U+07FF | 2 bytes | 2 bytes |
| U+0800 - U+FFFF | 3 bytes | 3 bytes |
| U+10000 - U+10FFFF | 6 bytes (surrogates) | 4 bytes |

#### Decoding Algorithm

```
function decodeMutf8(data: Uint8Array, offset: number, length: number): string {
    const chars: number[] = [];
    let pos = offset;
    const end = offset + length;

    while (pos < end) {
        const byte1 = data[pos++];

        if (byte1 === 0) {
            // End of string (shouldn't happen before length exhausted)
            break;
        } else if ((byte1 & 0x80) === 0) {
            // 1-byte: 0xxxxxxx
            chars.push(byte1);
        } else if ((byte1 & 0xE0) === 0xC0) {
            // 2-byte: 110xxxxx 10xxxxxx
            const byte2 = data[pos++];
            chars.push(((byte1 & 0x1F) << 6) | (byte2 & 0x3F));
        } else if ((byte1 & 0xF0) === 0xE0) {
            // 3-byte: 1110xxxx 10xxxxxx 10xxxxxx
            const byte2 = data[pos++];
            const byte3 = data[pos++];
            chars.push(((byte1 & 0x0F) << 12) | ((byte2 & 0x3F) << 6) | (byte3 & 0x3F));
        }
    }

    return String.fromCharCode(...chars);
}
```

Note: Supplementary characters (U+10000+) appear as surrogate pairs in the `chars` array. JavaScript's `String.fromCharCode` handles these correctly.

---

## Interface Contracts

### Error Types

```typescript
/**
 * Base error class for all CRAFT errors.
 */
class CraftError extends Error {
    constructor(
        message: string,
        public readonly code: string
    ) {
        super(message);
        this.name = 'CraftError';
    }
}

/**
 * Errors during file format parsing.
 */
class ParseError extends CraftError {
    constructor(
        message: string,
        public readonly offset?: number
    ) {
        super(message, 'PARSE_ERROR');
        this.name = 'ParseError';
    }
}

/**
 * Errors during data validation.
 */
class ValidationError extends CraftError {
    constructor(message: string) {
        super(message, 'VALIDATION_ERROR');
        this.name = 'ValidationError';
    }
}

/**
 * Errors when required data is not found.
 */
class NotFoundError extends CraftError {
    constructor(message: string) {
        super(message, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}
```

### APKParser Interface

```typescript
/**
 * Contents extracted from an APK file.
 */
interface APKContents {
    /** Raw binary AndroidManifest.xml */
    manifest: Uint8Array;

    /** DEX files keyed by path (e.g., "classes.dex", "classes2.dex") */
    dexFiles: Map<string, Uint8Array>;

    /** Raw resources.arsc if present */
    resources: Uint8Array | null;
}

/**
 * Parser for APK (Android Package) files.
 *
 * APK files are ZIP archives containing Android application components.
 * This parser supports STORE compression only (no DEFLATE).
 */
class APKParser {
    /**
     * Parse APK from raw bytes.
     *
     * @param data - Raw APK file contents
     * @returns Extracted APK contents
     * @throws ParseError if ZIP structure is invalid
     * @throws NotFoundError if required files are missing
     */
    static parse(data: Uint8Array): APKContents;

    /**
     * Parse APK from file path.
     *
     * @param path - Path to APK file
     * @returns Promise resolving to extracted APK contents
     * @throws ParseError if ZIP structure is invalid
     * @throws NotFoundError if file doesn't exist or required contents missing
     */
    static parseFile(path: string): Promise<APKContents>;
}
```

### DEX Parser Interface

```typescript
/**
 * Parser for DEX (Dalvik Executable) files.
 *
 * Provides access to all DEX file structures including strings,
 * types, methods, classes, and bytecode.
 */
class DexParser {
    /**
     * Create a DEX parser for the given data.
     *
     * @param data - Raw DEX file contents
     * @throws ParseError if DEX magic number is invalid
     */
    constructor(data: Uint8Array);

    /**
     * Parse and return the DEX header.
     *
     * @returns Parsed DEX header
     */
    parseHeader(): DexHeader;

    /**
     * Get a string by its index in the string table.
     *
     * @param idx - String index (0-based)
     * @returns The decoded string
     * @throws NotFoundError if index is out of range
     */
    getString(idx: number): string;

    /**
     * Get a type name by its index in the type table.
     *
     * @param idx - Type index (0-based)
     * @returns The type descriptor string (e.g., "Ljava/lang/String;")
     * @throws NotFoundError if index is out of range
     */
    getTypeName(idx: number): string;

    /**
     * Find a class definition by its type descriptor.
     *
     * @param className - Type descriptor (e.g., "Lcom/example/MyClass;")
     * @returns Class definition, or null if not found
     */
    getClassDef(className: string): ClassDefItem | null;

    /**
     * Parse the class data for a class definition.
     *
     * @param classDef - Class definition to get data for
     * @returns Parsed class data including fields and methods
     * @throws NotFoundError if class has no class_data
     */
    getClassData(classDef: ClassDefItem): ClassDataItem;

    /**
     * Get the bytecode for a method.
     *
     * @param methodIdx - Method index from encoded_method
     * @returns Code item, or null if method is abstract/native
     */
    getMethodCode(codeOffset: number): CodeItem | null;

    /**
     * Get all class definitions.
     *
     * @returns Array of all class definitions
     */
    getClassDefs(): ClassDefItem[];

    /**
     * Get method information by index.
     *
     * @param idx - Method index (0-based)
     * @returns Method ID information
     */
    getMethodId(idx: number): MethodIdItem;

    /**
     * Get field information by index.
     *
     * @param idx - Field index (0-based)
     * @returns Field ID information
     */
    getFieldId(idx: number): FieldIdItem;

    /**
     * Get prototype information by index.
     *
     * @param idx - Proto index (0-based)
     * @returns Prototype information
     */
    getProtoId(idx: number): ProtoIdItem;
}
```

### Manifest Parser Interface

```typescript
/**
 * Information extracted from AndroidManifest.xml.
 */
interface ManifestInfo {
    /** Application package name (e.g., "com.example.myapp") */
    packageName: string;

    /** Fully qualified main launcher Activity class name */
    mainActivityClass: string;

    /** Minimum Android SDK version required */
    minSdkVersion?: number;

    /** Target Android SDK version */
    targetSdkVersion?: number;
}

/**
 * Parser for binary AndroidManifest.xml files.
 *
 * Extracts essential metadata from the compiled manifest format.
 */
class ManifestParser {
    /**
     * Parse binary manifest and extract essential information.
     *
     * @param data - Raw binary AndroidManifest.xml contents
     * @returns Extracted manifest information
     * @throws ParseError if binary XML structure is invalid
     * @throws NotFoundError if required elements are missing
     */
    static parse(data: Uint8Array): ManifestInfo;
}
```

### Data Structures

```typescript
/**
 * DEX file header (112 bytes).
 */
interface DexHeader {
    magic: Uint8Array;           // 8 bytes
    checksum: number;            // Adler32
    signature: Uint8Array;       // 20 bytes SHA-1
    fileSize: number;
    headerSize: number;          // Always 0x70
    endianTag: number;           // 0x12345678
    linkSize: number;
    linkOff: number;
    mapOff: number;
    stringIdsSize: number;
    stringIdsOff: number;
    typeIdsSize: number;
    typeIdsOff: number;
    protoIdsSize: number;
    protoIdsOff: number;
    fieldIdsSize: number;
    fieldIdsOff: number;
    methodIdsSize: number;
    methodIdsOff: number;
    classDefsSize: number;
    classDefsOff: number;
    dataSize: number;
    dataOff: number;
}

/**
 * String ID item - points to string data in data section.
 */
interface StringIdItem {
    stringDataOff: number;
}

/**
 * Type ID item - references a type descriptor string.
 */
interface TypeIdItem {
    descriptorIdx: number;
}

/**
 * Proto ID item - method prototype (signature).
 */
interface ProtoIdItem {
    shortyIdx: number;           // Shorty descriptor string index
    returnTypeIdx: number;       // Return type index
    parametersOff: number;       // Offset to type_list, or 0
}

/**
 * Field ID item - field identifier.
 */
interface FieldIdItem {
    classIdx: number;            // Defining class type index
    typeIdx: number;             // Field type index
    nameIdx: number;             // Field name string index
}

/**
 * Method ID item - method identifier.
 */
interface MethodIdItem {
    classIdx: number;            // Defining class type index
    protoIdx: number;            // Prototype index
    nameIdx: number;             // Method name string index
}

/**
 * Class definition item.
 */
interface ClassDefItem {
    classIdx: number;            // This class's type index
    accessFlags: number;         // Access flags (ACC_*)
    superclassIdx: number;       // Superclass type index, or NO_INDEX
    interfacesOff: number;       // Offset to type_list, or 0
    sourceFileIdx: number;       // Source file string index, or NO_INDEX
    annotationsOff: number;      // Offset to annotations, or 0
    classDataOff: number;        // Offset to class_data_item, or 0
    staticValuesOff: number;     // Offset to encoded_array, or 0
}

/**
 * Parsed class data.
 */
interface ClassDataItem {
    staticFields: EncodedField[];
    instanceFields: EncodedField[];
    directMethods: EncodedMethod[];
    virtualMethods: EncodedMethod[];
}

/**
 * Encoded field within class data.
 */
interface EncodedField {
    fieldIdx: number;            // Absolute field index
    accessFlags: number;         // Access flags
}

/**
 * Encoded method within class data.
 */
interface EncodedMethod {
    methodIdx: number;           // Absolute method index
    accessFlags: number;         // Access flags
    codeOff: number;             // Offset to code_item, or 0
}

/**
 * Method bytecode and metadata.
 */
interface CodeItem {
    registersSize: number;       // Number of registers
    insSize: number;             // Incoming argument words
    outsSize: number;            // Outgoing argument words
    triesSize: number;           // Number of try blocks
    debugInfoOff: number;        // Debug info offset, or 0
    insnsSize: number;           // Instruction count (16-bit units)
    insns: Uint16Array;          // Bytecode instructions
    tries: TryItem[];            // Exception handlers
    handlers: EncodedCatchHandler[];
}

/**
 * Exception try block.
 */
interface TryItem {
    startAddr: number;           // Start code unit
    insnCount: number;           // Number of code units covered
    handlerOff: number;          // Offset in handler list
}

/**
 * Exception catch handler.
 */
interface EncodedCatchHandler {
    handlers: TypeAddrPair[];    // Typed exception handlers
    catchAllAddr: number | null; // Catch-all handler address, or null
}

/**
 * Exception type and handler address pair.
 */
interface TypeAddrPair {
    typeIdx: number;             // Exception type index
    addr: number;                // Handler code address
}

/** Special value indicating "no index" */
const NO_INDEX = 0xFFFFFFFF;
```

### OH Ability Shell Interface

```typescript
/**
 * OpenHarmony UIAbility shell for loading and parsing APKs.
 *
 * This minimal shell:
 * 1. Receives APK path via Want parameters
 * 2. Reads and parses the APK file
 * 3. Extracts and parses DEX contents
 * 4. Logs results (no UI in Stage 1)
 */

// Entry in module.json5:
// {
//   "abilities": [{
//     "name": "CraftAbility",
//     "srcEntry": "./ets/ability_host.ets",
//     "launchType": "singleton"
//   }]
// }

// Want parameter for APK path:
// want.parameters = { "apk_path": "/path/to/app.apk" }

// Expected log output on success:
// [CRAFT][AbilityHost][INFO] APK path received: /path/to/app.apk
// [CRAFT][APKParser][INFO] APK loaded: 5 files found
// [CRAFT][ManifestParser][INFO] Package: com.example.hello, Main Activity: com.example.hello.MainActivity
// [CRAFT][DexParser][INFO] DEX parsed: 3 classes, 8 methods
// [CRAFT][AbilityHost][INFO] Parsing complete
```

---

## Error Handling Strategy

### Critical Errors (Throw Immediately)

These errors indicate the file cannot be parsed and should halt processing:

| Error Condition | Error Type | Message Example |
|-----------------|------------|-----------------|
| Invalid ZIP signature | ParseError | "Invalid ZIP signature at offset 0" |
| Invalid DEX magic | ParseError | "Invalid DEX magic number" |
| Truncated file | ParseError | "Unexpected end of file at offset 1234" |
| Invalid header size | ParseError | "Invalid header size: expected 112, got 96" |
| Missing classes.dex | NotFoundError | "Required file not found: classes.dex" |
| Missing manifest | NotFoundError | "Required file not found: AndroidManifest.xml" |

### Recoverable Errors (Log and Continue)

These errors are logged but parsing continues where possible:

| Error Condition | Action | Log Message |
|-----------------|--------|-------------|
| Unknown DEX version | Continue parsing | "Unknown DEX version 040, attempting parse" |
| Invalid string index | Return placeholder | "Invalid string index 9999, using '<invalid>'" |
| Malformed class data | Skip class | "Skipping malformed class at index 5" |
| Unknown XML chunk type | Skip chunk | "Skipping unknown chunk type 0x0105" |
| Checksum mismatch | Continue (warn) | "Checksum mismatch: expected 0x1234, got 0x5678" |

### Error Context

All errors should include sufficient context for debugging:

```typescript
// Good: includes offset and expected values
throw new ParseError(
    `Invalid Central Directory signature: expected 0x02014b50, got 0x${sig.toString(16)} at offset ${offset}`,
    offset
);

// Bad: no context
throw new ParseError("Invalid signature");
```

---

## Logging and Debugging

### Log Format

```
[CRAFT][Component][Level] Message
```

Examples:
```
[CRAFT][DexParser][INFO] DEX parsed: 5 classes, 12 methods
[CRAFT][APKParser][ERROR] Invalid ZIP signature at offset 0
[CRAFT][ManifestParser][DEBUG] Parsing element: manifest
```

### Log Levels

| Level | Usage |
|-------|-------|
| ERROR | Critical failures that halt operation |
| WARN | Recoverable issues that may indicate problems |
| INFO | Major lifecycle events |
| DEBUG | Detailed parsing progress (development only) |

### Component Logging Guidelines

| Component | INFO Events | DEBUG Events |
|-----------|-------------|--------------|
| APKParser | "APK loaded: N files found" | Each file extracted |
| DexParser | "DEX parsed: N classes, M methods" | Each section parsed, string lookups |
| ManifestParser | "Package: X, Main Activity: Y" | Each XML element parsed |
| AbilityHost | "APK path received", "Parsing complete" | Runtime object creation |

### Logger Interface

```typescript
interface Logger {
    error(component: string, message: string): void;
    warn(component: string, message: string): void;
    info(component: string, message: string): void;
    debug(component: string, message: string): void;
}

// Default implementation uses console
const defaultLogger: Logger = {
    error: (c, m) => console.error(`[CRAFT][${c}][ERROR] ${m}`),
    warn: (c, m) => console.warn(`[CRAFT][${c}][WARN] ${m}`),
    info: (c, m) => console.info(`[CRAFT][${c}][INFO] ${m}`),
    debug: (c, m) => console.debug(`[CRAFT][${c}][DEBUG] ${m}`)
};
```

---

## Testing Strategy

### Test APK Build Instructions

Build a minimal Hello World APK with STORE compression for testing.

#### Prerequisites

- Android SDK Command-line Tools
- Java Development Kit (JDK) 11+

#### Build Steps

1. **Create minimal Android project structure:**

```
hello_world/
├── AndroidManifest.xml
└── src/
    └── com/
        └── example/
            └── hello/
                └── MainActivity.java
```

2. **AndroidManifest.xml:**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.hello">

    <application android:label="Hello">
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

3. **MainActivity.java:**

```java
package com.example.hello;

import android.app.Activity;
import android.os.Bundle;

public class MainActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }
}
```

4. **Compile to DEX:**

```bash
# Compile Java to class files
javac -source 1.8 -target 1.8 \
    -classpath $ANDROID_SDK/platforms/android-30/android.jar \
    -d build/classes \
    src/com/example/hello/MainActivity.java

# Convert to DEX
$ANDROID_SDK/build-tools/30.0.3/d8 \
    --output build/dex \
    build/classes/com/example/hello/MainActivity.class
```

5. **Create APK with STORE compression:**

```bash
# Create APK using aapt2 with no compression
$ANDROID_SDK/build-tools/30.0.3/aapt2 link \
    -o hello_world_unaligned.apk \
    --manifest AndroidManifest.xml \
    -I $ANDROID_SDK/platforms/android-30/android.jar \
    --no-compress

# Add DEX file (STORE compression)
cd build/dex
zip -0 ../../hello_world_unaligned.apk classes.dex
cd ../..

# Sign APK (debug key)
$ANDROID_SDK/build-tools/30.0.3/apksigner sign \
    --ks ~/.android/debug.keystore \
    --ks-pass pass:android \
    --out hello_world.apk \
    hello_world_unaligned.apk
```

6. **Verify STORE compression:**

```bash
unzip -v hello_world.apk | grep -E "classes.dex|AndroidManifest"
# Should show "Stored" not "Defl:N"
```

#### Alternative: Using Gradle

```groovy
// build.gradle
android {
    aaptOptions {
        noCompress "dex", "xml"  // Force STORE compression
    }
}
```

### Test Fixtures

| File | Description |
|------|-------------|
| `test/fixtures/hello_world.apk` | Complete minimal APK (STORE compression) |
| `test/fixtures/hello_world.dex` | Extracted classes.dex for direct testing |
| `test/fixtures/manifest_binary.xml` | Extracted AndroidManifest.xml (binary) |
| `test/fixtures/expected_output.txt` | Expected dex_dumper output |

### DEX Dumper Tool

CLI tool for debugging and validation:

```bash
npx ts-node tools/dex_dumper.ts <dex-file> [options]

Options:
  --header      Print header info only
  --strings     Print string table
  --types       Print type table
  --classes     Print class definitions
  --methods     Print method definitions with bytecode
  --all         Print everything (default)
```

**Example output:**

```
DEX Header:
  Magic: dex\n035
  Checksum: 0x12345678
  File Size: 1234 bytes
  String IDs: 15
  Type IDs: 8
  Proto IDs: 5
  Field IDs: 2
  Method IDs: 6
  Class Defs: 2

String Table:
  [0] <init>
  [1] Lcom/example/hello/MainActivity;
  [2] Landroid/app/Activity;
  ...

Class: Lcom/example/hello/MainActivity;
  Access: PUBLIC
  Superclass: Landroid/app/Activity;

  Direct Methods:
    [0] <init>()V (constructor)
        Registers: 1, Ins: 1, Outs: 1
        Code: 3 units
        0000: invoke-direct {v0}, Landroid/app/Activity;-><init>()V
        0003: return-void

  Virtual Methods:
    [0] onCreate(Landroid/os/Bundle;)V
        Registers: 2, Ins: 2, Outs: 2
        Code: 4 units
        0000: invoke-super {v0, v1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
        0003: return-void
```

### Unit Tests

#### LEB128 Tests

```typescript
describe('ULEB128', () => {
    test('decodes 0', () => {
        expect(decodeUleb128([0x00], 0)).toEqual([0, 1]);
    });

    test('decodes 127 (max single byte)', () => {
        expect(decodeUleb128([0x7F], 0)).toEqual([127, 1]);
    });

    test('decodes 128 (min two byte)', () => {
        expect(decodeUleb128([0x80, 0x01], 0)).toEqual([128, 2]);
    });

    test('decodes 255', () => {
        expect(decodeUleb128([0xFF, 0x01], 0)).toEqual([255, 2]);
    });

    test('decodes 16384 (three bytes)', () => {
        expect(decodeUleb128([0x80, 0x80, 0x01], 0)).toEqual([16384, 3]);
    });
});

describe('SLEB128', () => {
    test('decodes -1', () => {
        expect(decodeSleb128([0x7F], 0)).toEqual([-1, 1]);
    });

    test('decodes -128', () => {
        expect(decodeSleb128([0x80, 0x7F], 0)).toEqual([-128, 2]);
    });
});
```

#### MUTF-8 Tests

```typescript
describe('MUTF-8', () => {
    test('decodes ASCII', () => {
        expect(decodeMutf8([0x48, 0x69], 0, 2)).toBe('Hi');
    });

    test('decodes null character', () => {
        expect(decodeMutf8([0xC0, 0x80], 0, 2)).toBe('\u0000');
    });

    test('decodes 2-byte character', () => {
        // U+00A9 (©) = 0xC2 0xA9
        expect(decodeMutf8([0xC2, 0xA9], 0, 2)).toBe('©');
    });

    test('decodes 3-byte character', () => {
        // U+4E2D (中) = 0xE4 0xB8 0xAD
        expect(decodeMutf8([0xE4, 0xB8, 0xAD], 0, 3)).toBe('中');
    });
});
```

#### ZIP Parser Tests

```typescript
describe('ZIP Parser', () => {
    test('finds EOCD signature', () => {
        // Test finding signature at end of file
    });

    test('parses Central Directory entry', () => {
        // Test parsing CD entry structure
    });

    test('extracts STORE compressed file', () => {
        // Test extracting uncompressed file data
    });

    test('rejects DEFLATE compression', () => {
        // Test that DEFLATE throws appropriate error
    });
});
```

#### DEX Parser Tests

```typescript
describe('DEX Parser', () => {
    test('validates magic number', () => {
        const validDex = new Uint8Array([0x64, 0x65, 0x78, 0x0A, 0x30, 0x33, 0x35, 0x00, ...]);
        expect(() => new DexParser(validDex)).not.toThrow();

        const invalidDex = new Uint8Array([0x00, 0x00, 0x00, 0x00, ...]);
        expect(() => new DexParser(invalidDex)).toThrow(ParseError);
    });

    test('parses header correctly', () => {
        const parser = new DexParser(testDexData);
        const header = parser.parseHeader();

        expect(header.headerSize).toBe(0x70);
        expect(header.endianTag).toBe(0x12345678);
    });

    test('retrieves strings by index', () => {
        const parser = new DexParser(testDexData);
        expect(parser.getString(0)).toBe('<init>');
    });

    test('finds class by name', () => {
        const parser = new DexParser(testDexData);
        const classDef = parser.getClassDef('Lcom/example/hello/MainActivity;');
        expect(classDef).not.toBeNull();
    });
});
```

### Integration Tests

```typescript
describe('End-to-end APK parsing', () => {
    test('parses Hello World APK', async () => {
        const contents = await APKParser.parseFile('test/fixtures/hello_world.apk');

        expect(contents.manifest).toBeDefined();
        expect(contents.dexFiles.has('classes.dex')).toBe(true);
    });

    test('extracts correct manifest info', async () => {
        const contents = await APKParser.parseFile('test/fixtures/hello_world.apk');
        const manifest = ManifestParser.parse(contents.manifest);

        expect(manifest.packageName).toBe('com.example.hello');
        expect(manifest.mainActivityClass).toBe('com.example.hello.MainActivity');
    });

    test('parses DEX with correct class count', async () => {
        const contents = await APKParser.parseFile('test/fixtures/hello_world.apk');
        const dexData = contents.dexFiles.get('classes.dex')!;
        const parser = new DexParser(dexData);

        const classDefs = parser.getClassDefs();
        expect(classDefs.length).toBeGreaterThan(0);
    });

    test('dex_dumper output matches expected', async () => {
        // Run dex_dumper and compare output to expected_output.txt
    });
});
```

---

## Acceptance Criteria

Stage 1 is complete when all of the following are verified:

### APK Parser

- [ ] Can extract AndroidManifest.xml from a real APK
- [ ] Can extract classes.dex from a real APK
- [ ] Handles STORE compression correctly
- [ ] Throws appropriate error for DEFLATE compression
- [ ] Throws appropriate error for missing required files

### DEX Parser

- [ ] Parses header and validates magic number
- [ ] Validates header size (112 bytes)
- [ ] Can retrieve any string by index
- [ ] Can retrieve any type name by index
- [ ] Can find a class definition by name
- [ ] Can retrieve class data (fields, methods)
- [ ] Can retrieve method bytecode (CodeItem)
- [ ] Handles NO_INDEX values correctly

### Manifest Parser

- [ ] Extracts package name from manifest
- [ ] Identifies main launcher Activity class name
- [ ] Handles both UTF-8 and UTF-16 string pools
- [ ] Skips unknown chunk types gracefully

### OH Ability Shell

- [ ] Compiles without errors for OpenHarmony
- [ ] Runs on OpenHarmony emulator/device
- [ ] Accepts APK path via Want parameters
- [ ] Logs parsed manifest info (package name, main activity)
- [ ] Logs class count from DEX
- [ ] Logs main Activity method count/bytecode size

### DEX Dumper Tool

- [ ] Runs from command line with DEX file argument
- [ ] Outputs header information accurately
- [ ] Outputs complete string table
- [ ] Outputs all class definitions with method lists
- [ ] Supports --header, --strings, --types, --classes, --methods flags
- [ ] Output matches expected_output.txt for test fixture

### Code Quality

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No TypeScript compilation errors
- [ ] Error messages include sufficient context for debugging
- [ ] Logging follows defined format and guidelines

---

## Glossary

| Term | Definition |
|------|------------|
| **APK** | Android Package: ZIP archive containing compiled Android application |
| **DEX** | Dalvik Executable: Bytecode format for Android runtime |
| **Dalvik** | Original Android virtual machine (replaced by ART, bytecode format retained) |
| **ART** | Android Runtime: Current Android runtime, still executes DEX bytecode |
| **MUTF-8** | Modified UTF-8: DEX string encoding with different null/supplementary handling |
| **LEB128** | Little Endian Base 128: Variable-length integer encoding used in DEX |
| **ULEB128** | Unsigned LEB128 |
| **SLEB128** | Signed LEB128 |
| **Opcode** | Operation code: Single bytecode instruction identifier |
| **Code Unit** | 16-bit unit used to measure DEX bytecode size |
| **Type Descriptor** | String format for types (e.g., `Ljava/lang/String;`, `I`, `[B`) |
| **Method Descriptor** | String format for method signatures (e.g., `(II)V`) |
| **ArkUI** | OpenHarmony's declarative UI framework |
| **UIAbility** | OpenHarmony's equivalent to Android Activity |
| **ArkTS** | TypeScript variant for OpenHarmony development |
| **STORE** | ZIP compression method 0: no compression, data stored as-is |
| **DEFLATE** | ZIP compression method 8: LZ77 + Huffman compression |
| **Central Directory** | ZIP index at end of file listing all archive contents |
| **EOCD** | End of Central Directory: ZIP structure locating the Central Directory |
| **NO_INDEX** | Special value 0xFFFFFFFF indicating absence of an index reference |
