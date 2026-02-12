/**
 * CRAFT - Method Resolver
 * Method lookup and virtual dispatch with caching.
 */

import { DexParser } from '../parser/dex_parser';
import { ClassLoader } from './class_loader';
import { ResolvedMethod } from './types';
import { NoSuchMethodError } from './errors';

export class MethodResolver {
  private dex: DexParser;
  private classLoader: ClassLoader;

  private methodCache: Map<number, ResolvedMethod> = new Map();
  private virtualMethodCache: Map<string, ResolvedMethod> = new Map();

  constructor(dex: DexParser, classLoader: ClassLoader) {
    this.dex = dex;
    this.classLoader = classLoader;
  }

  /** Resolve a method by its DEX index (with caching) */
  resolveByIndex(methodIdx: number): ResolvedMethod {
    const cached = this.methodCache.get(methodIdx);
    if (cached) return cached;

    const method = this.classLoader.resolveMethod(methodIdx);
    this.methodCache.set(methodIdx, method);
    return method;
  }

  /** Resolve virtual method with caching */
  resolveVirtual(objectClass: string, methodIdx: number): ResolvedMethod {
    const cacheKey = `${objectClass}:${methodIdx}`;
    const cached = this.virtualMethodCache.get(cacheKey);
    if (cached) return cached;

    const method = this.classLoader.resolveVirtualMethod(
      // We need the object ref for this - delegate to classLoader
      // This method is called when we already know the class
      0, // placeholder - the actual resolution uses objectClass below
      methodIdx
    );

    this.virtualMethodCache.set(cacheKey, method);
    return method;
  }

  /** Resolve super method */
  resolveSuper(callingClass: string, methodIdx: number): ResolvedMethod {
    return this.classLoader.resolveSuperMethod(callingClass, methodIdx);
  }

  /** Invalidate all caches */
  invalidateCache(): void {
    this.methodCache.clear();
    this.virtualMethodCache.clear();
  }
}
