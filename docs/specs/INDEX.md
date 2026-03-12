# CRAFT Shim Layer — API Specification Index

Specifications in this directory are **prescriptive contracts** for the CRAFT shim
layer (Layer 2) and the intermediate view tree (Layer 3). An implementation MUST
satisfy every normative requirement (MUST / SHALL). Advisory statements use SHOULD.
Terminology follows RFC 2119.

## How to use these specs

| Task | What to read |
|------|-------------|
| Implementing a shim method | Open the spec for that class; follow the method contract exactly. |
| Reviewing an existing shim | Check every method in the spec against the implementation. |
| Debugging a rendering issue | Check the ViewNode Property Contract section for the relevant class. |
| Adding a new ViewNode key | Add it to the key registry below before writing any shim code. |

---

## Spec Files

### Java Standard Library

| ID | Class | Spec file |
|----|-------|-----------|
| JL-1 | `java.lang.Object` | [java_lang_object.md](java_lang_object.md) |
| JL-2 | `java.lang.String` | [java_lang_string.md](java_lang_string.md) |
| JL-3 | `java.lang.StringBuilder` | [java_lang_string_builder.md](java_lang_string_builder.md) |
| JL-4 | `java.lang.System` | [java_lang_system.md](java_lang_system.md) |
| JL-5 | `java.lang.Class` | [java_lang_class.md](java_lang_class.md) |

### Android Platform

| ID | Class | Spec file |
|----|-------|-----------|
| A-1 | `android.os.Bundle` | [android_os_bundle.md](android_os_bundle.md) |
| A-2 | `android.content.Context` | [android_content_context.md](android_content_context.md) |
| A-3 | `android.content.ContextWrapper` | [android_content_context_wrapper.md](android_content_context_wrapper.md) |
| A-4 | `android.app.Activity` | [android_app_activity.md](android_app_activity.md) |

### Android View System

| ID | Class | Spec file |
|----|-------|-----------|
| V-1 | `android.view.View` | [android_view_view.md](android_view_view.md) |
| V-2 | `android.view.ViewGroup` | [android_view_view_group.md](android_view_view_group.md) |
| V-3 | `android.widget.TextView` | [android_widget_text_view.md](android_widget_text_view.md) |
| V-4 | `android.widget.LinearLayout` | [android_widget_linear_layout.md](android_widget_linear_layout.md) |
| V-5 | `android.widget.Button` | [android_widget_button.md](android_widget_button.md) |

---

## ViewNode Property Key Registry

All keys that shims MAY write to a ViewNode. No key may be used before it is listed
here. Keys are the Layer 2 → Layer 3 contract; all renderers read the same keys.

| Key | Type | Owner spec | Default | Notes |
|-----|------|-----------|---------|-------|
| `visibility` | `int` | V-1 | `0` | 0=VISIBLE, 4=INVISIBLE, 8=GONE |
| `text` | `string` | V-3 | `""` | UTF-8 text content |
| `textSize` | `float` | V-3 | `14.0` | SP units |
| `textColor` | `int` | V-3 | `0xFF000000` | ARGB 32-bit integer |
| `orientation` | `int` | V-4 | `0` | 0=HORIZONTAL, 1=VERTICAL |

---

## Class Hierarchy

```
java.lang.Object  (JL-1)
├── java.lang.String  (JL-2)
├── java.lang.StringBuilder  (JL-3)
├── java.lang.Class  (JL-5)
├── android.os.Bundle  (A-1)
├── android.content.Context  (A-2)
│     └── android.content.ContextWrapper  (A-3)
│           └── android.app.Activity  (A-4)
└── android.view.View  (V-1)
      └── android.view.ViewGroup  (V-2)
            ├── android.widget.TextView  (V-3)
            │     └── android.widget.Button  (V-5)
            └── android.widget.LinearLayout  (V-4)
```

---

## Demo App Coverage Matrix

| Spec | hello_world | calculator | clock |
|------|:-----------:|:----------:|:-----:|
| JL-2 String | ✓ | ✓ | ✓ |
| JL-3 StringBuilder | — | ✓ | ✓ |
| JL-4 System | — | — | ✓ |
| A-1 Bundle | ✓ | ✓ | ✓ |
| A-2/A-3 Context chain | ✓ | ✓ | ✓ |
| A-4 Activity | ✓ | ✓ | ✓ |
| V-1 View | ✓ | ✓ | ✓ |
| V-2 ViewGroup | ✓ | ✓ | ✓ |
| V-3 TextView | ✓ | — | ✓ |
| V-4 LinearLayout | ✓ | ✓ | ✓ |
| V-5 Button | — | ✓ | — |
