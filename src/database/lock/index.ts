// isDatabaseLockAcquired stays internal, its spec imports it by path.
export { withLockedEntity } from './entity';
export { withDatabaseLock } from './module';
export type { DatabaseLockOptions, EntityLockOptions } from './type';
