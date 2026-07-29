import type { DataSourceOptions, Table, TableColumn } from 'typeorm';

export type FakeQueryRunnerOptions = {
    type: DataSourceOptions['type'],
    tables?: Table[],
    /**
     * Simulate server state — the return value of a query, and the
     * opportunity to mutate the loaded tables in response to a statement.
     */
    respond?: (query: string, runner: FakeQueryRunner) => unknown
};

export type FakeChangeColumnCall = {
    table: string,
    from: string,
    to: TableColumn
};

/**
 * Recording in-memory stand-in for a typeorm QueryRunner, limited to the
 * schema inspection & alteration surface used by the guarded schema helpers.
 */
export class FakeQueryRunner {
    queries : string[] = [];

    changedColumns : FakeChangeColumnCall[] = [];

    dataSource : Record<string, any>;

    protected tables : Record<string, Table>;

    protected respond : (query: string, runner: FakeQueryRunner) => unknown;

    constructor(options: FakeQueryRunnerOptions) {
        this.tables = {};
        for (const table of options.tables || []) {
            this.tables[table.name] = table;
        }

        this.respond = options.respond || (() => []);

        const { type } = options;
        this.dataSource = {
            options: { type },
            driver: {
                normalizeType: (column: { type?: any }) : string => {
                    const value = `${column.type}`;

                    if (type === 'postgres' && value === 'varchar') {
                        return 'character varying';
                    }

                    return value;
                },
                createFullType: (column: { type?: any, length?: string }) : string => {
                    const value = `${column.type}`;

                    return column.length ? `${value}(${column.length})` : value;
                },
            },
        };
    }

    setTable(table: Table) {
        this.tables[table.name] = table;
    }

    unsetTable(name: string) {
        delete this.tables[name];
    }

    async getTable(name: string) : Promise<Table | undefined> {
        return this.tables[name];
    }

    async query(query: string) : Promise<unknown> {
        this.queries.push(query);

        return this.respond(query, this);
    }

    async changeColumn(table: Table | string, from: TableColumn | string, to: TableColumn) {
        this.changedColumns.push({
            table: typeof table === 'string' ? table : table.name,
            from: typeof from === 'string' ? from : from.name,
            to,
        });
    }
}
