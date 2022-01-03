Map.prototype.update = function<K, V>(this: Map<K, V>, k: K, cb: (v?: V) => V) {
    const v = cb(this.get(k));
    this.set(k, v);
}