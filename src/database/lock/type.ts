export type DatabaseLockOptions = {
    /**
     * How long to wait for the lock, in milliseconds.
     * 0 tries once, unset waits until the lock is free.
     */
    timeout?: number,
};
