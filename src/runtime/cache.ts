export class AsyncKeyedCache<V> {
    protected values : Map<string, V>;

    protected pending : Map<string, Promise<V>>;

    constructor() {
        this.values = new Map();
        this.pending = new Map();
    }

    has(key: string) : boolean {
        return this.values.has(key);
    }

    get(key: string) : V | undefined {
        return this.values.get(key);
    }

    set(key: string, value: V) : void {
        this.values.set(key, value);
        this.pending.delete(key);
    }

    unset(key: string) : void {
        this.values.delete(key);
        this.pending.delete(key);
    }

    clear() : void {
        this.values.clear();
        this.pending.clear();
    }

    /**
     * Get or build the value for a key.
     *
     * Concurrent calls for the same key share one build; a failed build is
     * evicted so the next call retries. The build callback receives the
     * currently stored value (if any) and may return it unchanged.
     */
    async resolve(key: string, build: (existing?: V) => Promise<V>) : Promise<V> {
        const existing = this.pending.get(key);
        if (existing) {
            return existing;
        }

        const promise : Promise<V> = build(this.values.get(key))
            .then((value) => {
                this.values.set(key, value);
                return value;
            })
            .catch((e) => {
                if (this.pending.get(key) === promise) {
                    this.pending.delete(key);
                }

                throw e;
            });

        this.pending.set(key, promise);

        return promise;
    }
}
