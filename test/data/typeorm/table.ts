import { Table } from 'typeorm';

/**
 * A minimal loaded table, as a query runner would report it.
 */
export function createTable(options: Record<string, any> = {}) : Table {
    return new Table({
        name: 'user',
        columns: [
            {
                name: 'id',
                type: 'int',
                isPrimary: true,
            },
            {
                name: 'roleId',
                type: 'varchar',
                length: '36',
                isNullable: true,
            },
        ],
        ...options,
    });
}

export const TABLE_FOREIGN_KEYS = [
    {
        name: 'FK_from',
        columnNames: ['roleId'],
        referencedTableName: 'role',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
    },
];
