import type { ShimRegistry } from '../../../interpreter/shim_registry';
import { NULL_VALUE, intValue } from "@bundle:com.craft.runtime/entry/ets/craft/core/types";
const VIEW_CLASS = 'Landroid/view/View;';
/** Visibility constants matching Android */
export const VISIBLE = 0;
export const INVISIBLE = 4;
export const GONE = 8;
export function registerViewShim(registry: ShimRegistry): void {
    // <init>(Landroid/content/Context;)V
    registry.register(VIEW_CLASS, '<init>', '(Landroid/content/Context;)V', (_interp, heap, thisRef, args) => {
        heap.setField(thisRef, 'mContext', args[0]);
        heap.setField(thisRef, 'mId', intValue(-1));
        heap.setField(thisRef, 'mVisibility', intValue(VISIBLE));
        return NULL_VALUE;
    });
    // getContext()Landroid/content/Context;
    registry.register(VIEW_CLASS, 'getContext', '()Landroid/content/Context;', (_interp, heap, thisRef, _args) => {
        return heap.getField(thisRef, 'mContext');
    });
    // setId(I)V
    registry.register(VIEW_CLASS, 'setId', '(I)V', (_interp, heap, thisRef, args) => {
        heap.setField(thisRef, 'mId', args[0]);
        return NULL_VALUE;
    });
    // getId()I
    registry.register(VIEW_CLASS, 'getId', '()I', (_interp, heap, thisRef, _args) => {
        return heap.getField(thisRef, 'mId');
    });
    // setVisibility(I)V
    registry.register(VIEW_CLASS, 'setVisibility', '(I)V', (_interp, heap, thisRef, args) => {
        heap.setField(thisRef, 'mVisibility', args[0]);
        return NULL_VALUE;
    });
    // getVisibility()I
    registry.register(VIEW_CLASS, 'getVisibility', '()I', (_interp, heap, thisRef, _args) => {
        return heap.getField(thisRef, 'mVisibility');
    });
}
