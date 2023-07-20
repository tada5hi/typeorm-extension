import type { ObjectLiteral } from 'rapiq';
import { MssqlParameter, Table } from 'typeorm';
import type { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import type { MongoQueryRunner } from 'typeorm/driver/mongodb/MongoQueryRunner';
import { adjustFilePathsForDataSourceOptions, setDataSource } from '../data-source';
import { useEnv } from '../env';
import { SeederEntity } from './entity';
import { prepareSeederFactories, useSeederFactoryManager } from './factory';
import type { SeederOptions, SeederPrepareElement } from './type';
import { prepareSeederSeeds } from './utils';

export class SeederExecutor {
    protected dataSource : DataSource;

    private readonly tableName: string;

    constructor(dataSource: DataSource) {
        this.dataSource = dataSource;

        setDataSource(dataSource);

        this.tableName = this.options.seedTableName || 'seeds';
    }

    async execute(input: SeederOptions = {}) : Promise<SeederEntity[]> {
        const queryRunner = this.dataSource.createQueryRunner();
        await this.createTableIfNotExist(queryRunner);

        const options = await this.buildOptions(input);
        if (!options.seeds || options.seeds.length === 0) {
            return [];
        }

        if (options.factories) {
            await prepareSeederFactories(options.factories);
        }

        const seederElements = await prepareSeederSeeds(options.seeds);

        const existing = await this.loadExisting(queryRunner);
        const all = await this.buildEntities(seederElements);

        const pending = all.filter((seed) => {
            if (
                options.seedName &&
                options.seedName !== seed.name
            ) {
                return false;
            }

            const index = existing.findIndex(
                (el) => el.name === seed.name,
            );

            return index === -1 || !seed.isOneTime();
        });

        if (pending.length === 0) {
            await queryRunner.release();

            return [];
        }

        this.dataSource.logger.logSchemaBuild(
            `${existing.length} seeds are already present in the database.`,
        );
        this.dataSource.logger.logSchemaBuild(
            `${all.length} seeds were found in the source code.`,
        );

        const factoryManager = useSeederFactoryManager();

        const executed : SeederEntity[] = [];

        try {
            for (let i = 0; i < pending.length; i++) {
                const seeder = pending[i].instance;
                if (!seeder) {
                    continue;
                }

                pending[i].result = await seeder.run(this.dataSource, factoryManager);

                await this.track(queryRunner, pending[i]);

                this.dataSource.logger.logSchemaBuild(
                    `Migration ${pending[i].name} has been executed successfully.`,
                );

                executed.push(pending[i]);
            }
        } finally {
            await queryRunner.release();
        }

        return executed;
    }

    protected async loadExisting(queryRunner: QueryRunner) : Promise<SeederEntity[]> {
        if (this.dataSource.driver.options.type === 'mongodb') {
            const mongoRunner = queryRunner as MongoQueryRunner;

            return mongoRunner
                .cursor(this.tableName, {})
                .sort({ _id: -1 })
                .toArray();
        }

        const raw: ObjectLiteral[] = await this.dataSource.manager
            .createQueryBuilder(queryRunner)
            .select()
            .orderBy(this.dataSource.driver.escape('id'), 'DESC')
            .from(this.table, this.tableName)
            .getRawMany();

        return raw.map((migrationRaw) => new SeederEntity({
            id: parseInt(migrationRaw.id, 10),
            timestamp: parseInt(migrationRaw.timestamp, 10),
            name: migrationRaw.name,
            constructor: undefined,
        }));
    }

    /**
     * Gets all migrations that setup for this connection.
     */
    protected async buildEntities(seeds?: SeederPrepareElement[]): Promise<SeederEntity[]> {
        if (!seeds) {
            return [];
        }

        let timestampCounter = 0;
        const entities = seeds.map((element) => {
            const {
                constructor: seed,
                fileName,
            } = element;

            let {
                timestamp,
            } = element;

            const className = seed.name || (seed.constructor as any).name;

            if (!timestamp) {
                timestamp = this.classNameToTimestamp(className);
            }

            const entity = new SeederEntity({
                fileName,
                timestamp: timestamp || timestampCounter,
                name: className,
                constructor: seed,
            });

            timestampCounter++;

            return entity;
        });

        this.checkForDuplicates(entities);

        // sort them by file name than by timestamp
        return entities.sort((a, b) => {
            if (
                typeof a.fileName !== 'undefined' &&
                typeof b.fileName !== 'undefined'
            ) {
                return a.name > b.name ? 1 : -1;
            }

            return a.timestamp - b.timestamp;
        });
    }

    protected checkForDuplicates(entities: SeederEntity[]) {
        const names = entities.map((migration) => migration.name);
        const duplicates = Array.from(
            new Set(
                names.filter(
                    (migrationName, index) => names.indexOf(migrationName) < index,
                ),
            ),
        );
        if (duplicates.length > 0) {
            throw Error(`Duplicate seeds: ${duplicates.join(', ')}`);
        }
    }

    protected async createTableIfNotExist(queryRunner: QueryRunner) {
        // If driver is mongo no need to create
        if (this.dataSource.driver.options.type === 'mongodb') {
            return;
        }
        const tableExist = await queryRunner.hasTable(this.table);
        if (!tableExist) {
            await queryRunner.createTable(
                new Table({
                    database: this.database,
                    schema: this.schema,
                    name: this.table,
                    columns: [
                        {
                            name: 'id',
                            type: this.dataSource.driver.normalizeType({
                                type: this.dataSource.driver.mappedDataTypes
                                    .migrationId,
                            }),
                            isGenerated: true,
                            generationStrategy: 'increment',
                            isPrimary: true,
                            isNullable: false,
                        },
                        {
                            name: 'timestamp',
                            type: this.dataSource.driver.normalizeType({
                                type: this.dataSource.driver.mappedDataTypes
                                    .migrationTimestamp,
                            }),
                            isPrimary: false,
                            isNullable: false,
                        },
                        {
                            name: 'name',
                            type: this.dataSource.driver.normalizeType({
                                type: this.dataSource.driver.mappedDataTypes
                                    .migrationName,
                            }),
                            isNullable: false,
                        },
                    ],
                }),
            );
        }
    }

    protected async track(
        queryRunner: QueryRunner,
        seederEntity: SeederEntity,
    ): Promise<void> {
        if (!seederEntity.isOneTime()) {
            return;
        }

        const values: ObjectLiteral = {};
        if (this.dataSource.driver.options.type === 'mssql') {
            values.timestamp = new MssqlParameter(
                seederEntity.timestamp,
                this.dataSource.driver.normalizeType({
                    type: this.dataSource.driver.mappedDataTypes
                        .migrationTimestamp,
                }) as any,
            );
            values.name = new MssqlParameter(
                seederEntity.name,
                this.dataSource.driver.normalizeType({
                    type: this.dataSource.driver.mappedDataTypes.migrationName,
                }) as any,
            );
        } else {
            values.timestamp = seederEntity.timestamp;
            values.name = seederEntity.name;
        }

        if (this.dataSource.driver.options.type === 'mongodb') {
            const mongoRunner = queryRunner as MongoQueryRunner;
            await mongoRunner.databaseConnection
                .db(this.dataSource.driver.database)
                .collection(this.tableName)
                .insertOne(values);
        } else {
            const qb = queryRunner.manager.createQueryBuilder();
            await qb
                .insert()
                .into(this.table)
                .values(values)
                .execute();
        }
    }

    protected get options() : DataSourceOptions & SeederOptions {
        return this.dataSource.options;
    }

    protected get database() {
        return this.dataSource.driver.database;
    }

    protected get schema() {
        return this.dataSource.driver.schema;
    }

    protected get table() {
        return this.dataSource.driver.buildTableName(
            this.tableName,
            this.schema,
            this.database,
        );
    }

    protected async buildOptions(input: SeederOptions = {}) {
        const options : SeederOptions = {
            seeds: input.seeds || [],
            factories: input.factories || [],
        };

        if (!options.seeds || options.seeds.length === 0) {
            options.seeds = this.options.seeds;
        }

        if (!options.seeds || options.seeds.length === 0) {
            options.seeds = useEnv('seeds');
        }

        if (!options.seeds || options.seeds.length === 0) {
            options.seeds = ['src/database/seeds/**/*{.ts,.js}'];
        }

        if (!options.factories || options.factories.length === 0) {
            options.factories = this.options.factories;
        }

        if (!options.factories || options.factories.length === 0) {
            options.factories = useEnv('factories');
        }

        if (!options.factories || options.factories.length === 0) {
            options.factories = ['src/database/factories/**/*{.ts,.js}'];
        }

        await adjustFilePathsForDataSourceOptions(options, {
            keys: ['seeds', 'factories'],
        });

        return options;
    }

    protected classNameToTimestamp(className: string) {
        const match = className.match(/^(.*)([0-9]{13,})$/);
        if (match) {
            return parseInt(match[2], 10);
        }

        return undefined;
    }
}
