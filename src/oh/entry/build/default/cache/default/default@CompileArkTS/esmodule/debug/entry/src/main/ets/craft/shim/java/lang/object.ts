import type { ShimRegistry } from '../../../interpreter/shim_registry';
const OBJECT_CLASS = 'Ljava/lang/Object;';
export function registerObjectShim(registry: ShimRegistry): void {
    // <init>()V
    registry.register(OBJECT_CLASS, '<init>', '()V', (interp, heap, thisRef, args) => {
        return { type: 'null' };
    });
    // getClass()Ljava/lang/Class;
    registry.register(OBJECT_CLASS, 'getClass', '()Ljava/lang/Class;', (interp, heap, thisRef, args) => {
        const descriptor = heap.getClassDescriptor(thisRef);
        const classRef = interp.getClassLoader().getClassObject(descriptor!);
        return { type: 'object', ref: classRef };
    });
    // hashCode()I
    registry.register(OBJECT_CLASS, 'hashCode', '()I', (interp, heap, thisRef, args) => {
        return { type: 'int', value: thisRef };
    });
    // equals(Ljava/lang/Object;)Z
    registry.register(OBJECT_CLASS, 'equals', '(Ljava/lang/Object;)Z', (interp, heap, thisRef, args) => {
        const other = args[0];
        if (other.type === 'null') {
            return { type: 'int', value: 0 };
        }
        const otherRef = (other as {
            type: 'object';
            ref: number;
        }).ref;
        return { type: 'int', value: thisRef === otherRef ? 1 : 0 };
    });
    // toString()Ljava/lang/String;
    registry.register(OBJECT_CLASS, 'toString', '()Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const descriptor = heap.getClassDescriptor(thisRef);
        const str = `${descriptor}@${thisRef.toString(16)}`;
        const ref = heap.internString(str);
        return { type: 'object', ref };
    });
}
