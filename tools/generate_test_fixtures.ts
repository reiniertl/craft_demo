#!/usr/bin/env ts-node
/**
 * Generate test fixtures for CRAFT Stage 1 testing.
 * Creates a minimal valid APK with STORE compression.
 */

import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '..', 'test', 'fixtures');

/**
 * Create a minimal valid DEX file.
 * Contains a single class: Lcom/example/hello/MainActivity;
 * with a single method: onCreate(Landroid/os/Bundle;)V
 */
function createMinimalDex(): Uint8Array {
    // Pre-computed minimal DEX file for com.example.hello.MainActivity
    // This is a hand-crafted DEX that contains:
    // - 1 class: Lcom/example/hello/MainActivity;
    // - Superclass: Landroid/app/Activity;
    // - 2 methods: <init>()V and onCreate(Landroid/os/Bundle;)V
    
    const strings = [
        '<init>',                                    // 0
        'Landroid/app/Activity;',                    // 1
        'Landroid/os/Bundle;',                       // 2
        'Lcom/example/hello/MainActivity;',          // 3
        'MainActivity.java',                         // 4
        'V',                                         // 5
        'VL',                                        // 6
        'onCreate',                                  // 7
    ];
    
    // Calculate sizes and offsets
    const headerSize = 0x70; // 112 bytes
    
    // String data section (MUTF-8 encoded strings)
    const stringDataItems: Uint8Array[] = strings.map(s => {
        const encoded = new TextEncoder().encode(s);
        // ULEB128 length + data + null terminator
        const result = new Uint8Array(1 + encoded.length + 1);
        result[0] = encoded.length; // Simple ULEB128 for small values
        result.set(encoded, 1);
        result[result.length - 1] = 0;
        return result;
    });
    
    // Calculate string data total size
    let stringDataSize = 0;
    for (const item of stringDataItems) {
        stringDataSize += item.length;
    }
    
    // Layout:
    // Header: 0x00 - 0x70
    // String IDs: 0x70 - 0x70 + 8*4 = 0x90
    // Type IDs: 0x90 - 0x90 + 4*4 = 0xA0
    // Proto IDs: 0xA0 - 0xA0 + 2*12 = 0xB8
    // Field IDs: 0xB8 (none)
    // Method IDs: 0xB8 - 0xB8 + 4*8 = 0xD8
    // Class Defs: 0xD8 - 0xD8 + 1*32 = 0xF8
    // Data section: 0xF8 onwards
    
    const stringIdsOff = headerSize;
    const stringIdsSize = strings.length;
    const typeIdsOff = stringIdsOff + stringIdsSize * 4;
    const typeIdsSize = 4; // Activity, Bundle, MainActivity, void
    const protoIdsOff = typeIdsOff + typeIdsSize * 4;
    const protoIdsSize = 2; // ()V and (Landroid/os/Bundle;)V
    const fieldIdsOff = protoIdsOff + protoIdsSize * 12;
    const fieldIdsSize = 0;
    const methodIdsOff = fieldIdsOff + fieldIdsSize * 8;
    const methodIdsSize = 4; // Activity.<init>, Activity.onCreate, MainActivity.<init>, MainActivity.onCreate
    const classDefsOff = methodIdsOff + methodIdsSize * 8;
    const classDefsSize = 1;
    const dataOff = classDefsOff + classDefsSize * 32;
    
    // String data starts in data section
    const stringDataOff = dataOff;
    
    // Class data follows string data
    const classDataOff = stringDataOff + stringDataSize;
    
    // Code items follow class data
    // Class data: 4 ULEB128 values (0, 0, 2, 0) + 2 encoded methods
    const classDataSize = 4 + 6 + 6; // approximate
    const codeItemsOff = classDataOff + classDataSize;
    
    // Code for <init>: invoke-direct + return-void
    const initCodeSize = 16 + 6; // code_item header + 3 code units
    // Code for onCreate: invoke-super + return-void  
    const onCreateCodeSize = 16 + 8; // code_item header + 4 code units
    
    const totalSize = codeItemsOff + initCodeSize + onCreateCodeSize;
    const dataSize = totalSize - dataOff;
    
    // Create the DEX buffer
    const dex = new Uint8Array(totalSize);
    const view = new DataView(dex.buffer);
    
    // === HEADER ===
    // Magic: dex\n035\0
    dex[0] = 0x64; dex[1] = 0x65; dex[2] = 0x78; dex[3] = 0x0A;
    dex[4] = 0x30; dex[5] = 0x33; dex[6] = 0x35; dex[7] = 0x00;
    
    // Checksum (offset 8) - will calculate later
    // Signature (offset 12) - zeros for now
    
    // File size (offset 32)
    view.setUint32(32, totalSize, true);
    
    // Header size (offset 36)
    view.setUint32(36, headerSize, true);
    
    // Endian tag (offset 40)
    view.setUint32(40, 0x12345678, true);
    
    // Link size/off (offset 44, 48) - 0
    
    // Map off (offset 52) - 0 for now
    
    // String IDs (offset 56, 60)
    view.setUint32(56, stringIdsSize, true);
    view.setUint32(60, stringIdsOff, true);
    
    // Type IDs (offset 64, 68)
    view.setUint32(64, typeIdsSize, true);
    view.setUint32(68, typeIdsOff, true);
    
    // Proto IDs (offset 72, 76)
    view.setUint32(72, protoIdsSize, true);
    view.setUint32(76, protoIdsOff, true);
    
    // Field IDs (offset 80, 84)
    view.setUint32(80, fieldIdsSize, true);
    view.setUint32(84, fieldIdsOff, true);
    
    // Method IDs (offset 88, 92)
    view.setUint32(88, methodIdsSize, true);
    view.setUint32(92, methodIdsOff, true);
    
    // Class Defs (offset 96, 100)
    view.setUint32(96, classDefsSize, true);
    view.setUint32(100, classDefsOff, true);
    
    // Data (offset 104, 108)
    view.setUint32(104, dataSize, true);
    view.setUint32(108, dataOff, true);
    
    // === STRING IDS ===
    let stringDataPos = stringDataOff;
    for (let i = 0; i < stringIdsSize; i++) {
        view.setUint32(stringIdsOff + i * 4, stringDataPos, true);
        stringDataPos += stringDataItems[i].length;
    }
    
    // === TYPE IDS ===
    // Type 0: Landroid/app/Activity; (string 1)
    // Type 1: Landroid/os/Bundle; (string 2)
    // Type 2: Lcom/example/hello/MainActivity; (string 3)
    // Type 3: V (string 5)
    view.setUint32(typeIdsOff + 0, 1, true);  // Activity
    view.setUint32(typeIdsOff + 4, 2, true);  // Bundle
    view.setUint32(typeIdsOff + 8, 3, true);  // MainActivity
    view.setUint32(typeIdsOff + 12, 5, true); // void
    
    // === PROTO IDS ===
    // Proto 0: ()V - shorty="V", return=void, params=0
    view.setUint32(protoIdsOff + 0, 5, true);  // shorty_idx -> "V"
    view.setUint32(protoIdsOff + 4, 3, true);  // return_type_idx -> void (type 3)
    view.setUint32(protoIdsOff + 8, 0, true);  // parameters_off -> 0 (no params)
    
    // Proto 1: (Landroid/os/Bundle;)V - shorty="VL", return=void, params=Bundle
    view.setUint32(protoIdsOff + 12, 6, true); // shorty_idx -> "VL"
    view.setUint32(protoIdsOff + 16, 3, true); // return_type_idx -> void (type 3)
    view.setUint32(protoIdsOff + 20, 0, true); // parameters_off -> 0 (simplified)
    
    // === METHOD IDS ===
    // Method 0: Activity.<init>()V
    view.setUint16(methodIdsOff + 0, 0, true);  // class_idx -> Activity
    view.setUint16(methodIdsOff + 2, 0, true);  // proto_idx -> ()V
    view.setUint32(methodIdsOff + 4, 0, true);  // name_idx -> "<init>"
    
    // Method 1: Activity.onCreate(Bundle)V
    view.setUint16(methodIdsOff + 8, 0, true);  // class_idx -> Activity
    view.setUint16(methodIdsOff + 10, 1, true); // proto_idx -> (Bundle)V
    view.setUint32(methodIdsOff + 12, 7, true); // name_idx -> "onCreate"
    
    // Method 2: MainActivity.<init>()V
    view.setUint16(methodIdsOff + 16, 2, true); // class_idx -> MainActivity
    view.setUint16(methodIdsOff + 18, 0, true); // proto_idx -> ()V
    view.setUint32(methodIdsOff + 20, 0, true); // name_idx -> "<init>"
    
    // Method 3: MainActivity.onCreate(Bundle)V
    view.setUint16(methodIdsOff + 24, 2, true); // class_idx -> MainActivity
    view.setUint16(methodIdsOff + 26, 1, true); // proto_idx -> (Bundle)V
    view.setUint32(methodIdsOff + 28, 7, true); // name_idx -> "onCreate"
    
    // === CLASS DEFS ===
    // MainActivity
    view.setUint32(classDefsOff + 0, 2, true);   // class_idx -> MainActivity
    view.setUint32(classDefsOff + 4, 1, true);   // access_flags -> PUBLIC
    view.setUint32(classDefsOff + 8, 0, true);   // superclass_idx -> Activity
    view.setUint32(classDefsOff + 12, 0, true);  // interfaces_off
    view.setUint32(classDefsOff + 16, 4, true);  // source_file_idx -> "MainActivity.java"
    view.setUint32(classDefsOff + 20, 0, true);  // annotations_off
    view.setUint32(classDefsOff + 24, classDataOff, true); // class_data_off
    view.setUint32(classDefsOff + 28, 0, true);  // static_values_off
    
    // === STRING DATA ===
    let pos = stringDataOff;
    for (const item of stringDataItems) {
        dex.set(item, pos);
        pos += item.length;
    }
    
    // === CLASS DATA ===
    // static_fields_size: 0
    // instance_fields_size: 0
    // direct_methods_size: 1 (<init>)
    // virtual_methods_size: 1 (onCreate)
    pos = classDataOff;
    dex[pos++] = 0; // static_fields_size
    dex[pos++] = 0; // instance_fields_size
    dex[pos++] = 1; // direct_methods_size
    dex[pos++] = 1; // virtual_methods_size
    
    // Direct method 0: MainActivity.<init>
    dex[pos++] = 2; // method_idx_diff (method 2)
    dex[pos++] = 0x01 | 0x10000 & 0xFF; // access_flags: PUBLIC | CONSTRUCTOR (simplified to just 1)
    const initCodeOff = codeItemsOff;
    // ULEB128 encode initCodeOff
    let val = initCodeOff;
    while (val >= 0x80) {
        dex[pos++] = (val & 0x7F) | 0x80;
        val >>= 7;
    }
    dex[pos++] = val;
    
    // Virtual method 0: MainActivity.onCreate
    dex[pos++] = 1; // method_idx_diff (method 3 - method 2 = 1)
    dex[pos++] = 1; // access_flags: PUBLIC
    const onCreateCodeOff = initCodeOff + initCodeSize;
    val = onCreateCodeOff;
    while (val >= 0x80) {
        dex[pos++] = (val & 0x7F) | 0x80;
        val >>= 7;
    }
    dex[pos++] = val;
    
    // === CODE ITEMS ===
    
    // <init> code: invoke-direct {p0}, Activity.<init>()V; return-void
    pos = initCodeOff;
    view.setUint16(pos, 1, true); pos += 2;      // registers_size
    view.setUint16(pos, 1, true); pos += 2;      // ins_size
    view.setUint16(pos, 1, true); pos += 2;      // outs_size
    view.setUint16(pos, 0, true); pos += 2;      // tries_size
    view.setUint32(pos, 0, true); pos += 4;      // debug_info_off
    view.setUint32(pos, 3, true); pos += 4;      // insns_size (3 code units)
    // invoke-direct {v0}, Landroid/app/Activity;-><init>()V
    // 7010 0000 0000 -> invoke-direct, method@0000, v0
    view.setUint16(pos, 0x7010, true); pos += 2;
    view.setUint16(pos, 0x0000, true); pos += 2;
    // return-void
    view.setUint16(pos, 0x000e, true); pos += 2;
    
    // onCreate code: invoke-super {p0, p1}, Activity.onCreate(Bundle)V; return-void
    pos = onCreateCodeOff;
    view.setUint16(pos, 2, true); pos += 2;      // registers_size
    view.setUint16(pos, 2, true); pos += 2;      // ins_size
    view.setUint16(pos, 2, true); pos += 2;      // outs_size
    view.setUint16(pos, 0, true); pos += 2;      // tries_size
    view.setUint32(pos, 0, true); pos += 4;      // debug_info_off
    view.setUint32(pos, 4, true); pos += 4;      // insns_size (4 code units)
    // invoke-super {v0, v1}, Landroid/app/Activity;->onCreate(Landroid/os/Bundle;)V
    // 6f20 0100 1000 -> invoke-super, method@0001, v0 v1
    view.setUint16(pos, 0x6f20, true); pos += 2;
    view.setUint16(pos, 0x0001, true); pos += 2;
    view.setUint16(pos, 0x0010, true); pos += 2;
    // return-void
    view.setUint16(pos, 0x000e, true); pos += 2;
    
    // Calculate Adler32 checksum
    const checksum = adler32(dex, 12, dex.length - 12);
    view.setUint32(8, checksum, true);
    
    return dex;
}

/**
 * Calculate Adler32 checksum.
 */
function adler32(data: Uint8Array, start: number, length: number): number {
    let a = 1;
    let b = 0;
    const MOD = 65521;
    
    for (let i = start; i < start + length; i++) {
        a = (a + data[i]) % MOD;
        b = (b + a) % MOD;
    }
    
    return (b << 16) | a;
}

/**
 * Create a minimal valid binary AndroidManifest.xml
 */
function createMinimalManifest(): Uint8Array {
    // String pool
    const strings = [
        '',                                      // 0 - empty
        'android',                               // 1 - namespace prefix
        'http://schemas.android.com/apk/res/android', // 2 - namespace URI
        'manifest',                              // 3 - element
        'package',                               // 4 - attribute
        'com.example.hello',                     // 5 - package value
        'application',                           // 6 - element
        'label',                                 // 7 - attribute
        'Hello',                                 // 8 - label value
        'activity',                              // 9 - element
        'name',                                  // 10 - attribute
        '.MainActivity',                         // 11 - activity name
        'exported',                              // 12 - attribute
        'intent-filter',                         // 13 - element
        'action',                                // 14 - element
        'android.intent.action.MAIN',            // 15 - action name
        'category',                              // 16 - element
        'android.intent.category.LAUNCHER',      // 17 - category name
    ];
    
    // Encode strings as UTF-8 for string pool
    const encodedStrings: Uint8Array[] = strings.map(s => new TextEncoder().encode(s));
    
    // Calculate string pool size
    // UTF-8 format: 1 byte char length, 1 byte byte length (if < 128), data, null
    let stringDataSize = 0;
    for (const s of encodedStrings) {
        const charLen = s.length;
        const byteLen = s.length;
        stringDataSize += (charLen >= 128 ? 2 : 1) + (byteLen >= 128 ? 2 : 1) + s.length + 1;
    }
    // Align to 4 bytes
    stringDataSize = (stringDataSize + 3) & ~3;
    
    const stringPoolHeaderSize = 28;
    const stringOffsetsSize = strings.length * 4;
    const stringPoolSize = stringPoolHeaderSize + stringOffsetsSize + stringDataSize;
    
    // Build XML structure
    // We'll create a simplified binary XML with:
    // - XML header
    // - String pool
    // - Start namespace
    // - Start manifest + package attr
    // - Start application
    // - Start activity + name attr
    // - Start intent-filter
    // - Start action + name attr
    // - End action
    // - Start category + name attr
    // - End category
    // - End intent-filter
    // - End activity
    // - End application
    // - End manifest
    // - End namespace
    
    const xmlHeaderSize = 8;
    const namespaceChunkSize = 24;
    const startElementBaseSize = 36;
    const attrSize = 20;
    const endElementSize = 24;
    
    // Calculate total size
    let totalSize = xmlHeaderSize + stringPoolSize;
    totalSize += namespaceChunkSize; // start namespace
    totalSize += startElementBaseSize + attrSize; // manifest + package
    totalSize += startElementBaseSize + attrSize; // application + label
    totalSize += startElementBaseSize + 2 * attrSize; // activity + name + exported
    totalSize += startElementBaseSize; // intent-filter
    totalSize += startElementBaseSize + attrSize; // action + name
    totalSize += endElementSize; // end action
    totalSize += startElementBaseSize + attrSize; // category + name
    totalSize += endElementSize; // end category
    totalSize += endElementSize; // end intent-filter
    totalSize += endElementSize; // end activity
    totalSize += endElementSize; // end application
    totalSize += endElementSize; // end manifest
    totalSize += namespaceChunkSize; // end namespace
    
    const xml = new Uint8Array(totalSize);
    const view = new DataView(xml.buffer);
    let pos = 0;
    
    // XML header
    view.setUint16(pos, 0x0003, true); pos += 2; // type: RES_XML_TYPE
    view.setUint16(pos, 8, true); pos += 2;      // header size
    view.setUint32(pos, totalSize, true); pos += 4; // total size
    
    // String pool header
    const stringPoolStart = pos;
    view.setUint16(pos, 0x0001, true); pos += 2; // type: RES_STRING_POOL_TYPE
    view.setUint16(pos, 28, true); pos += 2;     // header size
    view.setUint32(pos, stringPoolSize, true); pos += 4; // chunk size
    view.setUint32(pos, strings.length, true); pos += 4; // string count
    view.setUint32(pos, 0, true); pos += 4;      // style count
    view.setUint32(pos, 0x100, true); pos += 4;  // flags: UTF-8
    view.setUint32(pos, stringPoolHeaderSize + stringOffsetsSize, true); pos += 4; // strings start
    view.setUint32(pos, 0, true); pos += 4;      // styles start
    
    // String offsets
    let stringOffset = 0;
    for (let i = 0; i < strings.length; i++) {
        view.setUint32(pos, stringOffset, true); pos += 4;
        const charLen = encodedStrings[i].length;
        const byteLen = encodedStrings[i].length;
        stringOffset += (charLen >= 128 ? 2 : 1) + (byteLen >= 128 ? 2 : 1) + byteLen + 1;
    }

    // String data (UTF-8 format)
    // Format: char_length (1-2 bytes), byte_length (1-2 bytes), data, null
    for (let i = 0; i < strings.length; i++) {
        const s = encodedStrings[i];
        const charLen = s.length;
        const byteLen = s.length;

        // Write char length
        if (charLen >= 128) {
            xml[pos++] = (charLen >> 8) | 0x80;
            xml[pos++] = charLen & 0xFF;
        } else {
            xml[pos++] = charLen;
        }

        // Write byte length
        if (byteLen >= 128) {
            xml[pos++] = (byteLen >> 8) | 0x80;
            xml[pos++] = byteLen & 0xFF;
        } else {
            xml[pos++] = byteLen;
        }

        xml.set(s, pos);
        pos += s.length;
        xml[pos++] = 0; // null terminator
    }
    // Align to 4 bytes
    while (pos % 4 !== 0) pos++;
    
    // Start namespace
    view.setUint16(pos, 0x0100, true); pos += 2; // type
    view.setUint16(pos, 16, true); pos += 2;     // header size
    view.setUint32(pos, 24, true); pos += 4;     // chunk size
    view.setUint32(pos, 1, true); pos += 4;      // line number
    view.setUint32(pos, -1, true); pos += 4;     // comment
    view.setUint32(pos, 1, true); pos += 4;      // prefix: "android"
    view.setUint32(pos, 2, true); pos += 4;      // uri
    
    // Helper to write start element
    function writeStartElement(nameIdx: number, attrs: {nsIdx: number, nameIdx: number, rawIdx: number, type: number, data: number}[]) {
        const chunkSize = startElementBaseSize + attrs.length * attrSize;
        view.setUint16(pos, 0x0102, true); pos += 2; // type
        view.setUint16(pos, 16, true); pos += 2;     // header size
        view.setUint32(pos, chunkSize, true); pos += 4; // chunk size
        view.setUint32(pos, 1, true); pos += 4;      // line number
        view.setUint32(pos, -1, true); pos += 4;     // comment
        view.setUint32(pos, -1, true); pos += 4;     // namespace (none)
        view.setUint32(pos, nameIdx, true); pos += 4; // name
        view.setUint16(pos, 0x14, true); pos += 2;   // attribute start
        view.setUint16(pos, 0x14, true); pos += 2;   // attribute size
        view.setUint16(pos, attrs.length, true); pos += 2; // attribute count
        view.setUint16(pos, 0, true); pos += 2;      // id index
        view.setUint16(pos, 0, true); pos += 2;      // class index
        view.setUint16(pos, 0, true); pos += 2;      // style index
        
        for (const attr of attrs) {
            view.setUint32(pos, attr.nsIdx, true); pos += 4;   // namespace
            view.setUint32(pos, attr.nameIdx, true); pos += 4; // name
            view.setUint32(pos, attr.rawIdx, true); pos += 4;  // raw value
            view.setUint16(pos, 8, true); pos += 2;            // size
            xml[pos++] = 0;                                     // reserved
            xml[pos++] = attr.type;                             // type
            view.setUint32(pos, attr.data, true); pos += 4;    // data
        }
    }
    
    // Helper to write end element
    function writeEndElement(nameIdx: number) {
        view.setUint16(pos, 0x0103, true); pos += 2; // type
        view.setUint16(pos, 16, true); pos += 2;     // header size
        view.setUint32(pos, 24, true); pos += 4;     // chunk size
        view.setUint32(pos, 1, true); pos += 4;      // line number
        view.setUint32(pos, -1, true); pos += 4;     // comment
        view.setUint32(pos, -1, true); pos += 4;     // namespace
        view.setUint32(pos, nameIdx, true); pos += 4; // name
    }
    
    // manifest element with package attribute
    writeStartElement(3, [
        { nsIdx: -1, nameIdx: 4, rawIdx: 5, type: 0x03, data: 5 } // package="com.example.hello"
    ]);
    
    // application element
    writeStartElement(6, [
        { nsIdx: 2, nameIdx: 7, rawIdx: 8, type: 0x03, data: 8 } // android:label="Hello"
    ]);
    
    // activity element
    writeStartElement(9, [
        { nsIdx: 2, nameIdx: 10, rawIdx: 11, type: 0x03, data: 11 }, // android:name=".MainActivity"
        { nsIdx: 2, nameIdx: 12, rawIdx: -1, type: 0x12, data: 0xFFFFFFFF } // android:exported="true"
    ]);
    
    // intent-filter element
    writeStartElement(13, []);
    
    // action element
    writeStartElement(14, [
        { nsIdx: 2, nameIdx: 10, rawIdx: 15, type: 0x03, data: 15 } // android:name="android.intent.action.MAIN"
    ]);
    writeEndElement(14);
    
    // category element
    writeStartElement(16, [
        { nsIdx: 2, nameIdx: 10, rawIdx: 17, type: 0x03, data: 17 } // android:name="android.intent.category.LAUNCHER"
    ]);
    writeEndElement(16);
    
    writeEndElement(13); // end intent-filter
    writeEndElement(9);  // end activity
    writeEndElement(6);  // end application
    writeEndElement(3);  // end manifest
    
    // End namespace
    view.setUint16(pos, 0x0101, true); pos += 2; // type
    view.setUint16(pos, 16, true); pos += 2;     // header size
    view.setUint32(pos, 24, true); pos += 4;     // chunk size
    view.setUint32(pos, 1, true); pos += 4;      // line number
    view.setUint32(pos, -1, true); pos += 4;     // comment
    view.setUint32(pos, 1, true); pos += 4;      // prefix
    view.setUint32(pos, 2, true); pos += 4;      // uri
    
    return xml.slice(0, pos);
}

/**
 * Create a ZIP file with STORE compression.
 */
function createZip(files: { name: string; data: Uint8Array }[]): Uint8Array {
    const parts: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;

    for (const file of files) {
        const nameBytes = new TextEncoder().encode(file.name);
        
        // Local file header
        const lfh = new Uint8Array(30 + nameBytes.length);
        const lfhView = new DataView(lfh.buffer);
        
        lfhView.setUint32(0, 0x04034b50, true);
        lfhView.setUint16(4, 10, true);
        lfhView.setUint16(6, 0, true);
        lfhView.setUint16(8, 0, true); // STORE
        lfhView.setUint16(10, 0, true);
        lfhView.setUint16(12, 0, true);
        lfhView.setUint32(14, crc32(file.data), true);
        lfhView.setUint32(18, file.data.length, true);
        lfhView.setUint32(22, file.data.length, true);
        lfhView.setUint16(26, nameBytes.length, true);
        lfhView.setUint16(28, 0, true);
        lfh.set(nameBytes, 30);
        
        // Central directory entry
        const cd = new Uint8Array(46 + nameBytes.length);
        const cdView = new DataView(cd.buffer);
        
        cdView.setUint32(0, 0x02014b50, true);
        cdView.setUint16(4, 0, true);
        cdView.setUint16(6, 10, true);
        cdView.setUint16(8, 0, true);
        cdView.setUint16(10, 0, true);
        cdView.setUint16(12, 0, true);
        cdView.setUint16(14, 0, true);
        cdView.setUint32(16, crc32(file.data), true);
        cdView.setUint32(20, file.data.length, true);
        cdView.setUint32(24, file.data.length, true);
        cdView.setUint16(28, nameBytes.length, true);
        cdView.setUint16(30, 0, true);
        cdView.setUint16(32, 0, true);
        cdView.setUint16(34, 0, true);
        cdView.setUint16(36, 0, true);
        cdView.setUint32(38, 0, true);
        cdView.setUint32(42, offset, true);
        cd.set(nameBytes, 46);
        
        parts.push(lfh);
        parts.push(file.data);
        centralDirectory.push(cd);
        
        offset += lfh.length + file.data.length;
    }

    const cdOffset = offset;
    let cdSize = 0;
    for (const cd of centralDirectory) {
        parts.push(cd);
        cdSize += cd.length;
    }

    const eocd = new Uint8Array(22);
    const eocdView = new DataView(eocd.buffer);
    
    eocdView.setUint32(0, 0x06054b50, true);
    eocdView.setUint16(4, 0, true);
    eocdView.setUint16(6, 0, true);
    eocdView.setUint16(8, files.length, true);
    eocdView.setUint16(10, files.length, true);
    eocdView.setUint32(12, cdSize, true);
    eocdView.setUint32(16, cdOffset, true);
    eocdView.setUint16(20, 0, true);
    
    parts.push(eocd);

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let pos = 0;
    for (const part of parts) {
        result.set(part, pos);
        pos += part.length;
    }

    return result;
}

/**
 * CRC32 calculation for ZIP.
 */
function crc32(data: Uint8Array): number {
    let crc = 0xFFFFFFFF;
    const table = makeCrc32Table();
    
    for (let i = 0; i < data.length; i++) {
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function makeCrc32Table(): Uint32Array {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
            c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
    }
    return table;
}

// Main
function main() {
    // Create fixtures directory
    if (!fs.existsSync(FIXTURES_DIR)) {
        fs.mkdirSync(FIXTURES_DIR, { recursive: true });
    }
    
    console.log('Generating test fixtures...');
    
    // Create DEX file
    const dex = createMinimalDex();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'hello_world.dex'), dex);
    console.log('  Created hello_world.dex (' + dex.length + ' bytes)');
    
    // Create manifest
    const manifest = createMinimalManifest();
    fs.writeFileSync(path.join(FIXTURES_DIR, 'manifest_binary.xml'), manifest);
    console.log('  Created manifest_binary.xml (' + manifest.length + ' bytes)');
    
    // Create APK
    const apk = createZip([
        { name: 'AndroidManifest.xml', data: manifest },
        { name: 'classes.dex', data: dex }
    ]);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'hello_world.apk'), apk);
    console.log('  Created hello_world.apk (' + apk.length + ' bytes)');
    
    console.log('\nDone! Fixtures saved to: ' + FIXTURES_DIR);
}

main();
