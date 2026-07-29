export * from './checks';
export * from './columns';
export * from './foreign-keys';
export * from './indices';

// dialect.ts and statements.ts stay internal: resolveSchemaDialect, the pure
// DDL builders and the identifier escapers are how the helpers above are
// implemented, not a contract consumers should be able to depend on.
export type {
    SchemaChangeColumnTypeInput,
    SchemaColumnType,
    SchemaForeignKeyMeta,
    SchemaRenameForeignKeyInput,
    SchemaRenameIndexInput,
} from './type';
