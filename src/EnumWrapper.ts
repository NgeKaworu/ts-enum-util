/**
 * Used internally to verify that some type is enum-like.
 * A type is enum-like if all its properties are of type number or string.
 * @template V - Type of the enum value.
 * @template K - String literal union of all keys of the enum-like type.
 */
export type EnumLike<V extends number | string, K extends string> = {
    [P in K]: V
};

/**
 * Extracts only keys of type T that are assignable to type `string`.
 * This is necessary starting with TypeScript 2.9 because keyof T can now
 * include `number` and `symbol` types.
 */
type StringKeyOf<T> = Extract<keyof T, string>;

/**
 * A generic wrapper for any enum-like object (see {@link EnumLike}).
 * Provides utilities for runtime processing of an enum's values and keys, with strict compile-time
 * type safety.
 *
 * EnumWrapper cannot be directly instantiated. Use one of the following to get/create an EnumWrapper
 * instance:
 * - {@link $enum}
 * - {@link EnumWrapper.getCachedInstance}
 *
 * @template V - Type of the enum value.
 * @template T - Type of the enum-like object that is being wrapped.
 */
export class EnumWrapper<
    V extends number | string = number | string,
    T extends EnumLike<V, StringKeyOf<T>> = any
> implements Iterable<EnumWrapper.Entry<T>>, ArrayLike<EnumWrapper.Entry<T>> {
    /**
     * List of all keys for this enum, in sorted order.
     */
    private readonly keysList: ReadonlyArray<StringKeyOf<T>>;

    /**
     * List of all values for this enum, in sorted key order.
     */
    private readonly valuesList: ReadonlyArray<T[StringKeyOf<T>]>;

    /**
     * Map of enum value -> enum key.
     * Used for reverse key lookups.
     * NOTE: Performance tests show that using a Map (even if it's a slow polyfill) is faster than building a lookup
     *       string key for values and using a plain Object:
     *       {@link https://www.measurethat.net/Benchmarks/Show/2514/1/map-keyed-by-string-or-number}
     */
    private readonly keysByValueMap: ReadonlyMap<V, StringKeyOf<T>>;

    /**
     * The number of entries in this enum.
     * Part of the Map-like interface.
     */
    public readonly size: number;

    /**
     * The number of entries in this enum.
     * Part of the ArrayLike interface.
     */
    public readonly length: number;

    /**
     * Index signature.
     * Part of the ArrayLike interface.
     */
    readonly [key: number]: EnumWrapper.Entry<T>;

    /**
     * Create a new EnumWrapper instance.
     * This is for internal use only.
     * Use {@link $enum} to publicly get/create an EnumWrapper
     *
     * @param enumObj - An enum-like object. See the {@link EnumLike} type for more explanation.
     */
    public constructor(private readonly enumObj: T) {
        this.keysList = Object.freeze(Object.keys(enumObj)
            // Include only keys that are not index keys.
            // This is necessary to ignore the reverse-lookup entries that are automatically added
            // by TypeScript to numeric enums.
            .filter(isNonIndexKey)
            // Order of Object.keys() is implementation-dependent, so sort the keys to guarantee
            // a consistent order for iteration.
            .sort() as StringKeyOf<T>[]);

        const length = this.keysList.length;
        const valuesList = new Array<T[StringKeyOf<T>]>(length);
        const keysByValueMap = new Map<V, StringKeyOf<T>>();

        // According to multiple tests found on jsperf.com, a plain for loop is faster than using
        // Array.prototype.forEach
        for (let index = 0; index < length; ++index) {
            const key = this.keysList[index];
            const value = enumObj[key];

            valuesList[index] = value;
            keysByValueMap.set(value, key);
            // Type casting of "this" necessary to bypass readonly index signature for initialization.
            (this as any)[index] = Object.freeze([key, value]);
        }

        this.valuesList = Object.freeze(valuesList);
        this.keysByValueMap = keysByValueMap;
        this.size = this.length = length;

        // Make the EnumWrapper instance immutable
        Object.freeze(this);
    }

    public get [Symbol.toStringTag](): string {
        return "EnumWrapper";
    }

    /**
     * @return "[object EnumWrapper]"
     */
    public toString(): string {
        // NOTE: overriding toString in addition to Symbol.toStringTag
        //       for maximum compatibility with older runtime environments
        //       that do not implement Object.prototype.toString in terms
        //       of Symbol.toStringTag
        return "[object EnumWrapper]";
    }

    /**
     * Get an iterator for this enum's keys.
     * Iteration order is based on sorted order of keys.
     * Part of the Map-like interface.
     * @return An iterator that iterates over this enum's keys.
     */
    public keys(): IterableIterator<StringKeyOf<T>> {
        let index = 0;

        return {
            next: () => {
                const isDone = index >= this.length;
                const result: IteratorResult<StringKeyOf<T>> = {
                    done: isDone,
                    value: this.keysList[index]
                };

                ++index;

                return result;
            },

            [Symbol.iterator](): IterableIterator<StringKeyOf<T>> {
                return this;
            }
        };
    }

    /**
     * Get an iterator for this enum's values.
     * Iteration order is based on sorted order of keys.
     * Part of the Map-like interface.
     * NOTE: If there are duplicate values in the enum, then there will also be duplicate values
     *       in the result.
     * @return An iterator that iterates over this enum's values.
     */
    public values(): IterableIterator<T[StringKeyOf<T>]> {
        let index = 0;

        return {
            next: () => {
                const isDone = index >= this.length;
                const result: IteratorResult<T[StringKeyOf<T>]> = {
                    done: isDone,
                    value: this.valuesList[index]
                };

                ++index;

                return result;
            },

            [Symbol.iterator](): IterableIterator<T[StringKeyOf<T>]> {
                return this;
            }
        };
    }

    /**
     * Get an iterator for this enum's entries as [key, value] tuples.
     * Iteration order is based on sorted order of keys.
     * @return An iterator that iterates over this enum's entries as [key, value] tuples.
     */
    public entries(): IterableIterator<EnumWrapper.Entry<T>> {
        let index = 0;

        return {
            next: () => {
                const isDone = index >= this.length;
                const result: IteratorResult<EnumWrapper.Entry<T>> = {
                    done: isDone,
                    // NOTE: defensive copy not necessary because entries are "frozen"
                    value: this[index]
                };

                ++index;

                return result;
            },

            [Symbol.iterator](): IterableIterator<EnumWrapper.Entry<T>> {
                return this;
            }
        };
    }

    /**
     * Get an iterator for this enum's entries as [key, value] tuples.
     * Iteration order is based on sorted order of keys.
     * @return An iterator that iterates over this enum's entries as [key, value] tuples.
     */
    public [Symbol.iterator](): IterableIterator<EnumWrapper.Entry<T>> {
        return this.entries();
    }

    /**
     * Calls the provided iteratee on each item in this enum.
     * Iteration order is based on sorted order of keys.
     * See {@link EnumWrapper.Iteratee} for the signature of the iteratee.
     * The return value of the iteratee is ignored.
     * @param iteratee - The iteratee.
     * @param context - If provided, then the iteratee will be called with the context as its "this" value.
     */
    public forEach(
        iteratee: EnumWrapper.Iteratee<void, V, T>,
        context?: any
    ): void {
        const length = this.length;

        // According to multiple tests found on jsperf.com, a plain for loop is faster than using
        // Array.prototype.forEach
        for (let index = 0; index < length; ++index) {
            const entry = this[index];
            iteratee.call(context, entry[1], entry[0], this, index);
        }
    }

    /**
     * Maps this enum's entries to a new list of values.
     * Iteration order is based on sorted order of keys.
     * Builds a new array containing the results of calling the provided iteratee on each item in this enum.
     * See {@link EnumWrapper.Iteratee} for the signature of the iteratee.
     * @param iteratee - The iteratee.
     * @param context - If provided, then the iteratee will be called with the context as its "this" value.
     * @return A new array containg the results of the iteratee.
     *
     * @template R - The of the mapped result for each entry.
     */
    public map<R>(iteratee: EnumWrapper.Iteratee<R, V, T>, context?: any): R[] {
        const length = this.length;
        const result = new Array<R>(length);

        // According to multiple tests found on jsperf.com, a plain for loop is faster than using Array.prototype.map
        for (let index = 0; index < length; ++index) {
            const entry = this[index];
            result[index] = iteratee.call(
                context,
                entry[1],
                entry[0],
                this,
                index
            );
        }

        return result;
    }

    /**
     * Get a list of this enum's keys.
     * Order of items in the list is based on sorted order of keys.
     * @return A list of this enum's keys.
     */
    public getKeys(): (StringKeyOf<T>)[] {
        // need to return a copy of this.keysList so it can be returned as Array instead of ReadonlyArray.
        return this.keysList.slice();
    }

    /**
     * Get a list of this enum's values.
     * Order of items in the list is based on sorted order of keys.
     * NOTE: If there are duplicate values in the enum, then there will also be duplicate values
     *       in the result.
     * @return A list of this enum's values.
     */
    public getValues(): T[StringKeyOf<T>][] {
        // need to return a copy of this.valuesList so it can be returned as Array instead of ReadonlyArray.
        return this.valuesList.slice();
    }

    /**
     * Get a list of this enum's entries as [key, value] tuples.
     * Order of items in the list is based on sorted order of keys.
     * @return A list of this enum's entries as [key, value] tuples.
     */
    public getEntries(): EnumWrapper.Entry<T>[] {
        // Create an array from the indexed entries of "this".
        // NOTE: no need for defensive copy of each entry because all entries are "frozen".
        return Array.prototype.slice.call(this);
    }

    /**
     * Tests if the provided string is actually a valid key for this enum
     * Acts as a type guard to confirm that the provided value is actually the enum key type.
     * @param key - A potential key value for this enum.
     * @return True if the provided key is a valid key for this enum.
     */
    public isKey(key: string | null | undefined): key is StringKeyOf<T> {
        return (
            key != null &&
            isNonIndexKey(key) &&
            this.enumObj.hasOwnProperty(key)
        );
    }

    /**
     * Casts a string to a properly-typed key for this enum.
     * Throws an error if the key is invalid.
     * @param key - A potential key value for this enum.
     * @return The provided key value, cast to the type of this enum's keys.
     * @throws {Error} if the provided string is not a valid key for this enum.
     */
    public asKeyOrThrow(key: string | null | undefined): StringKeyOf<T> {
        if (this.isKey(key)) {
            return key;
        } else {
            throw new Error(
                `Unexpected key: ${key}. Expected one of: ${this.getValues()}`
            );
        }
    }

    /**
     * Casts a string to a properly-typed key for this enum.
     * Returns a default key if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultKey - The key to be returned if the provided key is invalid.
     * @return The provided key value, cast to the type of this enum's keys.
     *         Returns `defaultKey` if the provided key is invalid.
     */
    public asKeyOrDefault(
        key: string | null | undefined,
        defaultKey: StringKeyOf<T>
    ): StringKeyOf<T>;
    /**
     * Casts a string to a properly-typed key for this enum.
     * Returns a default key if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultKey - The key to be returned if the provided key is invalid.
     * @return The provided key value, cast to the type of this enum's keys.
     *         Returns `defaultKey` if the provided key is invalid.
     */
    public asKeyOrDefault(
        key: string | null | undefined,
        defaultKey?: StringKeyOf<T>
    ): StringKeyOf<T> | undefined;
    /**
     * Casts a string to a properly-typed key for this enum.
     * Returns a default key if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultKey - The key to be returned if the provided key is invalid.
     * @return The provided key value, cast to the type of this enum's keys.
     *         Returns `defaultKey` if the provided key is invalid.
     */
    public asKeyOrDefault(
        key: string | null | undefined,
        defaultKey: string
    ): string;
    /**
     * Casts a string to a properly-typed key for this enum.
     * Returns a default key if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultKey - The key to be returned if the provided key is invalid.
     * @return The provided key value, cast to the type of this enum's keys.
     *         Returns `defaultKey` if the provided key is invalid.
     */
    public asKeyOrDefault(
        key: string | null | undefined,
        defaultKey: string | undefined
    ): string | undefined;
    /**
     * Casts a string to a properly-typed key for this enum.
     * Returns a default key if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultKey - The key to be returned if the provided key is invalid.
     * @return The provided key value, cast to the type of this enum's keys.
     *         Returns `defaultKey` if the provided key is invalid.
     */
    public asKeyOrDefault(
        key: string | null | undefined,
        defaultKey?: StringKeyOf<T> | string
    ): string | undefined {
        if (this.isKey(key)) {
            return key;
        } else {
            return defaultKey;
        }
    }

    /**
     * Tests if the provided value is a valid value for this enum.
     * Acts as a type guard to confirm that the provided value is actually the enum value type.
     * @param value - A potential value for this enum.
     * @return True if the provided value is valid for this enum.
     */
    public isValue(value: V | null | undefined): value is T[StringKeyOf<T>] {
        return value != null && this.keysByValueMap.has(value);
    }

    /**
     * Casts a value to a properly-typed value for this enum.
     * Throws an error if the value is invalid.
     * @param value - A potential value for this enum.
     * @return The provided value, cast to the type of this enum's values.
     * @throws {Error} if the provided value is not a valid value for this enum.
     */
    public asValueOrThrow(value: V | null | undefined): T[StringKeyOf<T>] {
        if (this.isValue(value)) {
            return value;
        } else {
            throw new Error(
                `Unexpected value: ${value}. Expected one of: ${this.getValues()}`
            );
        }
    }

    /**
     * Casts a value to a properly-typed value for this enum.
     * Returns a default value if the provided value is invalid.
     * @param value - A potential value for this enum.
     * @param defaultValue - The value to be returned if the provided value is invalid.
     * @return The provided value, cast to the type of this enum's values.
     *         Returns `defaultValue` if the provided value is invalid.
     */
    public asValueOrDefault(
        value: V | null | undefined,
        defaultValue: T[StringKeyOf<T>]
    ): T[StringKeyOf<T>];
    /**
     * Casts a value to a properly-typed value for this enum.
     * Returns a default value if the provided value is invalid.
     * @param value - A potential value for this enum.
     * @param defaultValue - The value to be returned if the provided value is invalid.
     * @return The provided value, cast to the type of this enum's values.
     *         Returns `defaultValue` if the provided value is invalid.
     */
    public asValueOrDefault(
        value: V | null | undefined,
        defaultValue?: T[StringKeyOf<T>]
    ): T[StringKeyOf<T>] | undefined;
    /**
     * Casts a value to a properly-typed value for this enum.
     * Returns a default value if the provided value is invalid.
     * @param value - A potential value for this enum.
     * @param defaultValue - The value to be returned if the provided value is invalid.
     * @return The provided value, cast to the type of this enum's values.
     *         Returns `defaultValue` if the provided value is invalid.
     */
    public asValueOrDefault(value: V | null | undefined, defaultValue: V): V;
    /**
     * Casts a value to a properly-typed value for this enum.
     * Returns a default value if the provided value is invalid.
     * @param value - A potential value for this enum.
     * @param defaultValue - The value to be returned if the provided value is invalid.
     * @return The provided value, cast to the type of this enum's values.
     *         Returns `defaultValue` if the provided value is invalid.
     */
    public asValueOrDefault(
        value: V | null | undefined,
        defaultValue: V | undefined
    ): V | undefined;
    /**
     * Casts a value to a properly-typed value for this enum.
     * Returns a default value if the provided value is invalid.
     * @param value - A potential value for this enum.
     * @param defaultValue - The value to be returned if the provided value is invalid.
     * @return The provided value, cast to the type of this enum's values.
     *         Returns `defaultValue` if the provided value is invalid.
     */
    public asValueOrDefault(
        value: V | null | undefined,
        defaultValue?: T[StringKeyOf<T>] | V
    ): V | undefined {
        if (this.isValue(value)) {
            return value;
        } else {
            return defaultValue;
        }
    }

    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Throws an error if the value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @return The key for the provided value.
     * @throws {Error} if the provided value is not a valid value for this enum.
     */
    public getKeyOrThrow(value: V | null | undefined): StringKeyOf<T> {
        // NOTE: Intentionally not using isValue() or asValueOrThrow() to avoid making two key lookups into the map
        //       for successful lookups.
        const result =
            value != null ? this.keysByValueMap.get(value) : undefined;

        if (result != null) {
            return result;
        } else {
            throw new Error(
                `Unexpected value: ${value}. Expected one of: ${this.getValues()}`
            );
        }
    }

    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Returns a default key if the provided value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @param defaultKey - The key to be returned if the provided value is invalid.
     * @return The key for the provided value.
     *         Returns `defaultKey` if the provided value is invalid.
     */
    public getKeyOrDefault(
        value: V | null | undefined,
        defaultKey: StringKeyOf<T>
    ): StringKeyOf<T>;
    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Returns a default key if the provided value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @param defaultKey - The key to be returned if the provided value is invalid.
     * @return The key for the provided value.
     *         Returns `defaultKey` if the provided value is invalid.
     */
    public getKeyOrDefault(
        value: V | null | undefined,
        defaultKey?: StringKeyOf<T>
    ): StringKeyOf<T> | undefined;
    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Returns a default key if the provided value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @param defaultKey - The key to be returned if the provided value is invalid.
     * @return The key for the provided value.
     *         Returns `defaultKey` if the provided value is invalid.
     */
    public getKeyOrDefault(
        value: V | null | undefined,
        defaultKey: string
    ): string;
    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Returns a default key if the provided value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @param defaultKey - The key to be returned if the provided value is invalid.
     * @return The key for the provided value.
     *         Returns `defaultKey` if the provided value is invalid.
     */
    public getKeyOrDefault(
        value: V | null | undefined,
        defaultKey: string | undefined
    ): string | undefined;
    /**
     * Performs a reverse lookup from enum value to corresponding enum key.
     * Returns a default key if the provided value is invalid.
     * NOTE: If this enum has any duplicate values, then one of the keys for the duplicated value is
     *       arbitrarily returned.
     * @param value - A potential value for this enum.
     * @param defaultKey - The key to be returned if the provided value is invalid.
     * @return The key for the provided value.
     *         Returns `defaultKey` if the provided value is invalid.
     */
    public getKeyOrDefault(
        value: V | null | undefined,
        defaultKey?: StringKeyOf<T> | string
    ): string | undefined {
        // NOTE: Intentionally not using isValue() to avoid making two key lookups into the map for successful lookups.
        const result =
            value != null ? this.keysByValueMap.get(value) : undefined;

        if (result != null) {
            return result;
        } else {
            return defaultKey;
        }
    }

    /**
     * Gets the enum value for the provided key.
     * Throws an error if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @return The enum value for the provided key.
     * @throws {Error} if the provided string is not a valid key for this enum.
     */
    public getValueOrThrow(key: string | null | undefined): T[StringKeyOf<T>] {
        // NOTE: The key MUST be separately validated before looking up the entry in enumObj to avoid false positive
        //       lookups for keys that match properties on Object.prototype, or keys that match the index keys of
        //       reverse lookups on numeric enums.
        return this.enumObj[this.asKeyOrThrow(key)];
    }

    /**
     * Gets the enum value for the provided key.
     * Returns a default value if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultValue - The value to be returned if the provided key is invalid.
     * @return The enum value for the provided key.
     *         Returns `defaultValue` if the provided key is invalid.
     */
    public getValueOrDefault(
        key: string | null | undefined,
        defaultValue: T[StringKeyOf<T>]
    ): T[StringKeyOf<T>];
    /**
     * Gets the enum value for the provided key.
     * Returns a default value if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultValue - The value to be returned if the provided key is invalid.
     * @return The enum value for the provided key.
     *         Returns `defaultValue` if the provided key is invalid.
     */
    public getValueOrDefault(
        key: string | null | undefined,
        defaultValue?: T[StringKeyOf<T>]
    ): T[StringKeyOf<T>] | undefined;
    /**
     * Gets the enum value for the provided key.
     * Returns a default value if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultValue - The value to be returned if the provided key is invalid.
     * @return The enum value for the provided key.
     *         Returns `defaultValue` if the provided key is invalid.
     */
    public getValueOrDefault(
        key: string | null | undefined,
        defaultValue: V
    ): V;
    /**
     * Gets the enum value for the provided key.
     * Returns a default value if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultValue - The value to be returned if the provided key is invalid.
     * @return The enum value for the provided key.
     *         Returns `defaultValue` if the provided key is invalid.
     */
    public getValueOrDefault(
        key: string | null | undefined,
        defaultValue: V | undefined
    ): V | undefined;
    /**
     * Gets the enum value for the provided key.
     * Returns a default value if the provided key is invalid.
     * @param key - A potential key value for this enum.
     * @param defaultValue - The value to be returned if the provided key is invalid.
     * @return The enum value for the provided key.
     *         Returns `defaultValue` if the provided key is invalid.
     */
    public getValueOrDefault(
        key: string | null | undefined,
        defaultValue?: T[StringKeyOf<T>] | V
    ): V | undefined {
        // NOTE: The key MUST be separately validated before looking up the entry in enumObj to avoid false positive
        //       lookups for keys that match properties on Object.prototype, or keys that match the index keys of
        //       reverse lookups on numeric enums.
        if (this.isKey(key)) {
            return this.enumObj[key];
        } else {
            return defaultValue;
        }
    }
}

export namespace EnumWrapper {
    /**
     * A tuple containing the key and value of a single entry in an enum.
     * @template T - Type of an enum-like object.
     */
    export type Entry<
        T extends EnumLike<number | string, StringKeyOf<T>> = any
    > = Readonly<[StringKeyOf<T>, T[StringKeyOf<T>]]>;

    /**
     * A function used in iterating all key/value entries in an enum.
     * @param value - An enum value.
     * @param key - An enum key.
     * @param enumWrapper - The EnumWrapper instance being iterated..
     * @param index - The index of the enum entry, based on sorted order of keys.
     * @return A result. The significance of the result depends on the type of iteration being performed.
     *
     * @template R - The type of the result.
     * @template V - Type of the enum value.
     * @template T - Type of an enum-like object.
     */
    export type Iteratee<
        R = any,
        V extends number | string = number | string,
        T extends EnumLike<V, StringKeyOf<T>> = any
    > = (
        this: any,
        value: T[StringKeyOf<T>],
        key: StringKeyOf<T>,
        enumWrapper: EnumWrapper<V, T>,
        index: number
    ) => R;
}

/**
 * Type alias for an {@link EnumWrapper} for any type of enum-like object that contains only number values.
 *
 * @template T - Type of an enum-like object that contains only number values.
 */
export type NumberEnumWrapper<
    T extends EnumLike<number, StringKeyOf<T>> = any
> = EnumWrapper<number, T>;

export namespace NumberEnumWrapper {
    /**
     * Type alias for an {@link EnumWrapper.Entry} for any type of enum-like object that contains only number values.
     *
     * @template T - Type of an enum-like object that contains only number values.
     */
    export type Entry<
        T extends EnumLike<number, StringKeyOf<T>> = any
    > = EnumWrapper.Entry<T>;

    /**
     * Type alias for an {@link EnumWrapper.Iteratee} for any type of enum-like object that contains only number values.
     *
     * @template R - The type of the result.
     * @template T - Type of an enum-like object that contains only number values.
     */
    export type Iteratee<
        R = any,
        T extends EnumLike<number, StringKeyOf<T>> = any
    > = EnumWrapper.Iteratee<R, number, T>;
}

/**
 * Type alias for an {@link EnumWrapper} for any type of enum-like object that contains only string values.
 *
 * @template T - Type of an enum-like object that contains only string values.
 */
export type StringEnumWrapper<
    T extends EnumLike<string, StringKeyOf<T>> = any
> = EnumWrapper<string, T>;

export namespace StringEnumWrapper {
    /**
     * Type alias for an {@link EnumWrapper.Entry} for any type of enum-like object that contains only string values.
     *
     * @template T - Type of an enum-like object that contains only string values.
     */
    export type Entry<
        T extends EnumLike<string, StringKeyOf<T>> = any
    > = EnumWrapper.Entry<T>;

    /**
     * Type alias for an {@link EnumWrapper.Iteratee} for any type of enum-like object that contains only string values.
     *
     * @template R - The type of the result.
     * @template T - Type of an enum-like object that contains only string values.
     */
    export type Iteratee<
        R = any,
        T extends EnumLike<string, StringKeyOf<T>> = any
    > = EnumWrapper.Iteratee<R, string, T>;
}

/**
 * Type alias for an {@link EnumWrapper} for any type of enum-like object that contains a mix of
 * number and string values.
 *
 * @template T - Type of an enum-like object that contains a mix of number and string values.
 */
export type MixedEnumWrapper<
    T extends EnumLike<number | string, StringKeyOf<T>> = any
> = EnumWrapper<number | string, T>;

export namespace MixedEnumWrapper {
    /**
     * Type alias for an {@link EnumWrapper.Entry} for any type of enum-like object that contains a mix of
     * number and string values.
     *
     * @template T - Type of an enum-like object that contains a mix of number and string values.
     */
    export type Entry<
        T extends EnumLike<number | string, StringKeyOf<T>> = any
    > = EnumWrapper.Entry<T>;

    /**
     * Type alias for an {@link EnumWrapper.Iteratee} for any type of enum-like object that contains a mix of
     * number and string values.
     *
     * @template R - The type of the result.
     * @template T - Type of an enum-like object that contains a mix of number and string values.
     */
    export type Iteratee<
        R = any,
        T extends EnumLike<number | string, StringKeyOf<T>> = any
    > = EnumWrapper.Iteratee<R, number | string, T>;
}

/**
 * Return true if the specified object key value is NOT an integer index key.
 * @param key - An object key.
 * @return true if the specified object key value is NOT an integer index key.
 */
function isNonIndexKey(key: string): boolean {
    // If after converting the key to an integer, then back to a string, the result is different
    // than the original key, then the key is NOT an integer index.
    // See ECMAScript spec section 15.4: http://www.ecma-international.org/ecma-262/5.1/#sec-15.4
    return key !== String(parseInt(key, 10));
}
