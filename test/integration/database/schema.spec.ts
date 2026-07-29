import type { DataSource, QueryRunner } from 'typeorm';
import { Table, TableIndex, DataSource as TypeORMDataSource } from 'typeorm';
import {
    DriverError,
    MYSQL_FOREIGN_KEY_CHECKS_SELECT,
    changeColumnType,
    getSchemaDrift,
    renameForeignKey,
    renameIndex,
    withForeignKeyChecksDisabled,
} from '../../../src';
import { Role } from '../../data/entity/role';
import { User } from '../../data/entity/user';
import {
    createIntegrationDataSourceOptions,
    supportsForeignKeyChecks,
    supportsForeignKeyColumnAlter,
    supportsSchemaAlter,
    supportsSchemaMetadata,
    useIntegrationDriver,
} from '../../data/typeorm/integration';

const driver = useIntegrationDriver();

async function readForeignKeyChecks(queryRunner: QueryRunner) : Promise<string> {
    const rows = await queryRunner.query(MYSQL_FOREIGN_KEY_CHECKS_SELECT);

    return `${Object.values(rows[0])[0]}`;
}

describe.runIf(supportsSchemaMetadata(driver))(`src/database/schema/alter (${driver})`, () => {
    let dataSource : DataSource;

    beforeAll(async () => {
        dataSource = new TypeORMDataSource(
            createIntegrationDataSourceOptions([User, Role]),
        );

        await dataSource.initialize();

        // start from a known state without dropping the whole schema —
        // oracle refuses that from within a pluggable database
        const queryRunner = dataSource.createQueryRunner();
        try {
            await queryRunner.dropTable('user', true, true, true);
            await queryRunner.dropTable('role', true, true, true);
        } finally {
            await queryRunner.release();
        }

        await dataSource.synchronize(false);
    });

    afterAll(async () => {
        if (dataSource && dataSource.isInitialized) {
            await dataSource.destroy();
        }
    });

    it.runIf(supportsSchemaAlter(driver))('should rename a foreign key and detect the resulting drift', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            const table = await queryRunner.getTable('user');
            const foreignKey = table!.foreignKeys[0];
            const name = foreignKey.name as string;
            const indicesBefore = table!.indices.length;

            const input = {
                table: 'user',
                from: name,
                to: 'FK_integration_renamed',
            };

            expect(await renameForeignKey(queryRunner, input)).toBeTruthy();

            const renamedTable = await queryRunner.getTable('user');
            const renamed = renamedTable!.foreignKeys
                .find((item) => item.name === 'FK_integration_renamed');

            expect(renamed).toBeDefined();
            expect(renamed!.columnNames).toEqual(foreignKey.columnNames);
            expect(renamed!.referencedTableName).toEqual(foreignKey.referencedTableName);
            expect(renamed!.referencedColumnNames).toEqual(foreignKey.referencedColumnNames);
            expect(renamed!.onDelete).toEqual(foreignKey.onDelete);

            // mysql keeps the index it created under the constraint name when the
            // constraint is dropped — the table must not end up with a stale one
            expect(renamedTable!.indices.length).toEqual(indicesBefore);

            // running it again is a no-op
            expect(await renameForeignKey(queryRunner, input)).toBeFalsy();

            // the constraint name is part of the metadata description
            expect((await getSchemaDrift(dataSource)).exists).toBeTruthy();

            expect(await renameForeignKey(queryRunner, {
                table: 'user',
                from: 'FK_integration_renamed',
                to: name,
            })).toBeTruthy();

            const restoredTable = await queryRunner.getTable('user');
            expect(restoredTable!.indices.length).toEqual(indicesBefore);
            expect((await getSchemaDrift(dataSource)).exists).toBeFalsy();
        } finally {
            await queryRunner.release();
        }
    });

    it.runIf(supportsSchemaAlter(driver))('should rename an index', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            const table = await queryRunner.getTable('user');
            await queryRunner.createIndex(table!, new TableIndex({
                name: 'IDX_integration_from',
                columnNames: ['email'],
            }));

            const input = {
                table: 'user',
                from: 'IDX_integration_from',
                to: 'IDX_integration_to',
            };

            try {
                expect(await renameIndex(queryRunner, input)).toBeTruthy();

                const renamedTable = await queryRunner.getTable('user');
                const names = renamedTable!.indices.map((index) => index.name);

                expect(names).toContain('IDX_integration_to');
                expect(names).not.toContain('IDX_integration_from');

                // running it again is a no-op
                expect(await renameIndex(queryRunner, input)).toBeFalsy();
            } finally {
                await queryRunner.dropIndex('user', 'IDX_integration_to');
            }

            expect((await getSchemaDrift(dataSource)).exists).toBeFalsy();
        } finally {
            await queryRunner.release();
        }
    });

    it.runIf(!supportsSchemaAlter(driver))('should refuse to rename', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            await expect(renameIndex(queryRunner, {
                table: 'user',
                from: 'IDX_from',
                to: 'IDX_to',
            })).rejects.toThrow(DriverError);

            await expect(renameForeignKey(queryRunner, {
                table: 'user',
                from: 'FK_from',
                to: 'FK_to',
            })).rejects.toThrow(DriverError);
        } finally {
            await queryRunner.release();
        }
    });

    it('should change a column type without losing the values', async () => {
        const queryRunner = dataSource.createQueryRunner();
        const repository = dataSource.getRepository(User);

        try {
            const user = await repository.save(repository.create({
                firstName: 'foo',
                lastName: 'bar',
                email: 'foo@bar.baz',
            }));

            // the driver decides how a string column materializes —
            // character varying on postgres, varchar(255) on mysql
            const current = (await queryRunner.getTable('user'))!.findColumnByName('email')!;
            const original = {
                type: current.type,
                length: current.length,
            };

            // narrowing the length is the one change every driver can express —
            // text/clob/string are spelled differently per driver
            const input = {
                table: 'user',
                column: 'email',
                from: original,
                to: {
                    type: original.type,
                    length: 64,
                },
            };

            expect(await changeColumnType(queryRunner, input)).toBeTruthy();

            const table = await queryRunner.getTable('user');
            expect(table!.findColumnByName('email')!.length).toEqual('64');

            // the column is altered in place — mysql's changeColumn would have
            // dropped & re-added it, and with it every value it holds
            expect(await repository.findOneBy({ id: user.id })).toEqual(
                expect.objectContaining({ email: 'foo@bar.baz' }),
            );

            // running it again is a no-op
            expect(await changeColumnType(queryRunner, input)).toBeFalsy();

            expect((await getSchemaDrift(dataSource)).exists).toBeTruthy();

            expect(await changeColumnType(queryRunner, {
                table: 'user',
                column: 'email',
                from: {
                    type: original.type,
                    length: 64,
                },
                to: original,
            })).toBeTruthy();

            expect((await getSchemaDrift(dataSource)).exists).toBeFalsy();

            await repository.delete(user.id);
        } finally {
            await queryRunner.release();
        }
    });

    /**
     * The tables are created here rather than taken from the fixtures, because
     * widening is only expressible on a foreign key over a string column —
     * mysql requires the two ends of a numeric one to keep the same size.
     */
    it.runIf(supportsForeignKeyColumnAlter(driver))('should widen a foreign key column', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            await queryRunner.createTable(new Table({
                name: 'tex_parent',
                columns: [
                    {
                        name: 'id', 
                        type: 'varchar', 
                        length: '36', 
                        isPrimary: true,
                    },
                ],
            }), true);

            await queryRunner.createTable(new Table({
                name: 'tex_child',
                columns: [
                    {
                        name: 'id', 
                        type: 'varchar', 
                        length: '36', 
                        isPrimary: true,
                    },
                    {
                        name: 'parent_id', 
                        type: 'varchar', 
                        length: '36', 
                    },
                ],
                foreignKeys: [
                    {
                        name: 'FK_tex_child_parent',
                        columnNames: ['parent_id'],
                        referencedTableName: 'tex_parent',
                        referencedColumnNames: ['id'],
                    },
                ],
            }), true);

            try {
                await queryRunner.query('INSERT INTO `tex_parent` (`id`) VALUES (\'p\')');
                await queryRunner.query('INSERT INTO `tex_child` (`id`, `parent_id`) VALUES (\'c\', \'p\')');

                await withForeignKeyChecksDisabled(queryRunner, async () => {
                    expect(await changeColumnType(queryRunner, {
                        table: 'tex_child',
                        column: 'parent_id',
                        from: { type: 'varchar', length: 36 },
                        to: { type: 'varchar', length: 255 },
                    })).toBeTruthy();
                });

                // asked from the server rather than from the driver, which
                // reports 255 as `` — the default length it assumes for a
                // varchar of a table it has no entity metadata for
                const [column] = await queryRunner.query(
                    'SELECT CHARACTER_MAXIMUM_LENGTH AS size FROM information_schema.COLUMNS ' +
                    'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = \'tex_child\' ' +
                    'AND COLUMN_NAME = \'parent_id\'',
                );
                expect(`${column.size}`).toEqual('255');

                // dropping the column would have been refused outright
                // (ER_FK_COLUMN_CANNOT_DROP), even with the checks disabled
                const table = await queryRunner.getTable('tex_child');
                expect(table!.foreignKeys.length).toEqual(1);

                expect(await queryRunner.query('SELECT `parent_id` FROM `tex_child`'))
                    .toEqual([{ parent_id: 'p' }]);
            } finally {
                await queryRunner.dropTable('tex_child', true);
                await queryRunner.dropTable('tex_parent', true);
            }
        } finally {
            await queryRunner.release();
        }
    });

    it('should pass the foreign key checks scope through', async () => {
        const queryRunner = dataSource.createQueryRunner();

        try {
            if (!supportsForeignKeyChecks(driver)) {
                expect(await withForeignKeyChecksDisabled(queryRunner, async () => 'done')).toEqual('done');

                return;
            }

            expect(await readForeignKeyChecks(queryRunner)).toEqual('1');

            await withForeignKeyChecksDisabled(queryRunner, async () => {
                expect(await readForeignKeyChecks(queryRunner)).toEqual('0');

                // a nested scope must not restore the checks early
                await withForeignKeyChecksDisabled(queryRunner, async () => {
                    expect(await readForeignKeyChecks(queryRunner)).toEqual('0');
                });

                expect(await readForeignKeyChecks(queryRunner)).toEqual('0');
            });

            expect(await readForeignKeyChecks(queryRunner)).toEqual('1');
        } finally {
            await queryRunner.release();
        }
    });
});
