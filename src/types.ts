import type { ObjectLiteral } from 'rapiq';

export type RecordWith<
    T extends ObjectLiteral,
    A extends keyof T,
> = Pick<T, A> & Partial<Omit<T, A>>;
