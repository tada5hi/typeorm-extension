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

export type EntityLockOptions = {
    /**
     * 'nowait' fails at once with the driver's error (see
     * isDatabaseLockConflictError) instead of waiting for a locked row.
     * Not supported on mssql.
     *
     * default: wait until the row is free
     */
    onLocked?: 'nowait',
    /**
     * Throw a DriverError on a driver which has no row lock. Set to false to
     * run the callback without a lock there instead (e.g. sqlite in tests).
     *
     * default: true
     */
    strict?: boolean,
};
