import type { ShimRegistry } from '../../../interpreter/shim_registry';
const SYSTEM_CLASS = 'Ljava/lang/System;';
export function registerSystemShim(registry: ShimRegistry): void {
    // currentTimeMillis()J
    registry.register(SYSTEM_CLASS, 'currentTimeMillis', '()J', (interp, heap, thisRef, args) => {
        const time = Date.now();
        return { type: 'long', value: BigInt(time) };
    });
    // identityHashCode(Ljava/lang/Object;)I
    registry.register(SYSTEM_CLASS, 'identityHashCode', '(Ljava/lang/Object;)I', (interp, heap, thisRef, args) => {
        if (args[0].type === 'null') {
            return { type: 'int', value: 0 };
        }
        const ref = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        return { type: 'int', value: ref };
    });
    // arraycopy(Ljava/lang/Object;ILjava/lang/Object;II)V
    registry.register(SYSTEM_CLASS, 'arraycopy', '(Ljava/lang/Object;ILjava/lang/Object;II)V', (interp, heap, thisRef, args) => {
        const srcRef = (args[0] as {
            type: 'object';
            ref: number;
        }).ref;
        const srcPos = (args[1] as {
            type: 'int';
            value: number;
        }).value;
        const dstRef = (args[2] as {
            type: 'object';
            ref: number;
        }).ref;
        const dstPos = (args[3] as {
            type: 'int';
            value: number;
        }).value;
        const length = (args[4] as {
            type: 'int';
            value: number;
        }).value;
        for (let i = 0; i < length; i++) {
            const value = heap.getArrayElement(srcRef, srcPos + i);
            heap.setArrayElement(dstRef, dstPos + i, value);
        }
        return { type: 'null' };
    });
}
