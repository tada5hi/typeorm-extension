export type DatabaseLockOptions = {
    /**
     * How long to wait for the lock, in milliseconds.
     * 0 tries once, unset waits until the lock is free.
     */
    timeout?: number,
    /**
     * Run the callback without a lock on a driver which has none (e.g. sqlite
     * in tests), instead of throwing a DriverError.
     *
     * default: false
     */
    silent?: boolean,
};
