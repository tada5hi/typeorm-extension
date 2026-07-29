import { DriverError } from '../../../../../src';
import {
    buildAddForeignKeyQuery,
    buildChangeColumnTypeQueries,
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

    describe('buildChangeColumnTypeQueries', () => {
        describe('mysql', () => {
            it('should alter the column in place', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'email',
                    type: 'varchar(255)',
                    nullable: false,
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `email` varchar(255) NOT NULL',
                ]);
            });

            it('should qualify the table with its database', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'app.user', {
                    name: 'email',
                    type: 'text',
                    nullable: true,
                })).toEqual([
                    'ALTER TABLE `app`.`user` MODIFY COLUMN `email` text NULL',
                ]);
            });

            it('should leave out the nullability if it is not stated', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'total',
                    type: 'int',
                    asExpression: '`a` + `b`',
                    generatedType: 'STORED',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `total` int AS (`a` + `b`) STORED',
                ]);
            });

            it('should default a generated column to VIRTUAL', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'total',
                    type: 'int',
                    asExpression: '`a` + `b`',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `total` int AS (`a` + `b`) VIRTUAL',
                ]);
            });

            it('should restate every attribute of the column', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'id',
                    type: 'bigint',
                    nullable: false,
                    unsigned: true,
                    autoIncrement: true,
                    comment: 'the id',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `id` bigint UNSIGNED NOT NULL ' +
                    'AUTO_INCREMENT COMMENT \'the id\'',
                ]);
            });

            it('should restate the charset, the default and the update action', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'updated_at',
                    type: 'varchar(64)',
                    nullable: false,
                    charset: 'utf8mb4',
                    collation: 'utf8mb4_bin',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `updated_at` varchar(64) ' +
                    'CHARACTER SET \'utf8mb4\' COLLATE \'utf8mb4_bin\' NOT NULL ' +
                    'DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
                ]);
            });

            it('should keep a falsy default', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'amount',
                    type: 'int',
                    nullable: false,
                    default: 0,
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `amount` int NOT NULL DEFAULT 0',
                ]);
            });

            it('should restate the values of an enum column', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'status',
                    type: 'enum',
                    nullable: false,
                    enum: ['active', 'it\'s complicated'],
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `status` ' +
                    'enum(\'active\', \'it\'\'s complicated\') NOT NULL',
                ]);
            });

            it('should escape a comment', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'email',
                    type: 'text',
                    comment: 'it\'s a c:\\path',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `email` text COMMENT \'it\'\'s a c:\\\\path\'',
                ]);
            });

            it('should repair a default typeorm quoted without escaping', () => {
                // the mysql loader wraps the raw value in quotes as it is, so
                // a default holding a quote comes back as a broken literal
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'label',
                    type: 'varchar(128)',
                    nullable: false,
                    default: '\'it\'s\'',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `label` varchar(128) NOT NULL DEFAULT \'it\'\'s\'',
                ]);
            });

            it('should leave an escaped default untouched', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'label',
                    type: 'varchar(128)',
                    nullable: false,
                    default: '\'it\'\'s\'',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `label` varchar(128) NOT NULL DEFAULT \'it\'\'s\'',
                ]);
            });

            it('should leave a backslash escaped default untouched', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'label',
                    type: 'varchar(128)',
                    nullable: false,
                    default: '\'it\\\'s\'',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `label` varchar(128) NOT NULL DEFAULT \'it\\\'s\'',
                ]);
            });

            it('should leave an expression default untouched', () => {
                expect(buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'created_at',
                    type: 'timestamp',
                    nullable: false,
                    default: 'CURRENT_TIMESTAMP',
                })).toEqual([
                    'ALTER TABLE `user` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP',
                ]);
            });

            it('should refuse a generated column whose expression is unknown', () => {
                // typeorm reads the expression from its own metadata table —
                // without it, restating the definition would silently turn the
                // column into a regular one and drop what it computes
                expect(() => buildChangeColumnTypeQueries('mysql', 'user', {
                    name: 'total',
                    type: 'bigint',
                    generatedType: 'STORED',
                    asExpression: '',
                })).toThrow(DriverError);
            });
        });

        describe('postgres', () => {
            it('should alter a generated column, since it only names the type', () => {
                expect(buildChangeColumnTypeQueries('postgres', 'user', {
                    name: 'total',
                    type: 'bigint',
                    generatedType: 'STORED',
                    asExpression: '',
                })).toEqual([
                    'ALTER TABLE "user" ALTER COLUMN "total" TYPE bigint',
                ]);
            });

            it('should alter the type and the nullability', () => {
                expect(buildChangeColumnTypeQueries('postgres', 'user', {
                    name: 'email',
                    type: 'character varying(255)',
                    nullable: false,
                })).toEqual([
                    'ALTER TABLE "user" ALTER COLUMN "email" TYPE character varying(255)',
                    'ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL',
                ]);
            });

            it('should drop the nullability', () => {
                expect(buildChangeColumnTypeQueries('postgres', 'public.user', {
                    name: 'email',
                    type: 'text',
                    nullable: true,
                })).toEqual([
                    'ALTER TABLE "public"."user" ALTER COLUMN "email" TYPE text',
                    'ALTER TABLE "public"."user" ALTER COLUMN "email" DROP NOT NULL',
                ]);
            });

            it('should leave out the nullability if it is not stated', () => {
                expect(buildChangeColumnTypeQueries('postgres', 'user', {
                    name: 'email',
                    type: 'text',
                })).toEqual([
                    'ALTER TABLE "user" ALTER COLUMN "email" TYPE text',
                ]);
            });

            it('should convert the values with a using expression', () => {
                // without one the values are converted with the assignment cast
                // between the two types, and postgres refuses a change with none
                expect(buildChangeColumnTypeQueries('postgres', 'user', {
                    name: 'roleId',
                    type: 'integer',
                    nullable: false,
                    using: '"roleId"::integer',
                })).toEqual([
                    'ALTER TABLE "user" ALTER COLUMN "roleId" TYPE integer USING "roleId"::integer',
                    'ALTER TABLE "user" ALTER COLUMN "roleId" SET NOT NULL',
                ]);
            });

            it('should not restate the definition of the column', () => {
                // postgres keeps the default, the comment and the identity —
                // only mysql replaces the definition in full
                expect(buildChangeColumnTypeQueries('postgres', 'user', {
                    name: 'id',
                    type: 'bigint',
                    autoIncrement: true,
                    default: '0',
                    comment: 'the id',
                })).toEqual([
                    'ALTER TABLE "user" ALTER COLUMN "id" TYPE bigint',
                ]);
            });
        });
    });
});
