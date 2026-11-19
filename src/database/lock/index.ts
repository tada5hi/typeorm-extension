// isDatabaseLockAcquired stays internal, its spec imports it by path.
export { hasRowLock, withLockedEntity } from './entity';
export { withDatabaseLock } from './module';
export type { DatabaseLockOptions, EntityLockOptions } from './types';
