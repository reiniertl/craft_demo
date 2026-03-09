# CRAFT API Mapping Report: Android → OpenHarmony

**Date:** 2026-03-09
**Scope:** Full Android SDK API surface mapped against OpenHarmony SDK (API 21, 602 declarations, 120 UI components, 47 kit bundles)
**Sources:** CRAFT shim layer, AOSP source (partial checkout), OpenHarmony source & SDK

---

## Executive Summary

A native Android-to-OpenHarmony translation requires mapping **~500+ classes** across **~40 Android/Java packages** plus **~100+ AndroidX/Material classes**. CRAFT currently implements **14 classes (76 methods)** — roughly **2.5%** of the practical API surface.

The OpenHarmony SDK is extensive (602 API declarations, 47 kit bundles) and provides equivalents for the majority of Android APIs, though often with different paradigms (declarative vs imperative UI, struct composition vs class inheritance).

| Category | Classes | Est. Methods | Status |
|----------|---------|-------------|--------|
| Implemented in CRAFT | 14 | 76 | Functional, device-tested |
| Directly mappable (OH equivalent) | ~250 | ~3,000+ | Clear OH counterpart exists |
| Partially mappable (paradigm gaps) | ~120 | ~1,500+ | OH equivalent exists but different patterns |
| Not mappable (no OH equivalent) | ~130+ | ~1,000+ | Google-proprietary, Android-internal, or deprecated |

---

## 1. Currently Implemented in CRAFT (14 classes, 76 methods)

### 1.1 Java Standard Library (5 classes, 32 methods)

| Class | Methods | Notes |
|-------|---------|-------|
| `java.lang.Object` | 5 | `<init>`, `getClass`, `hashCode`, `equals`, `toString` |
| `java.lang.String` | 13 | Constructors, `length`, `charAt`, `equals`, `hashCode`, `toString`, `substring`×2, `concat`, `valueOf`×3 |
| `java.lang.StringBuilder` | 8 | Constructors, `append`×4, `toString`, `length` |
| `java.lang.Class` | 3 | `getName`, `getSimpleName`, `toString` |
| `java.lang.System` | 3 | `currentTimeMillis`, `identityHashCode`, `arraycopy` |

### 1.2 Android Framework (9 classes, 44 methods)

| Class | Methods | UI Bridge | Notes |
|-------|---------|-----------|-------|
| `android.os.Bundle` | 4 | No | `putString`, `getString`, `containsKey` |
| `android.content.Context` | 2 | No | Stub: `getApplicationContext` returns self |
| `android.content.ContextWrapper` | 4 | No | `getBaseContext`, `getApplicationContext` |
| `android.view.View` | 8 | Yes | `setId`/`getId`, visibility, click listeners |
| `android.view.ViewGroup` | 3 | Yes | `addView`, `getChildCount` |
| `android.widget.TextView` | 5 | Yes | `setText`/`getText`, `setTextSize`, `setTextColor` |
| `android.widget.LinearLayout` | 3 | Yes | `setOrientation`/`getOrientation` |
| `android.widget.Button` | 1 | Yes | Constructor only (inherits TextView) |
| `android.app.Activity` | 11 | Yes | Lifecycle + `setContentView`, `finish` |

### 1.3 Bridge Layer

| Component | Purpose |
|-----------|---------|
| `UIBridge` | View→ViewNode tree, property updates, click dispatch |
| `StateManager` | Reactive `@State` re-renders via version counter |
| `LifecycleBridge` | OH Ability lifecycle → Android Activity lifecycle |

---

## 2. Full Android API Surface — Java Standard Library

### 2.1 java.lang (~45 classes)

| Android Class | Key Methods | CRAFT | OH Mapping | Status |
|---------------|------------|-------|------------|--------|
| `Object` | `equals`, `hashCode`, `toString`, `getClass`, `clone`, `wait`, `notify`, `finalize` | **5/8** | TS native | Implemented |
| `String` | `length`, `charAt`, `substring`, `indexOf`, `contains`, `replace`, `split`, `trim`, `toUpperCase`, `toLowerCase`, `startsWith`, `endsWith`, `matches`, `format`, `join`, `toCharArray`, `getBytes`, `compareTo`, `isEmpty`, `strip` | **13/60+** | TS native | Partial |
| `StringBuilder` | `append`(×12 overloads), `insert`, `delete`, `replace`, `reverse`, `charAt`, `setCharAt`, `indexOf`, `capacity` | **8/20+** | TS native | Partial |
| `StringBuffer` | Same as StringBuilder (synchronized) | 0 | TS native | Not impl |
| `Class<T>` | `forName`, `newInstance`, `getName`, `getSimpleName`, `getSuperclass`, `getInterfaces`, `isInstance`, `isAssignableFrom`, `getField(s)`, `getMethod(s)`, `getConstructor(s)`, `getAnnotation(s)`, `cast`, `getClassLoader` | **3/30+** | TS shim | Partial |
| `System` | `currentTimeMillis`, `nanoTime`, `arraycopy`, `exit`, `gc`, `getProperty`, `setProperty`, `getenv`, `identityHashCode`, `lineSeparator` | **3/10** | TS shim | Partial |
| `Math` | `abs`, `max`, `min`, `sqrt`, `pow`, `log`, `sin`, `cos`, `tan`, `ceil`, `floor`, `round`, `random`, `PI`, `E`, `atan2`, `exp`, `signum`, `toDegrees`, `toRadians` | 0 | `Math` (JS native) | Mappable |
| `Integer` | `parseInt`, `valueOf`, `toString`, `intValue`, `MAX_VALUE`, `MIN_VALUE`, `compare`, `hashCode`, `toHexString`, `toBinaryString`, `toOctalString`, `decode`, `bitCount`, `reverse`, `rotateLeft` | 0 | TS shim | Mappable |
| `Long` | `parseLong`, `valueOf`, `toString`, `longValue`, `MAX_VALUE`, `MIN_VALUE`, `compare`, `toHexString`, `toBinaryString` | 0 | TS shim | Mappable |
| `Float` | `parseFloat`, `valueOf`, `toString`, `floatValue`, `isNaN`, `isInfinite`, `intBitsToFloat`, `floatToIntBits`, `compare`, `MAX_VALUE`, `MIN_VALUE`, `NaN`, `POSITIVE_INFINITY` | 0 | TS shim | Mappable |
| `Double` | `parseDouble`, `valueOf`, `toString`, `doubleValue`, `isNaN`, `isInfinite`, `longBitsToDouble`, `doubleToLongBits`, `compare`, `MAX_VALUE`, `MIN_VALUE` | 0 | TS shim | Mappable |
| `Boolean` | `parseBoolean`, `valueOf`, `toString`, `booleanValue`, `TRUE`, `FALSE`, `compare` | 0 | TS shim | Mappable |
| `Byte` | `parseByte`, `valueOf`, `toString`, `byteValue`, `MAX_VALUE`, `MIN_VALUE` | 0 | TS shim | Mappable |
| `Short` | `parseShort`, `valueOf`, `toString`, `shortValue`, `MAX_VALUE`, `MIN_VALUE` | 0 | TS shim | Mappable |
| `Character` | `isDigit`, `isLetter`, `isWhitespace`, `isUpperCase`, `isLowerCase`, `toUpperCase`, `toLowerCase`, `valueOf`, `charValue`, `getNumericValue`, `getType`, `isLetterOrDigit` | 0 | TS shim | Mappable |
| `Number` | `intValue`, `longValue`, `floatValue`, `doubleValue` | 0 | TS shim | Mappable |
| `Enum<E>` | `name`, `ordinal`, `valueOf`, `values`, `compareTo` | 0 | TS shim | Mappable |
| `Thread` | `start`, `run`, `sleep`, `join`, `interrupt`, `isAlive`, `setName`, `getName`, `setPriority`, `currentThread`, `yield`, `setDaemon`, `getStackTrace` | 0 | `@ohos.worker` / `taskpool` | Partial |
| `Runnable` | `run` | 0 | TS interface | Mappable |
| `Throwable` | `getMessage`, `getCause`, `printStackTrace`, `getStackTrace`, `initCause`, `toString` | 0 | TS Error | Mappable |
| `Exception` | inherits Throwable | 0 | TS Error | Mappable |
| `RuntimeException` | inherits Exception | 0 | TS Error | Mappable |
| `Error` | inherits Throwable | 0 | TS Error | Mappable |
| `NullPointerException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `IllegalArgumentException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `IllegalStateException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `IndexOutOfBoundsException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `ClassCastException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `UnsupportedOperationException` | inherits RuntimeException | 0 | TS Error | Mappable |
| `IOException` | inherits Exception | 0 | TS Error | Mappable |
| `Iterable<T>` | `iterator`, `forEach`, `spliterator` | 0 | TS interface | Mappable |
| `Comparable<T>` | `compareTo` | 0 | TS interface | Mappable |
| `Cloneable` | marker interface | 0 | TS interface | Mappable |
| `AutoCloseable` | `close` | 0 | TS interface | Mappable |
| `ClassLoader` | `loadClass`, `getResource`, `getSystemClassLoader` | 0 | — | Not mappable |
| `Runtime` | `getRuntime`, `exec`, `exit`, `gc`, `freeMemory`, `maxMemory`, `totalMemory`, `availableProcessors` | 0 | `@ohos.process` | Partial |
| `ProcessBuilder` | `command`, `start`, `environment`, `directory` | 0 | — | Not mappable |
| `Process` | `waitFor`, `exitValue`, `destroy`, `getInputStream`, `getOutputStream` | 0 | — | Not mappable |
| `Void` | Companion type | 0 | TS void | Mappable |
| `StackTraceElement` | `getClassName`, `getMethodName`, `getFileName`, `getLineNumber` | 0 | TS shim | Mappable |
| `ThreadLocal<T>` | `get`, `set`, `remove`, `initialValue` | 0 | TS shim (Map) | Mappable |
| `ref.WeakReference` | `get`, `clear` | 0 | JS WeakRef | Mappable |
| `ref.SoftReference` | `get`, `clear` | 0 | — | Not mappable |
| `reflect.Field` | `get`, `set`, `getName`, `getType` | 0 | — | Not mappable |
| `reflect.Method` | `invoke`, `getName`, `getParameterTypes`, `getReturnType` | 0 | — | Not mappable |
| `reflect.Constructor` | `newInstance`, `getParameterTypes` | 0 | — | Not mappable |

### 2.2 java.util (~60 classes)

| Android Class | Key Methods | CRAFT | OH Mapping | Status |
|---------------|------------|-------|------------|--------|
| `ArrayList<E>` | `add`, `get`, `set`, `remove`, `size`, `contains`, `indexOf`, `clear`, `isEmpty`, `toArray`, `iterator`, `sort`, `subList`, `addAll`, `removeAll`, `stream` | 0 | `@ohos.util.ArrayList` / TS Array | Mappable |
| `LinkedList<E>` | `add`, `addFirst`, `addLast`, `get`, `getFirst`, `getLast`, `remove`, `removeFirst`, `removeLast`, `size`, `poll`, `peek`, `offer` | 0 | `@ohos.util.LinkedList` | Mappable |
| `HashMap<K,V>` | `put`, `get`, `remove`, `containsKey`, `containsValue`, `size`, `keySet`, `values`, `entrySet`, `clear`, `isEmpty`, `putAll`, `getOrDefault`, `putIfAbsent`, `forEach`, `compute`, `merge` | 0 | `@ohos.util.HashMap` / TS Map | Mappable |
| `TreeMap<K,V>` | `put`, `get`, `remove`, `firstKey`, `lastKey`, `headMap`, `tailMap`, `subMap`, `navigableKeySet`, `descendingMap` | 0 | `@ohos.util.TreeMap` | Mappable |
| `HashSet<E>` | `add`, `remove`, `contains`, `size`, `clear`, `isEmpty`, `iterator` | 0 | `@ohos.util.HashSet` / TS Set | Mappable |
| `TreeSet<E>` | `add`, `remove`, `contains`, `first`, `last`, `headSet`, `tailSet`, `subSet`, `ceiling`, `floor` | 0 | `@ohos.util.TreeSet` | Mappable |
| `LinkedHashMap<K,V>` | Ordered HashMap | 0 | TS Map (ordered) | Mappable |
| `LinkedHashSet<E>` | Ordered HashSet | 0 | TS Set (ordered) | Mappable |
| `ArrayDeque<E>` | `push`, `pop`, `peek`, `offer`, `poll`, `addFirst`, `addLast`, `removeFirst`, `removeLast` | 0 | `@ohos.util.Deque` | Mappable |
| `PriorityQueue<E>` | `offer`, `poll`, `peek`, `add`, `remove`, `size` | 0 | `@ohos.util.Queue` | Mappable |
| `Vector<E>` | Legacy synchronized list | 0 | `@ohos.util.Vector` | Mappable |
| `Stack<E>` | `push`, `pop`, `peek`, `empty`, `search` | 0 | `@ohos.util.Stack` | Mappable |
| `Collections` | `sort`, `reverse`, `shuffle`, `binarySearch`, `min`, `max`, `unmodifiableList/Map/Set`, `synchronizedList/Map/Set`, `emptyList/Map/Set`, `singletonList`, `frequency`, `swap`, `fill`, `copy` | 0 | TS shim | Mappable |
| `Arrays` | `sort`, `binarySearch`, `copyOf`, `copyOfRange`, `fill`, `equals`, `deepEquals`, `asList`, `stream`, `toString`, `hashCode` | 0 | TS shim | Mappable |
| `Iterator<E>` | `hasNext`, `next`, `remove` | 0 | TS interface | Mappable |
| `ListIterator<E>` | `hasNext`, `next`, `hasPrevious`, `previous`, `nextIndex`, `previousIndex`, `set`, `add` | 0 | TS shim | Mappable |
| `Comparator<T>` | `compare`, `reversed`, `thenComparing`, `naturalOrder`, `reverseOrder`, `comparing` | 0 | TS interface | Mappable |
| `Optional<T>` | `of`, `ofNullable`, `empty`, `isPresent`, `isEmpty`, `get`, `orElse`, `orElseGet`, `orElseThrow`, `ifPresent`, `map`, `flatMap`, `filter`, `stream` | 0 | TS shim | Mappable |
| `Date` | `getTime`, `setTime`, `before`, `after`, `compareTo`, `toString` | 0 | TS Date | Mappable |
| `Calendar` | `getInstance`, `get`, `set`, `add`, `getTime`, `setTime`, `getTimeInMillis`, `setTimeInMillis`, `getTimeZone`, `clear`, `roll` | 0 | TS Date | Mappable |
| `GregorianCalendar` | extends Calendar | 0 | TS Date | Mappable |
| `TimeZone` | `getDefault`, `getTimeZone`, `getID`, `getDisplayName`, `getOffset`, `getRawOffset`, `getAvailableIDs` | 0 | `@ohos.i18n` | Mappable |
| `Locale` | `getDefault`, `getLanguage`, `getCountry`, `getDisplayName`, `toLanguageTag`, `forLanguageTag`, `getAvailableLocales` | 0 | `@ohos.i18n` | Mappable |
| `UUID` | `randomUUID`, `fromString`, `toString`, `getMostSignificantBits`, `getLeastSignificantBits` | 0 | TS shim | Mappable |
| `Random` | `nextInt`, `nextLong`, `nextFloat`, `nextDouble`, `nextBoolean`, `nextBytes`, `setSeed`, `nextGaussian` | 0 | TS Math.random | Mappable |
| `Timer` | `schedule`, `scheduleAtFixedRate`, `cancel`, `purge` | 0 | `@ohos.systemTimer` | Mappable |
| `TimerTask` | `run`, `cancel`, `scheduledExecutionTime` | 0 | TS shim | Mappable |
| `Scanner` | `next`, `nextInt`, `nextLine`, `hasNext`, `hasNextInt`, `useDelimiter`, `close` | 0 | TS shim | Mappable |
| `regex.Pattern` | `compile`, `matcher`, `matches`, `split`, `pattern`, `flags`, `quote` | 0 | TS RegExp | Mappable |
| `regex.Matcher` | `matches`, `find`, `group`, `start`, `end`, `replaceAll`, `replaceFirst`, `reset`, `lookingAt`, `groupCount` | 0 | TS RegExp | Mappable |
| `concurrent.ExecutorService` | `submit`, `execute`, `shutdown`, `shutdownNow`, `invokeAll`, `invokeAny`, `isShutdown`, `awaitTermination` | 0 | `@ohos.taskpool` | Partial |
| `concurrent.Executors` | `newFixedThreadPool`, `newSingleThreadExecutor`, `newCachedThreadPool`, `newScheduledThreadPool` | 0 | `@ohos.taskpool` | Partial |
| `concurrent.Future<V>` | `get`, `cancel`, `isDone`, `isCancelled` | 0 | Promise | Partial |
| `concurrent.CompletableFuture<T>` | `thenApply`, `thenAccept`, `thenRun`, `thenCompose`, `thenCombine`, `whenComplete`, `exceptionally`, `supplyAsync`, `runAsync`, `allOf`, `anyOf` | 0 | Promise | Partial |
| `concurrent.CountDownLatch` | `await`, `countDown`, `getCount` | 0 | TS shim | Mappable |
| `concurrent.Semaphore` | `acquire`, `release`, `tryAcquire`, `availablePermits` | 0 | TS shim | Mappable |
| `concurrent.ConcurrentHashMap<K,V>` | Thread-safe HashMap | 0 | TS Map (single-thread) | Partial |
| `concurrent.CopyOnWriteArrayList<E>` | Thread-safe ArrayList | 0 | TS Array | Partial |
| `concurrent.BlockingQueue<E>` | `put`, `take`, `offer`, `poll` | 0 | TS shim | Partial |
| `concurrent.atomic.AtomicInteger` | `get`, `set`, `getAndSet`, `compareAndSet`, `incrementAndGet`, `decrementAndGet`, `addAndGet` | 0 | TS shim (single-thread) | Partial |
| `concurrent.atomic.AtomicLong` | Same as AtomicInteger for longs | 0 | TS shim | Partial |
| `concurrent.atomic.AtomicBoolean` | `get`, `set`, `compareAndSet` | 0 | TS shim | Partial |
| `concurrent.atomic.AtomicReference<V>` | `get`, `set`, `compareAndSet` | 0 | TS shim | Partial |
| `concurrent.locks.ReentrantLock` | `lock`, `unlock`, `tryLock`, `isLocked`, `newCondition` | 0 | — | Not mappable |
| `concurrent.locks.ReadWriteLock` | `readLock`, `writeLock` | 0 | — | Not mappable |
| `stream.Stream<T>` | `filter`, `map`, `flatMap`, `reduce`, `collect`, `forEach`, `count`, `sorted`, `distinct`, `limit`, `skip`, `toArray`, `findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch` | 0 | TS Array methods | Partial |
| `function.Consumer<T>` | `accept`, `andThen` | 0 | TS function | Mappable |
| `function.Supplier<T>` | `get` | 0 | TS function | Mappable |
| `function.Function<T,R>` | `apply`, `andThen`, `compose`, `identity` | 0 | TS function | Mappable |
| `function.Predicate<T>` | `test`, `and`, `or`, `negate`, `isEqual` | 0 | TS function | Mappable |
| `function.BiFunction<T,U,R>` | `apply`, `andThen` | 0 | TS function | Mappable |
| `function.BiConsumer<T,U>` | `accept`, `andThen` | 0 | TS function | Mappable |
| `function.UnaryOperator<T>` | extends Function | 0 | TS function | Mappable |
| `function.BinaryOperator<T>` | extends BiFunction | 0 | TS function | Mappable |

### 2.3 java.io (~30 classes)

| Android Class | Key Methods | OH Mapping | Status |
|---------------|------------|------------|--------|
| `File` | `exists`, `isFile`, `isDirectory`, `getName`, `getPath`, `getAbsolutePath`, `getParent`, `length`, `lastModified`, `mkdir`, `mkdirs`, `delete`, `renameTo`, `list`, `listFiles`, `canRead`, `canWrite`, `createNewFile`, `createTempFile`, `toPath`, `toURI` | `@ohos.file.fs` | Mappable |
| `InputStream` | `read`, `read(byte[])`, `available`, `close`, `skip`, `mark`, `reset`, `markSupported` | `@ohos.file.fs` | Mappable |
| `OutputStream` | `write`, `write(byte[])`, `flush`, `close` | `@ohos.file.fs` | Mappable |
| `FileInputStream` | extends InputStream | `fs.openSync` + `fs.readSync` | Mappable |
| `FileOutputStream` | extends OutputStream | `fs.openSync` + `fs.writeSync` | Mappable |
| `BufferedInputStream` | Buffered reading | `@ohos.file.fs` | Mappable |
| `BufferedOutputStream` | Buffered writing | `@ohos.file.fs` | Mappable |
| `ByteArrayInputStream` | In-memory stream | TS shim (Uint8Array) | Mappable |
| `ByteArrayOutputStream` | In-memory stream | TS shim (Uint8Array) | Mappable |
| `DataInputStream` | `readInt`, `readLong`, `readFloat`, `readDouble`, `readUTF`, `readBoolean`, `readByte`, `readShort`, `readChar` | TS DataView | Mappable |
| `DataOutputStream` | `writeInt`, `writeLong`, `writeFloat`, `writeDouble`, `writeUTF`, `writeBoolean`, `writeByte`, `writeShort`, `writeChar` | TS DataView | Mappable |
| `ObjectInputStream` | `readObject`, `readInt`, `readUTF`, `close` | — | Not mappable |
| `ObjectOutputStream` | `writeObject`, `writeInt`, `writeUTF`, `flush`, `close` | — | Not mappable |
| `Reader` | `read`, `read(char[])`, `close`, `ready` | TS shim | Mappable |
| `Writer` | `write`, `write(String)`, `flush`, `close` | TS shim | Mappable |
| `BufferedReader` | `readLine`, `lines`, `read`, `close` | `fs.readLines` | Mappable |
| `BufferedWriter` | `write`, `newLine`, `flush`, `close` | `fs.writeSync` | Mappable |
| `InputStreamReader` | Reader wrapping InputStream | TS TextDecoder | Mappable |
| `OutputStreamWriter` | Writer wrapping OutputStream | TS TextEncoder | Mappable |
| `FileReader` | Reader for files | `@ohos.file.fs` | Mappable |
| `FileWriter` | Writer for files | `@ohos.file.fs` | Mappable |
| `PrintStream` | `print`, `println`, `printf`, `format`, `flush` | TS console | Mappable |
| `PrintWriter` | `print`, `println`, `printf`, `format`, `flush`, `close` | TS console | Mappable |
| `RandomAccessFile` | `seek`, `read`, `write`, `getFilePointer`, `length`, `close` | `fs.openSync` + seek | Mappable |
| `Serializable` | Marker interface | — | Not mappable |
| `Closeable` | `close` | TS interface | Mappable |
| `Flushable` | `flush` | TS interface | Mappable |

### 2.4 java.net (~15 classes)

| Android Class | Key Methods | OH Mapping | Status |
|---------------|------------|------------|--------|
| `URL` | `openConnection`, `openStream`, `getProtocol`, `getHost`, `getPort`, `getPath`, `getQuery`, `toURI` | `@ohos.net.http` | Mappable |
| `URI` | `create`, `getScheme`, `getHost`, `getPort`, `getPath`, `getQuery`, `getFragment`, `resolve`, `relativize`, `toURL` | `@ohos.uri` | Mappable |
| `HttpURLConnection` | `connect`, `disconnect`, `getResponseCode`, `getResponseMessage`, `getInputStream`, `getOutputStream`, `setRequestMethod`, `setRequestProperty`, `getHeaderField`, `setDoOutput`, `setConnectTimeout` | `@ohos.net.http` | Mappable |
| `HttpsURLConnection` | extends HttpURLConnection + SSL | `@ohos.net.http` + `networkSecurity` | Mappable |
| `Socket` | `connect`, `getInputStream`, `getOutputStream`, `close`, `isClosed`, `isConnected`, `setSoTimeout` | `@ohos.net.socket` | Mappable |
| `ServerSocket` | `accept`, `bind`, `close`, `setSoTimeout`, `getLocalPort` | `@ohos.net.socket` | Mappable |
| `DatagramSocket` | `send`, `receive`, `close`, `bind` | `@ohos.net.socket` (UDP) | Mappable |
| `DatagramPacket` | `getData`, `getLength`, `getAddress`, `getPort`, `setData` | `@ohos.net.socket` | Mappable |
| `InetAddress` | `getByName`, `getAllByName`, `getHostName`, `getHostAddress`, `getLocalHost`, `isReachable` | `@ohos.net.connection` | Mappable |
| `InetSocketAddress` | `getAddress`, `getPort`, `getHostName` | `@ohos.net.socket` | Mappable |
| `URLEncoder` | `encode` | TS encodeURIComponent | Mappable |
| `URLDecoder` | `decode` | TS decodeURIComponent | Mappable |
| `Proxy` | `type`, `address` | `@ohos.net.connection` | Partial |
| `CookieManager` | `getCookieStore`, `put`, `get` | TS shim | Mappable |

### 2.5 java.nio, java.math, java.text, java.security, javax.crypto (~30 classes)

| Android Class | OH Mapping | Status |
|---------------|------------|--------|
| `ByteBuffer` | TS ArrayBuffer / DataView | Mappable |
| `CharBuffer`, `ShortBuffer`, `IntBuffer`, `LongBuffer`, `FloatBuffer`, `DoubleBuffer` | TS TypedArrays | Mappable |
| `ByteOrder` | TS DataView endianness | Mappable |
| `Charset` / `StandardCharsets` | TS TextEncoder/TextDecoder | Mappable |
| `Path` (nio.file) | `@ohos.file.fs` | Mappable |
| `Files` (nio.file) | `@ohos.file.fs` | Mappable |
| `BigDecimal` | — (no native OH) | Not mappable (needs TS shim) |
| `BigInteger` | — (no native OH) | Not mappable (needs TS shim) |
| `SimpleDateFormat` | `@ohos.i18n` | Partial |
| `DateFormat` | `@ohos.i18n` | Partial |
| `NumberFormat` / `DecimalFormat` | `@ohos.i18n` | Partial |
| `MessageFormat` | TS template literals | Partial |
| `MessageDigest` | `@ohos.security.cryptoFramework` hash | Mappable |
| `SecureRandom` | `@ohos.security.cryptoFramework` | Mappable |
| `KeyStore` | `@ohos.security.huks` | Mappable |
| `Signature` | `@ohos.security.cryptoFramework` sign/verify | Mappable |
| `KeyPairGenerator` | `@ohos.security.cryptoFramework` | Mappable |
| `Cipher` (javax.crypto) | `@ohos.security.cryptoFramework` cipher | Mappable |
| `SecretKey` / `SecretKeySpec` | `@ohos.security.cryptoFramework` | Mappable |
| `KeyGenerator` | `@ohos.security.cryptoFramework` | Mappable |
| `Mac` | `@ohos.security.cryptoFramework` HMAC | Mappable |
| `SSLContext` / `SSLSocket` | `@ohos.net.networkSecurity` | Partial |

---

## 3. Full Android API Surface — Android Framework

### 3.1 android.app (~25 classes)

| Android Class | Key Methods | OH Equivalent | Status |
|---------------|------------|---------------|--------|
| **`Activity`** | `onCreate`, `onStart`, `onResume`, `onPause`, `onStop`, `onDestroy`, `setContentView`, `findViewById`, `finish`, `startActivity`, `startActivityForResult`, `onActivityResult`, `getIntent`, `setResult`, `onBackPressed`, `onCreateOptionsMenu`, `onOptionsItemSelected`, `recreate`, `isFinishing`, `getWindow`, `getFragmentManager`, `runOnUiThread` | `UIAbility` | **Implemented (partial)** |
| `Service` | `onCreate`, `onStartCommand`, `onBind`, `onUnbind`, `onDestroy`, `stopSelf`, `startForeground` | `ServiceExtensionAbility` | Mappable |
| `IntentService` | `onHandleIntent` (deprecated) | `ServiceExtensionAbility` | Mappable |
| `Fragment` | `onCreate`, `onCreateView`, `onViewCreated`, `onResume`, `onPause`, `onDestroyView`, `onDestroy`, `getActivity`, `getArguments`, `setArguments`, `getView`, `findViewByid`, `getChildFragmentManager` | `@Component` struct | Partial |
| `Application` | `onCreate`, `onTerminate`, `onConfigurationChanged`, `onLowMemory`, `onTrimMemory`, `registerActivityLifecycleCallbacks` | `AbilityStage` | Mappable |
| `Dialog` | `show`, `dismiss`, `cancel`, `setContentView`, `setCancelable`, `setTitle`, `isShowing`, `setOnDismissListener` | `CustomDialogController` | Mappable |
| `AlertDialog` | `Builder.setTitle`, `.setMessage`, `.setPositiveButton`, `.setNegativeButton`, `.setNeutralButton`, `.setItems`, `.setSingleChoiceItems`, `.setMultiChoiceItems`, `.setView`, `.create`, `.show`, `.setCancelable` | `AlertDialog` component | Mappable |
| `ProgressDialog` | `setMessage`, `setProgressStyle`, `setMax`, `setProgress`, `show` (deprecated) | `Progress` + `Dialog` | Partial |
| `Notification` | `Builder.setContentTitle`, `.setContentText`, `.setSmallIcon`, `.setLargeIcon`, `.setPriority`, `.setAutoCancel`, `.setContentIntent`, `.addAction`, `.setStyle`, `.setGroup`, `.setOngoing`, `.setSound`, `.setVibrate`, `.build` | `@ohos.notificationManager` | Mappable |
| `NotificationManager` | `notify`, `cancel`, `cancelAll`, `createNotificationChannel`, `getNotificationChannel` | `@ohos.notificationManager` | Mappable |
| `NotificationChannel` | `getId`, `getName`, `getImportance`, `setDescription`, `enableVibration`, `setVibrationPattern`, `setSound`, `enableLights`, `setLightColor`, `setLockscreenVisibility` | `@ohos.notificationManager` slot | Partial |
| `PendingIntent` | `getActivity`, `getService`, `getBroadcast`, `send`, `cancel` | `WantAgent` | Mappable |
| `AlarmManager` | `set`, `setExact`, `setRepeating`, `setInexactRepeating`, `cancel`, `setAlarmClock` | `@ohos.systemTimer` / `reminderAgentManager` | Mappable |
| `DownloadManager` | `enqueue`, `remove`, `query`, `getUriForDownloadedFile` | `@ohos.request` agent | Mappable |
| `ActivityManager` | `getRunningAppProcesses`, `getMemoryInfo`, `isLowRamDevice`, `getAppTasks`, `moveTaskToFront` | `@ohos.app.ability.appManager` | Partial |
| `SearchManager` | `startSearch`, `triggerSearch` | — | Not mappable |
| `WallpaperManager` | `setBitmap`, `setStream`, `getDrawable`, `getCropAndSetWallpaper` | `@ohos.wallpaper` | Mappable |
| `KeyguardManager` | `isKeyguardLocked`, `isDeviceLocked`, `requestDismissKeyguard` | `@ohos.screenLock` | Partial |
| `UiModeManager` | `getCurrentModeType`, `getNightMode`, `setNightMode` | `@ohos.app.ability.Configuration` | Partial |
| `JobScheduler` | `schedule`, `cancel`, `cancelAll`, `getAllPendingJobs` | `@ohos.backgroundTaskManager` | Partial |
| `TaskStackBuilder` | `addNextIntent`, `addNextIntentWithParentStack`, `startActivities`, `getPendingIntent` | `@ohos.router` + `Want` | Partial |

### 3.2 android.content (~30 classes)

| Android Class | Key Methods | OH Equivalent | Status |
|---------------|------------|---------------|--------|
| **`Context`** | `getApplicationContext`, `getSystemService`, `getResources`, `getAssets`, `getPackageName`, `getPackageManager`, `getContentResolver`, `getSharedPreferences`, `getFilesDir`, `getCacheDir`, `getExternalFilesDir`, `getDatabasePath`, `startActivity`, `startService`, `sendBroadcast`, `registerReceiver`, `unregisterReceiver`, `bindService`, `unbindService`, `checkSelfPermission`, `getClassLoader`, `getContentResolver`, `getString`, `getColor`, `getDrawable`, `obtainStyledAttributes` | `UIAbilityContext` | **Implemented (stub)** |
| **`ContextWrapper`** | `getBaseContext`, `attachBaseContext` | `UIAbilityContext` | **Implemented** |
| `Intent` | `setAction`, `setData`, `setType`, `setComponent`, `setClass`, `putExtra`(×15 overloads), `getStringExtra`, `getIntExtra`, `getBooleanExtra`, `getParcelableExtra`, `getSerializableExtra`, `getBundleExtra`, `getExtras`, `getAction`, `getData`, `getComponent`, `addCategory`, `addFlags`, `hasExtra`, `resolveActivity`, `createChooser`, `setFlags`, `FLAG_ACTIVITY_NEW_TASK`, `FLAG_ACTIVITY_CLEAR_TOP`, `ACTION_VIEW`, `ACTION_SEND`, `ACTION_PICK` | `Want` | Mappable |
| `IntentFilter` | `addAction`, `addCategory`, `addDataScheme`, `addDataType`, `match` | `skills` in `module.json5` | Partial |
| `BroadcastReceiver` | `onReceive`, `goAsync`, `abortBroadcast`, `getResultCode`, `setResultCode`, `getResultData` | `commonEventManager.subscribe` | Mappable |
| `ContentProvider` | `onCreate`, `query`, `insert`, `update`, `delete`, `getType`, `openFile` | `DataShareExtensionAbility` | Mappable |
| `ContentResolver` | `query`, `insert`, `update`, `delete`, `openInputStream`, `openOutputStream`, `registerContentObserver`, `unregisterContentObserver`, `notifyChange` | `@ohos.data.dataShare` | Mappable |
| `ContentValues` | `put`, `get`, `getAsString`, `getAsInteger`, `getAsLong`, `containsKey`, `remove`, `clear`, `size`, `keySet`, `valueSet` | `ValuesBucket` | Mappable |
| `SharedPreferences` | `getString`, `getInt`, `getLong`, `getFloat`, `getBoolean`, `getStringSet`, `contains`, `getAll`, `edit`, `registerOnSharedPreferenceChangeListener` | `@ohos.data.preferences` | Mappable |
| `SharedPreferences.Editor` | `putString`, `putInt`, `putLong`, `putFloat`, `putBoolean`, `putStringSet`, `remove`, `clear`, `apply`, `commit` | `@ohos.data.preferences` | Mappable |
| `ClipboardManager` | `setPrimaryClip`, `getPrimaryClip`, `hasPrimaryClip`, `addPrimaryClipChangedListener` | `@ohos.pasteboard` | Mappable |
| `ClipData` | `newPlainText`, `newUri`, `newIntent`, `getItemAt`, `getItemCount`, `getDescription` | `@ohos.pasteboard` | Mappable |
| `ComponentName` | `getClassName`, `getPackageName`, `flattenToString`, `unflattenFromString` | Want `abilityName`/`bundleName` | Mappable |
| `ServiceConnection` | `onServiceConnected`, `onServiceDisconnected` | Ability connection callback | Mappable |
| `pm.PackageManager` | `getPackageInfo`, `getApplicationInfo`, `getInstalledPackages`, `getInstalledApplications`, `queryIntentActivities`, `resolveActivity`, `getComponentEnabledSetting`, `hasSystemFeature`, `checkPermission`, `getPermissionInfo` | `@ohos.bundle.bundleManager` | Mappable |
| `pm.PackageInfo` | `packageName`, `versionName`, `versionCode`, `firstInstallTime`, `lastUpdateTime`, `permissions`, `activities`, `services`, `providers`, `receivers` | `BundleInfo` | Mappable |
| `pm.ApplicationInfo` | `packageName`, `sourceDir`, `dataDir`, `uid`, `targetSdkVersion`, `flags`, `loadLabel`, `loadIcon` | `ApplicationInfo` | Mappable |
| `res.Resources` | `getString`, `getText`, `getColor`, `getDrawable`, `getDimension`, `getInteger`, `getBoolean`, `getStringArray`, `getIntArray`, `getIdentifier`, `getConfiguration`, `getDisplayMetrics`, `obtainTypedArray` | `@ohos.resourceManager` | Partial |
| `res.AssetManager` | `open`, `list`, `openFd`, `getLocales` | `resourceManager.getRawFd` | Partial |
| `res.Configuration` | `orientation`, `screenWidthDp`, `screenHeightDp`, `locale`, `uiMode`, `fontScale`, `densityDpi`, `keyboard`, `navigation` | `@ohos.app.ability.Configuration` | Mappable |
| `res.TypedArray` | `getString`, `getInt`, `getFloat`, `getColor`, `getDimension`, `getDrawable`, `getBoolean`, `getResourceId`, `recycle` | `@ohos.resourceManager` | Partial |
| `res.ColorStateList` | `valueOf`, `getDefaultColor`, `getColorForState` | ArkUI color resource | Partial |

### 3.3 android.os (~25 classes)

| Android Class | Key Methods | OH Equivalent | Status |
|---------------|------------|---------------|--------|
| **`Bundle`** | `putString`, `getString`, `putInt`, `getInt`, `putLong`, `getLong`, `putFloat`, `getFloat`, `putDouble`, `getDouble`, `putBoolean`, `getBoolean`, `putParcelable`, `getParcelable`, `putSerializable`, `getSerializable`, `putStringArrayList`, `getStringArrayList`, `putBundle`, `getBundle`, `containsKey`, `remove`, `clear`, `size`, `keySet`, `isEmpty` | Want.parameters + TS Map | **Implemented (4 methods)** |
| `Handler` | `post`, `postDelayed`, `postAtTime`, `sendMessage`, `sendMessageDelayed`, `sendEmptyMessage`, `removeCallbacks`, `removeMessages`, `obtainMessage`, `getLooper`, `handleMessage` | `setTimeout`/`setInterval` + `@ohos.events.emitter` | Partial |
| `Looper` | `prepare`, `loop`, `myLooper`, `getMainLooper`, `quit`, `quitSafely`, `getThread` | — (single event loop) | Partial |
| `Message` | `obtain`, `what`, `arg1`, `arg2`, `obj`, `getData`, `setData`, `sendToTarget`, `recycle` | `@ohos.events.emitter` event | Partial |
| `AsyncTask<P,Pr,R>` | `execute`, `doInBackground`, `onPreExecute`, `onPostExecute`, `onProgressUpdate`, `publishProgress`, `cancel`, `isCancelled` (deprecated) | `@ohos.taskpool` | Partial |
| `Parcel` | `writeInt`, `readInt`, `writeString`, `readString`, `writeParcelable`, `readParcelable`, `obtain`, `recycle`, `dataSize`, `dataPosition` | `@ohos.rpc` MessageSequence | Partial |
| `Parcelable` | `writeToParcel`, `describeContents`, `CREATOR` | `@ohos.rpc` Sequenceable | Partial |
| `Build` | `MODEL`, `MANUFACTURER`, `BRAND`, `DEVICE`, `PRODUCT`, `HARDWARE`, `BOARD`, `DISPLAY`, `FINGERPRINT`, `SERIAL` | `@ohos.deviceInfo` | Partial |
| `Build.VERSION` | `SDK_INT`, `RELEASE`, `CODENAME`, `BASE_OS`, `SECURITY_PATCH` | `@ohos.deviceInfo` | Partial |
| `Environment` | `getExternalStorageDirectory`, `getExternalStorageState`, `getDataDirectory`, `getDownloadCacheDirectory`, `getRootDirectory`, `isExternalStorageEmulated`, `isExternalStorageRemovable` | `context.filesDir`, `context.cacheDir`, `@ohos.file.environment` | Partial |
| `PowerManager` | `newWakeLock`, `isInteractive`, `isPowerSaveMode`, `reboot` | `@ohos.power` | Mappable |
| `PowerManager.WakeLock` | `acquire`, `release`, `isHeld` | `@ohos.runningLock` | Mappable |
| `Vibrator` | `vibrate`, `cancel`, `hasVibrator`, `hasAmplitudeControl` | `@ohos.vibrator` | Mappable |
| `VibrationEffect` | `createOneShot`, `createWaveform`, `createPredefined` | `@ohos.vibrator` | Mappable |
| `BatteryManager` | `getIntProperty`, `isCharging`, `BATTERY_PROPERTY_CAPACITY`, `BATTERY_PROPERTY_CHARGE_COUNTER`, `BATTERY_STATUS_CHARGING` | `@ohos.batteryInfo` | Mappable |
| `SystemClock` | `elapsedRealtime`, `uptimeMillis`, `currentThreadTimeMillis`, `sleep` | `Date.now()` / `@ohos.systemTimer` | Partial |
| `CountDownTimer` | `start`, `cancel`, `onTick`, `onFinish` | `setInterval` + `clearInterval` | Mappable |
| `HandlerThread` | `start`, `getLooper`, `quit`, `quitSafely` | `@ohos.worker` | Partial |
| `Binder` / `IBinder` | `transact`, `onTransact`, `linkToDeath`, `unlinkToDeath`, `isBinderAlive`, `queryLocalInterface` | `@ohos.rpc` | Partial |
| `Process` | `myPid`, `myUid`, `killProcess`, `sendSignal`, `setThreadPriority` | `@ohos.process` | Partial |
| `StatFs` | `getBlockSize`, `getBlockCount`, `getAvailableBlocks`, `getFreeBytes`, `getTotalBytes` | `@ohos.file.statvfs` | Mappable |
| `StrictMode` | `setThreadPolicy`, `setVmPolicy`, `noteSlowCall` | — | Not mappable |
| `UserManager` | `isUserAGoat`, `getUserName`, `getSerialNumberForUser`, `isUserUnlocked` | `@ohos.account.osAccount` | Partial |
| `Debug` | `isDebuggerConnected`, `waitForDebugger`, `getNativeHeapSize`, `startMethodTracing` | — | Not mappable |
| `MemoryFile` | `readBytes`, `writeBytes`, `close`, `length` | `@ohos.file.fs` | Partial |

### 3.4 android.view (~40 classes)

| Android Class | Key Methods | OH Equivalent | Status |
|---------------|------------|---------------|--------|
| **`View`** | `setId`/`getId`, `setVisibility`/`getVisibility`, `setOnClickListener`, `setOnLongClickListener`, `setOnTouchListener`, `setOnFocusChangeListener`, `performClick`, `getContext`, `getParent`, `getWidth`/`getHeight`, `getX`/`getY`, `setX`/`setY`, `setAlpha`, `setRotation`, `setScaleX`/`setScaleY`, `setTranslationX`/`setTranslationY`, `setElevation`, `setPadding`, `setBackgroundColor`, `setBackground`, `setLayoutParams`, `requestLayout`, `invalidate`, `post`, `postDelayed`, `requestFocus`, `clearFocus`, `isFocused`, `isEnabled`, `setEnabled`, `setClickable`, `setTag`/`getTag`, `animate`, `measure`, `onDraw`, `onMeasure`, `onLayout`, `onSizeChanged`, `onTouchEvent`, `onKeyDown`, `onKeyUp`, `setContentDescription`, `bringToFront`, `hasFocus`, `getDrawableState` | ArkUI component base | **Implemented (8 methods)** |
| **`ViewGroup`** | `addView`, `removeView`, `removeViewAt`, `removeAllViews`, `getChildCount`, `getChildAt`, `indexOfChild`, `setClipChildren`, `setClipToPadding`, `setLayoutAnimation`, `requestChildFocus`, `onInterceptTouchEvent` | ArkUI container | **Implemented (3 methods)** |
| `LayoutInflater` | `inflate`, `from`, `setFactory`, `setFactory2` | — (no XML inflation) | Not mappable |
| `Window` | `getDecorView`, `setFlags`, `addFlags`, `clearFlags`, `setStatusBarColor`, `setNavigationBarColor`, `setBackgroundDrawable`, `setSoftInputMode`, `requestFeature`, `setFormat`, `setContentView`, `findViewById` | `@ohos.window` | Partial |
| `WindowManager` | `getDefaultDisplay`, `addView`, `removeView`, `updateViewLayout` | `@ohos.window` | Partial |
| `Display` | `getSize`, `getRealSize`, `getWidth`, `getHeight`, `getRefreshRate`, `getRotation`, `getMetrics`, `getRealMetrics` | `@ohos.display` | Mappable |
| `SurfaceView` | `getHolder`, `setZOrderOnTop`, `setZOrderMediaOverlay` | `XComponent` | Partial |
| `SurfaceHolder` | `addCallback`, `lockCanvas`, `unlockCanvasAndPost`, `setFormat`, `setFixedSize` | `XComponent` | Partial |
| `TextureView` | `getSurfaceTexture`, `setSurfaceTextureListener`, `lockCanvas`, `unlockCanvasAndPost`, `getBitmap` | `XComponent` | Partial |
| `Menu` | `add`, `findItem`, `removeItem`, `clear`, `size`, `getItem`, `setGroupVisible` | `Menu` component | Partial |
| `MenuItem` | `setTitle`, `setIcon`, `setEnabled`, `setVisible`, `setShowAsAction`, `setOnMenuItemClickListener`, `getItemId`, `getTitle` | `Menu` item | Partial |
| `ContextMenu` | `setHeaderTitle`, `add`, `clear` | `Menu` component | Partial |
| `MotionEvent` | `getAction`, `getX`, `getY`, `getRawX`, `getRawY`, `getPointerCount`, `getPointerId`, `getActionMasked`, `getActionIndex`, `getPressure`, `getHistorySize`, `getHistoricalX`, `getHistoricalY`, `getDownTime`, `getEventTime` | `TouchEvent` / `.onTouch()` | Partial |
| `KeyEvent` | `getAction`, `getKeyCode`, `getRepeatCount`, `getMetaState`, `isShiftPressed`, `isCtrlPressed`, `getUnicodeChar`, `KEYCODE_BACK`, `KEYCODE_HOME`, `KEYCODE_MENU`, `ACTION_DOWN`, `ACTION_UP` | `KeyEvent` / `@ohos.multimodalInput` | Partial |
| `DragEvent` | `getAction`, `getX`, `getY`, `getClipData`, `getClipDescription`, `getLocalState` | `.onDragStart()` / `dragController` | Partial |
| `GestureDetector` | `onDown`, `onShowPress`, `onSingleTapUp`, `onScroll`, `onLongPress`, `onFling`, `onDoubleTap`, `onSingleTapConfirmed` | `Gesture` modifiers (`.gesture()`) | Partial |
| `ScaleGestureDetector` | `onScale`, `onScaleBegin`, `onScaleEnd`, `getScaleFactor`, `getFocusX`, `getFocusY` | `PinchGesture` | Partial |
| `ViewTreeObserver` | `addOnGlobalLayoutListener`, `addOnPreDrawListener`, `addOnScrollChangedListener`, `removeOnGlobalLayoutListener` | `@ohos.arkui.observer` | Partial |
| `ViewConfiguration` | `getScaledTouchSlop`, `getScaledMinimumFlingVelocity`, `getScaledMaximumFlingVelocity`, `getLongPressTimeout`, `getTapTimeout` | — | Not mappable |
| `ViewStub` | `inflate`, `setInflatedId`, `setLayoutResource` | `if/else` in `build()` | Partial |
| `ViewPropertyAnimator` | `alpha`, `translationX/Y/Z`, `scaleX/Y`, `rotation`, `x/y`, `setDuration`, `setInterpolator`, `setStartDelay`, `setListener`, `start`, `cancel`, `withEndAction`, `withStartAction` | `.animation()` modifier | Partial |
| `Gravity` | `CENTER`, `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `START`, `END`, `FILL`, `CENTER_HORIZONTAL`, `CENTER_VERTICAL`, `CLIP_HORIZONTAL`, `CLIP_VERTICAL`, `NO_GRAVITY` | `HorizontalAlign`, `VerticalAlign`, `Alignment` | Mappable |
| `animation.Animation` | `setDuration`, `setRepeatCount`, `setRepeatMode`, `setInterpolator`, `setFillAfter`, `setFillBefore`, `setStartOffset`, `setAnimationListener`, `start`, `cancel`, `reset` | `.animation()` modifier | Partial |
| `animation.AlphaAnimation` | `fromAlpha`, `toAlpha` | `.opacity()` + `.animation()` | Partial |
| `animation.TranslateAnimation` | `fromXDelta`, `toXDelta`, `fromYDelta`, `toYDelta` | `.translate()` + `.animation()` | Partial |
| `animation.RotateAnimation` | `fromDegrees`, `toDegrees`, `pivotX`, `pivotY` | `.rotate()` + `.animation()` | Partial |
| `animation.ScaleAnimation` | `fromX`, `toX`, `fromY`, `toY`, `pivotX`, `pivotY` | `.scale()` + `.animation()` | Partial |
| `animation.AnimationSet` | `addAnimation`, `setDuration` | AnimatorProperty chain | Partial |
| `animation.AnimationUtils` | `loadAnimation`, `currentAnimationTimeMillis` | — | Not mappable |
| `inputmethod.InputMethodManager` | `showSoftInput`, `hideSoftInputFromWindow`, `toggleSoftInput`, `isAcceptingText`, `restartInput` | `@ohos.inputMethod` | Mappable |
| `accessibility.AccessibilityEvent` | `getEventType`, `getText`, `getClassName`, `getContentDescription` | `@ohos.accessibility` | Partial |
| `ActionMode` | `setTitle`, `setSubtitle`, `getMenu`, `finish`, `invalidate` | — | Not mappable |

### 3.5 android.widget (~50 classes)

| Android Class | Key Methods | OH Equivalent | Status |
|---------------|------------|---------------|--------|
| **`TextView`** | `setText`, `getText`, `setTextColor`, `setTextSize`, `setTypeface`, `setGravity`, `setLines`, `setMaxLines`, `setMinLines`, `setSingleLine`, `setEllipsize`, `setHint`, `setHintTextColor`, `setCompoundDrawables`, `setCompoundDrawablesWithIntrinsicBounds`, `setPaintFlags`, `setTextIsSelectable`, `setAutoLinkMask`, `setMovementMethod`, `setLinkTextColor`, `addTextChangedListener`, `removeTextChangedListener`, `getLineCount`, `getTextSize`, `getCurrentTextColor`, `getLayout`, `setInputType`, `setImeOptions`, `setMaxLength`, `append`, `setTextAlignment`, `setLetterSpacing`, `setLineSpacing` | `Text` | **Implemented (5 methods)** |
| `EditText` | `getText` (Editable), `setSelection`, `getSelectionStart`, `getSelectionEnd`, `selectAll`, `setInputType`, `setHint`, `setMaxLength`, `addTextChangedListener`, `setImeOptions`, `setRawInputType`, `setTransformationMethod`, `setFilters` | `TextInput` / `TextArea` | Mappable |
| `AutoCompleteTextView` | `setAdapter`, `setThreshold`, `showDropDown`, `dismissDropDown`, `setOnItemClickListener`, `setCompletionHint` | `TextInput` + `Select` | Partial |
| **`Button`** | inherits TextView | `Button` | **Implemented (1 method)** |
| `ImageButton` | `setImageResource`, `setImageDrawable`, `setImageBitmap`, `setImageURI`, `setColorFilter`, `clearColorFilter` | `Button` + `Image` | Mappable |
| `ImageView` | `setImageResource`, `setImageDrawable`, `setImageBitmap`, `setImageURI`, `setScaleType`, `getDrawable`, `setColorFilter`, `clearColorFilter`, `setAdjustViewBounds`, `setMaxWidth`, `setMaxHeight`, `setImageAlpha`, `setCropToPadding` | `Image` | Mappable |
| `CheckBox` | `isChecked`, `setChecked`, `toggle`, `setOnCheckedChangeListener` | `Checkbox` | Mappable |
| `RadioButton` | `isChecked`, `setChecked`, `toggle` | `Radio` | Mappable |
| `RadioGroup` | `check`, `getCheckedRadioButtonId`, `clearCheck`, `setOnCheckedChangeListener` | `Radio` group | Mappable |
| `ToggleButton` | `isChecked`, `setChecked`, `setTextOn`, `setTextOff`, `setOnCheckedChangeListener` | `Toggle` (button style) | Mappable |
| `Switch` | `isChecked`, `setChecked`, `setTextOn`, `setTextOff`, `setTrackDrawable`, `setThumbDrawable`, `setOnCheckedChangeListener` | `Toggle` (switch style) | Mappable |
| `CompoundButton` | `isChecked`, `setChecked`, `toggle`, `setOnCheckedChangeListener`, `setButtonDrawable` | Base for Checkbox/Radio/Toggle | Mappable |
| `ProgressBar` | `setProgress`, `getProgress`, `setMax`, `getMax`, `setIndeterminate`, `isIndeterminate`, `setProgressDrawable`, `incrementProgressBy`, `setSecondaryProgress` | `Progress` | Mappable |
| `SeekBar` | `setProgress`, `getProgress`, `setMax`, `setMin`, `setOnSeekBarChangeListener` | `Slider` | Mappable |
| `RatingBar` | `setRating`, `getRating`, `setNumStars`, `setIsIndicator`, `setStepSize`, `setOnRatingBarChangeListener` | `Rating` | Mappable |
| `Spinner` | `setAdapter`, `setSelection`, `getSelectedItem`, `getSelectedItemPosition`, `setOnItemSelectedListener`, `setPrompt`, `setDropDownWidth` | `Select` | Mappable |
| `DatePicker` | `init`, `getYear`, `getMonth`, `getDayOfMonth`, `updateDate`, `setMinDate`, `setMaxDate`, `setOnDateChangedListener` | `DatePicker` | Mappable |
| `TimePicker` | `setHour`, `getHour`, `setMinute`, `getMinute`, `setIs24HourView`, `setOnTimeChangedListener` | `TimePicker` | Mappable |
| `NumberPicker` | `setMinValue`, `setMaxValue`, `setValue`, `getValue`, `setDisplayedValues`, `setOnValueChangedListener`, `setWrapSelectorWheel` | `Counter` / `TextPicker` | Partial |
| `CalendarView` | `setDate`, `getDate`, `setMinDate`, `setMaxDate`, `setOnDateChangeListener` | `CalendarPicker` | Mappable |
| `Chronometer` | `start`, `stop`, `setBase`, `getBase`, `setFormat`, `setOnChronometerTickListener` | `TextTimer` | Partial |
| `TextClock` | `setFormat12Hour`, `setFormat24Hour`, `getTimeZone`, `setTimeZone` | `TextClock` | Mappable |
| **`LinearLayout`** | `setOrientation`, `getOrientation`, `setGravity`, `setWeightSum`, `setShowDividers`, `setDividerDrawable`, `setHorizontalGravity`, `setVerticalGravity` | `Column` / `Row` | **Implemented (3 methods)** |
| `RelativeLayout` | Layout via `LayoutParams` rules: `ABOVE`, `BELOW`, `LEFT_OF`, `RIGHT_OF`, `ALIGN_PARENT_*`, `CENTER_IN_PARENT`, `CENTER_HORIZONTAL`, `CENTER_VERTICAL` | `RelativeContainer` | Partial |
| `FrameLayout` | `setForegroundGravity`, `setMeasureAllChildren` | `Stack` | Mappable |
| `GridLayout` | `setColumnCount`, `setRowCount`, `setOrientation`, `setAlignmentMode`, `setUseDefaultMargins` | `Grid` | Mappable |
| `TableLayout` | `setColumnStretchable`, `setColumnShrinkable`, `setColumnCollapsed`, `addView(TableRow)` | `Grid` (fixed columns) | Partial |
| `TableRow` | `addView`, `setGravity` | `GridItem` | Partial |
| `ScrollView` | `scrollTo`, `scrollBy`, `smoothScrollTo`, `smoothScrollBy`, `fullScroll`, `isSmoothScrollingEnabled`, `setFillViewport` | `Scroll` | Mappable |
| `HorizontalScrollView` | Same as ScrollView (horizontal) | `Scroll` (horizontal) | Mappable |
| `ListView` | `setAdapter`, `setOnItemClickListener`, `setOnItemLongClickListener`, `smoothScrollToPosition`, `setSelection`, `getCheckedItemPositions`, `setChoiceMode`, `setDivider`, `setDividerHeight`, `addHeaderView`, `addFooterView`, `setEmptyView` | `List` + `ListItem` | Mappable |
| `GridView` | `setAdapter`, `setNumColumns`, `setColumnWidth`, `setHorizontalSpacing`, `setVerticalSpacing`, `setStretchMode`, `setGravity`, `setOnItemClickListener` | `Grid` + `GridItem` | Mappable |
| `ExpandableListView` | `setAdapter`, `expandGroup`, `collapseGroup`, `isGroupExpanded`, `setOnGroupClickListener`, `setOnChildClickListener` | `List` + nested `ListItem` | Partial |
| `Toolbar` | `setTitle`, `setSubtitle`, `setNavigationIcon`, `setNavigationOnClickListener`, `inflateMenu`, `setOnMenuItemClickListener`, `setLogo`, `getMenu` | `Navigation` title bar / `Toolbar` | Mappable |
| `SearchView` | `setQuery`, `setIconified`, `setOnQueryTextListener`, `setSubmitButtonEnabled`, `setSuggestionsAdapter`, `setQueryHint`, `isIconified`, `clearFocus` | `Search` | Mappable |
| `VideoView` | `setVideoURI`, `setVideoPath`, `start`, `pause`, `resume`, `stopPlayback`, `seekTo`, `getDuration`, `getCurrentPosition`, `isPlaying`, `setMediaController`, `setOnPreparedListener`, `setOnCompletionListener`, `setOnErrorListener` | `Video` component | Mappable |
| `WebView` | `loadUrl`, `loadData`, `loadDataWithBaseURL`, `postUrl`, `goBack`, `goForward`, `canGoBack`, `canGoForward`, `reload`, `stopLoading`, `evaluateJavascript`, `addJavascriptInterface`, `getSettings`, `setWebViewClient`, `setWebChromeClient`, `clearCache`, `clearHistory`, `getUrl`, `getTitle`, `getProgress` | `Web` component | Mappable |
| `Toast` | `makeText`, `show`, `cancel`, `setGravity`, `setDuration`, `setView`, `setText`, `LENGTH_SHORT`, `LENGTH_LONG` | `promptAction.showToast()` | Mappable |
| `PopupWindow` | `showAtLocation`, `showAsDropDown`, `dismiss`, `isShowing`, `setContentView`, `setWidth`, `setHeight`, `setFocusable`, `setOutsideTouchable`, `setBackgroundDrawable`, `setOnDismissListener`, `setAnimationStyle`, `update` | `Popup` component | Mappable |
| `PopupMenu` | `inflate`, `show`, `dismiss`, `setOnMenuItemClickListener`, `getMenu`, `getMenuInflater` | `Menu` component | Partial |
| `ArrayAdapter<T>` | `add`, `addAll`, `insert`, `remove`, `clear`, `getItem`, `getPosition`, `getCount`, `getView`, `sort`, `setNotifyOnChange`, `notifyDataSetChanged` | `ForEach` / `LazyForEach` | Partial |
| `BaseAdapter` | `getCount`, `getItem`, `getItemId`, `getView`, `notifyDataSetChanged` | `LazyForEach` data source | Partial |
| `CursorAdapter` | `changeCursor`, `swapCursor`, `newView`, `bindView` | `LazyForEach` + `ResultSet` | Partial |
| `SimpleCursorAdapter` | Maps cursor columns to view fields | `LazyForEach` + `ResultSet` | Partial |
| `SimpleAdapter` | Maps Map data to views | `ForEach` | Partial |
| `AdapterView<T>` | `setOnItemClickListener`, `setOnItemLongClickListener`, `setOnItemSelectedListener`, `getSelectedItem`, `getSelectedItemPosition`, `getAdapter`, `setAdapter`, `setSelection`, `setEmptyView`, `getCount`, `getItemAtPosition` | Container component events | Partial |
| `ViewFlipper` | `startFlipping`, `stopFlipping`, `setFlipInterval`, `setAutoStart` | `Swiper` | Partial |
| `RemoteViews` | `setTextViewText`, `setImageViewResource`, `setOnClickPendingIntent`, `setViewVisibility` | `@ohos.app.form` FormBindingData | Partial |
| `Space` | Empty spacing view | `Blank` | Mappable |

### 3.6 android.graphics (~40 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `Canvas` | `Canvas` + `CanvasRenderingContext2D` / `@ohos.graphics.drawing` | Partial (HTML5-style vs Android-style) |
| `Paint` | Canvas context properties / `@ohos.graphics.drawing` Pen/Brush | Partial |
| `Bitmap` | `image.PixelMap` | Partial |
| `BitmapFactory` | `image.createImageSource` + `createPixelMap` | Partial |
| `BitmapRegionDecoder` | `image.ImageSource` region decode | Partial |
| `Color` | `Color` / hex values | Mappable |
| `Rect` / `RectF` | `common2D.Rect` | Mappable |
| `Point` / `PointF` | `common2D.Point` | Mappable |
| `Matrix` | `Matrix4` | Partial |
| `Path` | `Path2D` / `@ohos.graphics.drawing` Path | Partial |
| `Typeface` | Font resource / `fontFamily` | Partial |
| `PorterDuff` / `PorterDuffXfermode` | Canvas `globalCompositeOperation` | Partial |
| `Shader` / `LinearGradient` / `RadialGradient` | Canvas gradient API | Partial |
| `ColorFilter` / `ColorMatrix` | Canvas filter / `@ohos.graphics.uiEffect` | Partial |
| `PathEffect` / `CornerPathEffect` / `DashPathEffect` | Canvas `setLineDash` | Partial |
| `PixelFormat` / `ImageFormat` | `image` module formats | Partial |
| `SurfaceTexture` | `XComponent` surface | Partial |
| `drawable.Drawable` | Resource reference `$r(...)` | Partial |
| `drawable.BitmapDrawable` | `Image` component | Mappable |
| `drawable.ColorDrawable` | `.backgroundColor()` | Mappable |
| `drawable.GradientDrawable` | `.linearGradient()` / `.radialGradient()` | Partial |
| `drawable.ShapeDrawable` | Shape components (`Circle`, `Rect`, etc.) | Partial |
| `drawable.LayerDrawable` | `Stack` with multiple children | Partial |
| `drawable.StateListDrawable` | `stateStyles` | Partial |
| `drawable.AnimationDrawable` | `ImageAnimator` | Partial |
| `drawable.VectorDrawable` | SVG / `Image` component | Partial |
| `drawable.RippleDrawable` | `.stateStyles` with press effect | Partial |
| `drawable.AnimatedVectorDrawable` | — | Not mappable |
| `NinePatch` | — | Not mappable |
| `Picture` | — | Not mappable |

### 3.7 android.animation (~15 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `ValueAnimator` | `animateTo()` / `@ohos.animator` | Partial |
| `ObjectAnimator` | `.animation()` modifier + property binding | Partial |
| `AnimatorSet` | Animation chain / `keyframe` | Partial |
| `AnimatorListenerAdapter` | Animation callbacks | Mappable |
| `PropertyValuesHolder` | `keyframe` animations | Partial |
| `Keyframe` | `keyframe` | Mappable |
| `TimeInterpolator` / `AccelerateInterpolator` / `DecelerateInterpolator` / `LinearInterpolator` / `OvershootInterpolator` / `BounceInterpolator` / `AnticipateInterpolator` / `CycleInterpolator` / `PathInterpolator` | `Curve` enum / `ICurve` | Partial |
| `ArgbEvaluator` / `IntEvaluator` / `FloatEvaluator` / `TypeEvaluator` | — (handled internally) | Partial |
| `LayoutTransition` | `transition` component attribute | Partial |

### 3.8 android.text (~25 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `TextUtils` | TS String utilities | Mappable |
| `Spannable` / `SpannableString` / `SpannableStringBuilder` | `RichEditor` / `StyledString` | Partial |
| `Html` | `RichText` component | Partial |
| `TextWatcher` | `TextInput.onChange()` callback | Mappable |
| `Editable` | `TextInput` model | Partial |
| `InputFilter` / `InputFilter.LengthFilter` | `TextInput.maxLength()` | Partial |
| `TextPaint` | `@ohos.graphics.text` | Partial |
| `Layout` / `StaticLayout` | — (internal) | Not mappable |
| `style.ForegroundColorSpan` | `StyledString` with font color | Partial |
| `style.BackgroundColorSpan` | `StyledString` with background | Partial |
| `style.StyleSpan` (bold/italic) | `StyledString` with font weight/style | Partial |
| `style.TypefaceSpan` | `StyledString` with font family | Partial |
| `style.RelativeSizeSpan` / `AbsoluteSizeSpan` | `StyledString` with font size | Partial |
| `style.ClickableSpan` / `URLSpan` | `RichEditor` + link handling | Partial |
| `style.UnderlineSpan` / `StrikethroughSpan` | `StyledString` decoration | Partial |
| `style.ImageSpan` | `ImageSpan` component | Mappable |
| `style.SuperscriptSpan` / `SubscriptSpan` | — | Not mappable |
| `method.ScrollingMovementMethod` | — (internal) | Not mappable |
| `method.LinkMovementMethod` | — (internal) | Not mappable |

### 3.9 android.util (~15 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `Log` | `@ohos.hilog` | Mappable |
| `SparseArray<E>` | `@ohos.util.PlainArray` | Mappable |
| `SparseBooleanArray` | `@ohos.util.PlainArray` | Mappable |
| `SparseIntArray` / `SparseLongArray` | `@ohos.util.PlainArray` | Mappable |
| `LruCache<K,V>` | `@ohos.util.LRUCache` | Mappable |
| `Pair<F,S>` | TS tuple `[F,S]` | Mappable |
| `Size` / `SizeF` | TS object `{width, height}` | Mappable |
| `ArrayMap<K,V>` | `@ohos.util.LightWeightMap` | Mappable |
| `ArraySet<E>` | `@ohos.util.LightWeightSet` | Mappable |
| `Base64` | `@ohos.base64Helper` / `@ohos.util` | Mappable |
| `TypedValue` | `@ohos.resourceManager` units | Partial |
| `DisplayMetrics` | `@ohos.display` | Mappable |
| `Patterns` | TS RegExp | Mappable |
| `Xml` | — (manual parse) | Partial |
| `JsonReader` / `JsonWriter` / `JsonToken` | JSON.parse / JSON.stringify | Mappable |
| `Property<T,V>` | TS property accessor | Mappable |

### 3.10 android.media (~20 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `MediaPlayer` | `@ohos.multimedia.media` AVPlayer | Mappable |
| `MediaRecorder` | `@ohos.multimedia.media` AVRecorder | Mappable |
| `AudioManager` | `@ohos.multimedia.audio` AudioManager | Mappable |
| `AudioTrack` | `@ohos.multimedia.audio` AudioRenderer | Mappable |
| `AudioRecord` | `@ohos.multimedia.audio` AudioCapturer | Mappable |
| `AudioAttributes` | `@ohos.multimedia.audio` AudioStreamInfo | Mappable |
| `AudioFocusRequest` | `@ohos.multimedia.audio` focus management | Partial |
| `SoundPool` | `@ohos.multimedia.media` AVPlayer (multiple) | Partial |
| `Ringtone` / `RingtoneManager` | `@ohos.multimedia.audio` | Partial |
| `ToneGenerator` | — | Not mappable |
| `MediaMetadataRetriever` | `@ohos.multimedia.media` AVMetadataExtractor | Mappable |
| `MediaExtractor` | `@ohos.multimedia.media` | Partial |
| `MediaCodec` | `@ohos.multimedia.media` AVCodec | Partial |
| `MediaFormat` | `@ohos.multimedia.media` Format | Partial |
| `MediaMuxer` | `@ohos.multimedia.media` AVMuxer | Partial |
| `MediaDrm` | `@ohos.multimedia.drm` | Mappable |
| `ExifInterface` | `@ohos.multimedia.image` ImageSource | Mappable |
| `AudioEffect` / `Equalizer` / `BassBoost` / `Virtualizer` | `@ohos.multimedia.audio` AudioEffect | Partial |

### 3.11 android.net, android.database, android.provider (~25 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `Uri` | `@ohos.uri` | Mappable |
| `ConnectivityManager` | `@ohos.net.connection` | Mappable |
| `NetworkInfo` | `@ohos.net.connection` NetHandle | Partial |
| `NetworkCapabilities` | `@ohos.net.connection` NetCapabilities | Mappable |
| `NetworkRequest` | `@ohos.net.connection` NetSpecifier | Mappable |
| `LinkProperties` | `@ohos.net.connection` ConnectionProperties | Mappable |
| `TrafficStats` | `@ohos.net.statistics` | Mappable |
| `wifi.WifiManager` | `@ohos.wifi` | Mappable |
| `wifi.WifiInfo` | `@ohos.wifi` WifiLinkedInfo | Mappable |
| `wifi.ScanResult` | `@ohos.wifi` WifiScanInfo | Mappable |
| `sqlite.SQLiteDatabase` | `@ohos.data.relationalStore` | Mappable |
| `sqlite.SQLiteOpenHelper` | `@ohos.data.relationalStore` StoreConfig | Mappable |
| `sqlite.SQLiteStatement` | `@ohos.data.relationalStore` executeSql | Mappable |
| `Cursor` | `@ohos.data.relationalStore` ResultSet | Mappable |
| `CursorWrapper` | ResultSet wrapper | Mappable |
| `MatrixCursor` | TS shim | Mappable |
| `ContentObserver` | `relationalStore.on('change')` | Mappable |
| `DatabaseUtils` | TS utility shim | Mappable |
| `Settings` / `Settings.System` / `Settings.Secure` / `Settings.Global` | `@ohos.settings` | Partial |
| `MediaStore` (Images/Video/Audio) | `@ohos.file.photoAccessHelper` | Partial |
| `ContactsContract` | `@ohos.contact` | Partial |
| `CalendarContract` | `@ohos.calendarManager` | Partial |
| `Telephony` (provider) | `@ohos.telephony.sms` | Partial |
| `DocumentsContract` | `@ohos.file.picker` | Partial |

### 3.12 android.hardware, android.location, android.telephony, android.bluetooth, android.nfc (~30 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `camera2.CameraManager` | `@ohos.multimedia.camera` | Partial |
| `camera2.CameraDevice` | camera.CameraInput | Partial |
| `camera2.CaptureRequest` | camera.CaptureSession | Partial |
| `camera2.CameraCharacteristics` | camera.CameraOutputCapability | Partial |
| `SensorManager` | `@ohos.sensor` | Mappable |
| `Sensor` | `@ohos.sensor` SensorId | Mappable |
| `SensorEvent` / `SensorEventListener` | `sensor.on()` callback | Mappable |
| `usb.UsbManager` | `@ohos.usbManager` | Partial |
| `usb.UsbDevice` | `@ohos.usbManager` USBDevice | Partial |
| `biometrics.BiometricPrompt` | `@ohos.userIAM.userAuth` | Mappable |
| `display.DisplayManager` | `@ohos.display` | Mappable |
| `LocationManager` | `@ohos.geoLocationManager` | Mappable |
| `Location` | geoLocationManager.Location | Mappable |
| `Geocoder` | `@ohos.geoLocationManager` geocode | Mappable |
| `LocationListener` | `geoLocationManager.on('locationChange')` | Mappable |
| `TelephonyManager` | `@ohos.telephony.radio` | Mappable |
| `SmsManager` | `@ohos.telephony.sms` | Mappable |
| `SubscriptionManager` | `@ohos.telephony.sim` | Mappable |
| `PhoneStateListener` / `TelephonyCallback` | `@ohos.telephony.observer` | Mappable |
| `BluetoothAdapter` | `@ohos.bluetooth.access` | Mappable |
| `BluetoothDevice` | `@ohos.bluetooth.connection` | Mappable |
| `BluetoothSocket` / `BluetoothServerSocket` | `@ohos.bluetooth.socket` | Mappable |
| `BluetoothGatt` / `BluetoothGattCallback` / `BluetoothGattCharacteristic` / `BluetoothGattService` | `@ohos.bluetooth.ble` | Partial |
| `BluetoothManager` | `@ohos.bluetooth.access` | Mappable |
| `le.BluetoothLeScanner` / `le.ScanFilter` / `le.ScanResult` | `@ohos.bluetooth.ble` | Partial |
| `NfcAdapter` | `@ohos.nfc.controller` | Partial |
| `Tag` / `Ndef` / `NdefMessage` / `NdefRecord` | `@ohos.nfc.tag` | Partial |
| `tech.IsoDep` / `tech.MifareClassic` / `tech.NfcA/B` | `@ohos.nfc.tag` tech classes | Partial |
| `cardemulation.HostApduService` | `@ohos.nfc.cardEmulation` | Partial |

### 3.13 android.webkit, android.speech, android.print, android.appwidget, android.service (~15 classes)

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `WebView` | `Web` component (`@kit.ArkWeb`) | Mappable |
| `WebSettings` | `Web.webSettings()` | Mappable |
| `WebViewClient` | `Web.onPageBegin()`, `.onPageEnd()`, `.onError()` | Mappable |
| `WebChromeClient` | `Web.onTitleReceive()`, `.onProgressChange()` | Partial |
| `CookieManager` | `@ohos.web.webview` cookieManager | Mappable |
| `RecognizerIntent` / `SpeechRecognizer` | — (no OH speech recognition API) | Not mappable |
| `tts.TextToSpeech` | — (no OH TTS API) | Not mappable |
| `PrintManager` / `PrintJob` / `PrintDocumentAdapter` | `@ohos.print` | Mappable |
| `AppWidgetProvider` / `AppWidgetManager` | `FormExtensionAbility` / `@ohos.app.form` | Partial |
| `notification.NotificationListenerService` | `@ohos.notificationSubscribe` | Partial |
| `wallpaper.WallpaperService` | `@ohos.wallpaper` | Partial |
| `dreams.DreamService` | — | Not mappable |
| `autofill.AutofillService` | `@ohos.app.ability.autoFillManager` | Partial |
| `textservice.SpellCheckerService` | — | Not mappable |

---

## 4. AndroidX / Jetpack / Material (~100+ classes)

### 4.1 Core AndroidX

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `AppCompatActivity` | `UIAbility` | Mappable (wrapper) |
| `AppCompatDialog` | `CustomDialogController` | Mappable |
| `Fragment` / `FragmentManager` / `FragmentTransaction` | `@Component` + `Navigation` | Partial |
| `DialogFragment` / `BottomSheetDialogFragment` | Dialog + `@Component` | Partial |
| `ContextCompat` | `UIAbilityContext` helpers | Partial |
| `ActivityCompat` | `abilityAccessCtrl` | Partial |
| `NotificationCompat` / `NotificationManagerCompat` | `@ohos.notificationManager` | Mappable |
| `FileProvider` | `@ohos.file.fileUri` | Partial |

### 4.2 RecyclerView ecosystem

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `RecyclerView` | `List` + `LazyForEach` | Partial |
| `RecyclerView.Adapter` | `LazyForEach` IDataSource | Partial |
| `RecyclerView.ViewHolder` | — (declarative) | Not mappable |
| `LinearLayoutManager` | `List` (vertical/horizontal) | Mappable |
| `GridLayoutManager` | `Grid` | Mappable |
| `StaggeredGridLayoutManager` | `WaterFlow` | Mappable |
| `ItemTouchHelper` | `List.onItemDragStart()` + `.onSwipeAction()` | Partial |
| `DiffUtil` / `ListAdapter` | `LazyForEach` key-based diffing | Partial |
| `RecyclerView.ItemDecoration` | `List.divider()` | Partial |
| `SnapHelper` / `LinearSnapHelper` / `PagerSnapHelper` | `Swiper` / `List.scrollSnapAlign()` | Partial |
| `ConcatAdapter` | Multiple `ForEach` sections | Partial |

### 4.3 ViewPager2, ConstraintLayout, CoordinatorLayout

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `ViewPager2` | `Swiper` | Mappable |
| `FragmentStateAdapter` | `Swiper` + `@Builder` | Partial |
| `ConstraintLayout` / `ConstraintSet` | `RelativeContainer` | Partial |
| `Guideline` / `Barrier` / `Group` / `Flow` | `RelativeContainer` rules | Partial |
| `MotionLayout` / `MotionScene` | Property animation chain | Partial |
| `CoordinatorLayout` | — | Not mappable |
| `AppBarLayout` / `CollapsingToolbarLayout` | — | Not mappable |
| `DrawerLayout` | `SideBarContainer` | Partial |
| `SwipeRefreshLayout` | `Refresh` component / `SwipeRefresher` | Mappable |

### 4.4 Lifecycle & Architecture

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `ViewModel` / `ViewModelProvider` | `@State` / `AppStorage` | Partial |
| `LiveData` / `MutableLiveData` | `@State` / `@Link` / `@Watch` | Partial |
| `MediatorLiveData` / `Transformations` | `@Computed` / manual | Partial |
| `Observer` | `@Watch` decorator | Partial |
| `LifecycleOwner` / `LifecycleObserver` / `Lifecycle` | `aboutToAppear` / `aboutToDisappear` | Partial |
| `SavedStateHandle` | `AppStorage` / `PersistentStorage` | Partial |
| `ProcessLifecycleOwner` | `ApplicationStateChangeCallback` | Partial |

### 4.5 Room, WorkManager, Navigation, Paging, DataStore

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `RoomDatabase` / `@Dao` / `@Entity` / `@Query` / `@Insert` / `@Delete` / `@Update` | `@ohos.data.relationalStore` (no ORM) | Partial |
| `Migration` / `TypeConverter` | Manual migration | Partial |
| `WorkManager` / `Worker` / `WorkRequest` / `Constraints` | `@ohos.backgroundTaskManager` | Partial |
| `NavController` / `NavHost` / `NavGraph` / `NavDestination` | `Navigation` component / `@ohos.router` | Partial |
| `PagingSource` / `PagingData` / `Pager` / `PagingConfig` / `PagingDataAdapter` | `LazyForEach` + manual paging | Partial |
| `DataStore` / `Preferences DataStore` / `Proto DataStore` | `@ohos.data.preferences` / `@ohos.data.distributedKVStore` | Partial |

### 4.6 Google Material Design Components

| Android Class | OH Equivalent | Status |
|---------------|---------------|--------|
| `MaterialButton` | `Button` | Mappable |
| `FloatingActionButton` / `ExtendedFloatingActionButton` | `Button` (custom styling) | Partial |
| `Snackbar` | `promptAction.showToast()` (limited) | Partial |
| `BottomNavigationView` / `NavigationBarView` | `Tabs` (bottom) | Mappable |
| `NavigationView` / `NavigationRailView` | `Navigation` / `SideBarContainer` | Partial |
| `TabLayout` / `Tab` | `Tabs` + `TabContent` | Mappable |
| `BottomSheetBehavior` / `BottomSheetDialog` | `Sheet` / `Panel` | Partial |
| `Chip` / `ChipGroup` | `Chip` / `ChipGroup` (`@ohos.arkui.advanced`) | Mappable |
| `MaterialCardView` | `Column` + border/shadow styling | Partial |
| `MaterialSwitch` | `Toggle` (switch style) | Mappable |
| `Slider` / `RangeSlider` | `Slider` | Mappable |
| `TextInputLayout` / `TextInputEditText` | `TextInput` with label | Partial |
| `MaterialDatePicker` / `MaterialTimePicker` | `DatePickerDialog` / `TimePickerDialog` | Mappable |
| `MaterialAlertDialogBuilder` | `AlertDialog` | Mappable |
| `BadgeDrawable` | `Badge` | Mappable |
| `ShapeableImageView` | `Image` + `.clip()` | Partial |
| `MaterialToolbar` | `Navigation` title / `Toolbar` | Partial |

---

## 5. Coverage Summary

### 5.1 By Package — Full Counts

| Package | Total Classes | Implemented | Directly Mappable | Partially Mappable | Not Mappable |
|---------|--------------|-------------|-------------------|-------------------|--------------|
| `java.lang` | ~45 | **5** | 25 | 8 | 7 |
| `java.util` | ~60 | 0 | 35 | 18 | 7 |
| `java.io` | ~30 | 0 | 22 | 4 | 4 |
| `java.net` | ~15 | 0 | 12 | 2 | 1 |
| `java.nio/math/text/security` | ~30 | 0 | 18 | 8 | 4 |
| `android.app` | ~25 | **1** | 12 | 9 | 4 |
| `android.content` | ~30 | **2** | 16 | 10 | 4 |
| `android.os` | ~25 | **1** | 10 | 10 | 5 |
| `android.view` | ~40 | **2** | 8 | 24 | 8 |
| `android.widget` | ~50 | **3** | 25 | 18 | 7 |
| `android.graphics` | ~40 | 0 | 5 | 25 | 10 |
| `android.animation` | ~15 | 0 | 2 | 12 | 1 |
| `android.text` | ~25 | 0 | 4 | 15 | 6 |
| `android.util` | ~15 | 0 | 12 | 2 | 1 |
| `android.media` | ~20 | 0 | 10 | 8 | 2 |
| `android.net/database/provider` | ~25 | 0 | 18 | 6 | 1 |
| `android.hardware/location/telephony/bluetooth/nfc` | ~30 | 0 | 15 | 13 | 2 |
| `android.webkit/speech/print/etc` | ~15 | 0 | 7 | 4 | 4 |
| `androidx.*` | ~60 | 0 | 12 | 38 | 10 |
| `material.*` | ~20 | 0 | 10 | 8 | 2 |
| **TOTALS** | **~575** | **14** | **~278** | **~242** | **~90** |

### 5.2 Visual Coverage

```
Implemented:          █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  14/575  (  2.4%)
Directly mappable:    ██████████████░░░░░░░░░░░░░░░░░ 278/575  ( 48.3%)
Partially mappable:   ████████████░░░░░░░░░░░░░░░░░░░ 242/575  ( 42.1%)
Not mappable:         ████░░░░░░░░░░░░░░░░░░░░░░░░░░░  90/575  ( 15.7%)
Has OH equivalent:    █████████████████████████░░░░░░░ 520/575  ( 90.4%)
```

### 5.3 By Effort Category

| Effort | Classes | Description |
|--------|---------|-------------|
| Already done | 14 | Currently in CRAFT shim layer |
| Low effort (TS shim only) | ~120 | Pure TypeScript implementation, no OH API needed (boxed types, collections, exceptions, utils) |
| Medium effort (OH API call) | ~160 | Need OH SDK integration (file I/O, networking, storage, sensors, media) |
| High effort (paradigm bridge) | ~190 | Significant paradigm differences (graphics, animations, fragments, View internals, adapters, spans) |
| Not feasible | ~90 | Google-proprietary, Android-internal, deprecated, or fundamentally incompatible |

---

## 6. Recommended Implementation Priorities

*(Unchanged from original report — see Tiers 1-4 above)*

---

## 7. Architectural Notes

### 7.1 Paradigm Differences

| Concern | Android | OpenHarmony | CRAFT Strategy |
|---------|---------|-------------|----------------|
| UI definition | XML + Java inflation | Declarative `build()` | UIBridge serialization |
| State management | `setText()`/`invalidate()` | `@State` reactive | StateManager versioning |
| Custom views | Subclass View + `onDraw` | `@Builder` + `@Component` | Canvas bridge needed |
| Navigation | Intent + Activity stack | Router + page stack | LifecycleBridge + Want |
| Resources | `R.id.*`, `R.string.*` | `$r('app.string.*')` | ID translation table |
| Threading | Thread + Handler + Looper | taskpool + worker | Single-threaded interp |
| Layout | Measure/layout pass | Constraint-based declarative | UIBridge properties |
| Adapters | BaseAdapter + ViewHolder | ForEach/LazyForEach | Data source bridge |
| Animations | Animator objects | `.animation()` modifiers | Property bridge |
| Spans/Rich text | SpannableString | StyledString/RichEditor | Text bridge needed |
| IPC | Binder + AIDL | @ohos.rpc | Different model |
| Permissions | Manifest + runtime check | module.json5 + abilityAccessCtrl | Mapping table |

### 7.2 Key Technical Constraints

1. **No XML inflation** — OH has no `LayoutInflater`; CRAFT already constructs views via bytecode
2. **No view subclassing** — OH uses composition; custom drawing needs canvas bridge
3. **Single-threaded interpreter** — Handler/Looper cannot be replicated directly
4. **Resource ID mismatch** — Integer IDs vs string-based `$r()` references
5. **No ORM** — Room has no OH equivalent; must use raw relationalStore
6. **No CoordinatorLayout** — Complex scrolling behaviors must be reimplemented
7. **Different serialization** — Parcelable has no direct OH equivalent
8. **No reflection** — `java.lang.reflect.*` cannot work in static ArkTS compilation

---

## Appendix A: OH SDK Inventory (API 21)

- **602 API declaration files** (.d.ts)
- **120 UI component declarations**
- **47 kit bundles**
- **457 root-level @ohos.* files**
- **145 subdirectory files** (ability, arkui, application, etc.)

Key namespace distribution: ability (56 files), arkui (84 files), data (21 files), file (20 files), bluetooth (17 files), util (17 files), enterprise (16 files), multimedia (15 files), net (14 files), graphics (9 files), telephony (8 files), security (7 files), bundle (7 files)

## Appendix B: OH Kit Bundle Index (47 kits)

| Kit | Android Equivalent Domain |
|-----|--------------------------|
| `@kit.ArkUI` | android.view + android.widget + android.animation |
| `@kit.AbilityKit` | android.app + android.content (Activity, Service, Intent) |
| `@kit.ArkData` | android.database + SharedPreferences + ContentProvider |
| `@kit.CoreFileKit` | java.io + android.os.Environment |
| `@kit.NetworkKit` | java.net + android.net |
| `@kit.MediaKit` | android.media (playback/recording) |
| `@kit.AudioKit` | android.media (audio-specific) |
| `@kit.CameraKit` | android.hardware.camera2 |
| `@kit.ImageKit` | android.graphics.BitmapFactory + ExifInterface |
| `@kit.ArkWeb` | android.webkit |
| `@kit.NotificationKit` | android.app.Notification* |
| `@kit.LocationKit` | android.location |
| `@kit.SensorServiceKit` | android.hardware.Sensor* + android.os.Vibrator |
| `@kit.ConnectivityKit` | android.bluetooth + android.net.wifi + android.nfc |
| `@kit.TelephonyKit` | android.telephony |
| `@kit.UserAuthenticationKit` | android.hardware.biometrics |
| `@kit.CryptoArchitectureKit` | java.security + javax.crypto |
| `@kit.ArkGraphics2D` | android.graphics (Canvas, Paint, Path) |
| `@kit.ArkGraphics3D` | android.opengl |
| `@kit.BasicServicesKit` | android.os (misc) + android.content.ClipboardManager |
| `@kit.BackgroundTasksKit` | androidx.work.WorkManager + JobScheduler |
| `@kit.FormKit` | android.appwidget |
| `@kit.InputKit` | android.view (input events) |
| `@kit.ArkTS` | java.lang.Thread + java.util.concurrent |
| `@kit.PerformanceAnalysisKit` | android.util.Log + debug tools |

---

*Report generated from: CRAFT shim layer (14 classes), AOSP source tree, OpenHarmony SDK API 21 (602 declarations), OH source tree sample apps*
