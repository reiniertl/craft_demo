import type { ShimRegistry } from '../../../interpreter/shim_registry';
const CLASS_CLASS = 'Ljava/lang/Class;';
export function registerClassShim(registry: ShimRegistry): void {
    // getName()Ljava/lang/String;
    registry.register(CLASS_CLASS, 'getName', '()Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const descriptor = heap.getField(thisRef, '__classDescriptor');
        const descriptorRef = (descriptor as {
            type: 'object';
            ref: number;
        }).ref;
        const descriptorStr = heap.getStringValue(descriptorRef);
        // Convert Lcom/example/Foo; to com.example.Foo
        const name = descriptorStr.slice(1, -1).replace(/\//g, '.');
        const ref = heap.internString(name);
        return { type: 'object', ref };
    });
    // getSimpleName()Ljava/lang/String;
    registry.register(CLASS_CLASS, 'getSimpleName', '()Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const descriptor = heap.getField(thisRef, '__classDescriptor');
        const descriptorRef = (descriptor as {
            type: 'object';
            ref: number;
        }).ref;
        const descriptorStr = heap.getStringValue(descriptorRef);
        const fullName = descriptorStr.slice(1, -1);
        const simpleName = fullName.substring(fullName.lastIndexOf('/') + 1);
        const ref = heap.internString(simpleName);
        return { type: 'object', ref };
    });
    // toString()Ljava/lang/String;
    registry.register(CLASS_CLASS, 'toString', '()Ljava/lang/String;', (interp, heap, thisRef, args) => {
        const descriptor = heap.getField(thisRef, '__classDescriptor');
        const descriptorRef = (descriptor as {
            type: 'object';
            ref: number;
        }).ref;
        const descriptorStr = heap.getStringValue(descriptorRef);
        const name = descriptorStr.slice(1, -1).replace(/\//g, '.');
        const ref = heap.internString(`class ${name}`);
        return { type: 'object', ref };
    });
}
