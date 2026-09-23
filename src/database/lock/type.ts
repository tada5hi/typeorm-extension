export type DatabaseLockOptions = {
    /**
     * How long to wait for the lock, in milliseconds.
     * 0 tries once, unset waits until the lock is free.
     */
    timeout?: number,
    /**
     * Throw a DriverError on a driver which has no lock. Set to false to run
     * the callback without a lock there instead (e.g. sqlite in tests).
     *
     * default: true
     */
    strict?: boolean,
};
