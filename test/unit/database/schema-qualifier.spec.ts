import { describe, expect, it } from 'vitest';
import { removeSchemaQualifier } from '../../../src/database/utils/schema-qualifier';

describe('src/database/utils/schema-qualifier', () => {
    it('should remove the qualifier of the schema', () => {
        expect(removeSchemaQualifier('DROP INDEX "public"."IDX_a"', 'public'))
            .toEqual('DROP INDEX "IDX_a"');
        expect(removeSchemaQualifier('ALTER INDEX "public"."IDX_a" RENAME TO "IDX_b"', 'public'))
            .toEqual('ALTER INDEX "IDX_a" RENAME TO "IDX_b"');
        expect(removeSchemaQualifier('ALTER TYPE "public"."user_role_enum" RENAME TO "user_role_enum_old"', 'public'))
            .toEqual('ALTER TYPE "user_role_enum" RENAME TO "user_role_enum_old"');
    });

    it('should remove every occurrence', () => {
        expect(removeSchemaQualifier('DROP INDEX "public"."a"; DROP INDEX "public"."b"', 'public'))
            .toEqual('DROP INDEX "a"; DROP INDEX "b"');
    });

    it('should keep the qualifier of another schema', () => {
        expect(removeSchemaQualifier('DROP INDEX "other"."IDX_a"', 'public'))
            .toEqual('DROP INDEX "other"."IDX_a"');
        expect(removeSchemaQualifier('DROP INDEX "public_x"."IDX_a"', 'public'))
            .toEqual('DROP INDEX "public_x"."IDX_a"');
    });

    it('should keep the schema part of a three part name', () => {
        expect(removeSchemaQualifier('DROP TABLE "db"."dbo"."user"', 'dbo'))
            .toEqual('DROP TABLE "db"."dbo"."user"');
    });

    it('should keep a column or table named like the schema', () => {
        expect(removeSchemaQualifier('ALTER TABLE "user" ADD "public" boolean', 'public'))
            .toEqual('ALTER TABLE "user" ADD "public" boolean');
    });

    it('should escape regular expression characters of the schema', () => {
        expect(removeSchemaQualifier('DROP INDEX "a.b"."IDX"; DROP INDEX "axb"."IDX"', 'a.b'))
            .toEqual('DROP INDEX "IDX"; DROP INDEX "axb"."IDX"');
    });
});
