import {
    buildAddForeignKeyQuery,
    buildDropForeignKeyQuery,
    buildDropIndexQuery,
    buildRenameForeignKeyQuery,
    buildRenameIndexQuery,
    escapeSchemaIdentifier,
    escapeSchemaPath,
} from '../../../../../src/database/schema/alter/statements';

describe('src/database/schema/alter/statements', () => {
    describe('escaping', () => {
        it('should escape identifiers', () => {
            expect(escapeSchemaIdentifier('postgres', 'user')).toEqual('"user"');
            expect(escapeSchemaIdentifier('mysql', 'user')).toEqual('`user`');
        });

        it('should escape quotes inside identifiers', () => {
            expect(escapeSchemaIdentifier('postgres', 'us"er')).toEqual('"us""er"');
            expect(escapeSchemaIdentifier('mysql', 'us`er')).toEqual('`us``er`');
        });

        it('should escape each part of a path', () => {
            expect(escapeSchemaPath('postgres', 'public.user')).toEqual('"public"."user"');
            expect(escapeSchemaPath('mysql', 'app.user')).toEqual('`app`.`user`');
        });
    });

    describe('buildRenameIndexQuery', () => {
        it('should rename the table index on mysql', () => {
            expect(buildRenameIndexQuery('mysql', {
                table: 'user',
                from: 'IDX_from',
                to: 'IDX_to',
            })).toEqual('ALTER TABLE `user` RENAME INDEX `IDX_from` TO `IDX_to`');
        });

        it('should rename the schema scoped index on postgres', () => {
            expect(buildRenameIndexQuery('postgres', {
                table: 'user',
                from: 'IDX_from',
                to: 'IDX_to',
            })).toEqual('ALTER INDEX "IDX_from" RENAME TO "IDX_to"');
        });

        it('should qualify the index with the schema of the table on postgres', () => {
            expect(buildRenameIndexQuery('postgres', {
                table: 'public.user',
                from: 'IDX_from',
                to: 'IDX_to',
            })).toEqual('ALTER INDEX "public"."IDX_from" RENAME TO "IDX_to"');
        });
    });

    describe('buildDropIndexQuery', () => {
        it('should drop a table index on mysql', () => {
            expect(buildDropIndexQuery('mysql', 'user', 'IDX_from'))
                .toEqual('ALTER TABLE `user` DROP INDEX `IDX_from`');
        });

        it('should drop a schema scoped index on postgres', () => {
            expect(buildDropIndexQuery('postgres', 'public.user', 'IDX_from'))
                .toEqual('DROP INDEX "public"."IDX_from"');
        });
    });

    describe('buildRenameForeignKeyQuery', () => {
        it('should rename the constraint', () => {
            expect(buildRenameForeignKeyQuery({
                table: 'public.user',
                from: 'FK_from',
                to: 'FK_to',
            })).toEqual('ALTER TABLE "public"."user" RENAME CONSTRAINT "FK_from" TO "FK_to"');
        });
    });

    describe('buildDropForeignKeyQuery', () => {
        it('should drop the foreign key on mysql', () => {
            expect(buildDropForeignKeyQuery('mysql', 'user', 'FK_from'))
                .toEqual('ALTER TABLE `user` DROP FOREIGN KEY `FK_from`');
        });

        it('should drop the constraint on postgres', () => {
            expect(buildDropForeignKeyQuery('postgres', 'user', 'FK_from'))
                .toEqual('ALTER TABLE "user" DROP CONSTRAINT "FK_from"');
        });
    });

    describe('buildAddForeignKeyQuery', () => {
        it('should add the constraint', () => {
            expect(buildAddForeignKeyQuery('mysql', {
                table: 'user',
                name: 'FK_to',
                columns: ['role_id'],
                referencedTable: 'role',
                referencedColumns: ['id'],
            })).toEqual(
                'ALTER TABLE `user` ADD CONSTRAINT `FK_to` FOREIGN KEY (`role_id`) REFERENCES `role` (`id`)',
            );
        });

        it('should add the referential actions', () => {
            expect(buildAddForeignKeyQuery('mysql', {
                table: 'user',
                name: 'FK_to',
                columns: ['role_id'],
                referencedTable: 'role',
                referencedColumns: ['id'],
                onDelete: 'CASCADE',
                onUpdate: 'NO ACTION',
            })).toEqual(
                'ALTER TABLE `user` ADD CONSTRAINT `FK_to` FOREIGN KEY (`role_id`) ' +
                'REFERENCES `role` (`id`) ON DELETE CASCADE ON UPDATE NO ACTION',
            );
        });

        it('should support composite keys', () => {
            expect(buildAddForeignKeyQuery('postgres', {
                table: 'public.user',
                name: 'FK_to',
                columns: ['realm_id', 'client_id'],
                referencedTable: 'public.client',
                referencedColumns: ['realm_id', 'id'],
            })).toEqual(
                'ALTER TABLE "public"."user" ADD CONSTRAINT "FK_to" ' +
                'FOREIGN KEY ("realm_id", "client_id") REFERENCES "public"."client" ("realm_id", "id")',
            );
        });
    });
});
