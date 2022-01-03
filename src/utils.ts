export type FilterKind<K, U> = U extends { kind: K } ? U : never

type FilterKeys<T extends string | number | symbol> =
    T extends string ? T :
        T extends number ? `${T}` :
            never;

type Key<T> = FilterKeys<keyof T>

export const keys = <T>(obj: T) => {
    return Object.keys(obj) as Key<T>[];
};