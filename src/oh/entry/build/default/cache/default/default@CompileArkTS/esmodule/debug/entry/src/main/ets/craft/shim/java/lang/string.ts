import type { ShimRegistry } from '../../../interpreter/shim_registry';
import { StringIndexOutOfBoundsException } from "@bundle:com.craft.runtime/entry/ets/craft/interpreter/errors";
const STRING_CLASS = 'Ljava/lang/String;';
export function registerStringShim(registry: ShimRegistry): void {
    // <init>()V - Empty string
    registry.register(STRING_CLASS, '<init>', '()V', (interp, heap, thisRef, args) => {
        heap.setStringValue(thisRef, '');
        return { type: 'null' };
    });
    // <init>(Ljava/lang/String;)V - Copy constructor
    registry.register(STRING_CLASS, '<init>', '(Ljava/lang/String;)V', (interp, heap, thisRef, args) => {
        const sourceRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const value = heap.getStringValue(sourceRef);
        heap.setStringValue(thisRef, value);
        return { type: 'null' };
    });
    // length()I
    registry.register(STRING_CLASS, 'length', '()I', (interp, heap, thisRef, args) => {
        const value = heap.getStringValue(thisRef);
        return { type: 'int', value: value.length };
    });
    // charAt(I)C
    registry.register(STRING_CLASS, 'charAt', '(I)C', (interp, heap, thisRef, args) => {
        const index = (args[0] as {
            type: 'int';
            value: number;
        }).value;
        const value = heap.getStringValue(thisRef);
        if (index < 0 || index >= value.length) {
            throw new StringIndexOutOfBoundsException(index);
        }
        return { type: 'int', value: value.charCodeAt(index) };
    });
    // equals(Ljava/lang/Object;)Z
    registry.register(STRING_CLASS, 'equals', '(Ljava/lang/Object;)Z', (interp, heap, thisRef, args) => {
        const other = args[0];
        if (other.type === 'null') {
            return { type: 'int', value: 0 };
        }
        const otherRef = (other as {
            type: 'object';
            ref: number;
        }).ref;
        const otherDescriptor = heap.getClassDescriptor(otherRef);
        if (otherDescriptor !== STRING_CLASS) {
            return { type: 'int', value: 0 };
        }
        const thisValue = heap.getStringValue(thisRef);
        const otherValue = heap.getStringValue(otherRef);
        return { type: 'int', value: thisValue === otherValue ? 1 : 0 };
    });
    // hashCode()I
    registry.register(STRING_CLASS, 'hashCode', '()I', (interp, heap, thisRef, args) => {
        const value = heap.getStringValue(thisRef);
        let hash = 0;
        for (let i = 0; i < value.length; i++) {
            hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
        }
        return { type: 'int', value: hash };
    });
    // toString()Ljava/lang/String;
    registry.register(STRING_CLASS, 'toString', '()Ljava/lang/String;', (interp, heap, thisRef, args) => {
        return { type: 'object', ref: thisRef };
    });
    // substring(I)Ljava/lang/String;
    registry.register(STRING_CLASS, 'substring', '(I)Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const start = (args[0] as {
            type: 'int';
            value: number;
        }).value;
        const value = heap.getStringValue(thisRef);
        const result = value.substring(start);
        const ref = heap.internString(result);
        return { type: 'object', ref };
    });
    // substring(II)Ljava/lang/String;
    registry.register(STRING_CLASS, 'substring', '(II)Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const start = (args[0] as {
            type: 'int';
            value: number;
        }).value;
        const end = (args[1] as {
            type: 'int';
            value: number;
        }).value;
        const value = heap.getStringValue(thisRef);
        const result = value.substring(start, end);
        const ref = heap.internString(result);
        return { type: 'object', ref };
    });
    // concat(Ljava/lang/String;)Ljava/lang/String;
    registry.register(STRING_CLASS, 'concat', '(Ljava/lang/String;)Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const otherRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const thisValue = heap.getStringValue(thisRef);
        const otherValue = heap.getStringValue(otherRef);
        const ref = heap.internString(thisValue + otherValue);
        return { type: 'object', ref };
    });
    // valueOf(I)Ljava/lang/String;
    registry.register(STRING_CLASS, 'valueOf', '(I)Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const intVal = (args[0] as {
            type: 'int';
            value: number;
        }).value;
        const ref = heap.internString(intVal.toString());
        return { type: 'object', ref };
    });
    // valueOf(Ljava/lang/Object;)Ljava/lang/String;
    registry.register(STRING_CLASS, 'valueOf', '(Ljava/lang/Object;)Ljava/lang/String;', (interp, heap, thisRef, args) => {
        if (args[0].type === 'null') {
            const ref = heap.internString('null');
            return { type: 'object', ref };
        }
        const objRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const descriptor = heap.getClassDescriptor(objRef);
        if (descriptor === STRING_CLASS) {
            return { type: 'object', ref: objRef };
        }
        // Call toString on the object
        const result = interp.invoke(descriptor!, 'toString', '()Ljava/lang/String;', [args[0]]);
        return result;
    });
}
