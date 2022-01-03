declare interface Map<K, V> {
    update(key: K, cb: (value?: V) => V): void;
}