import type { ObjectLiteral } from 'rapiq';
import { MssqlParameter, Table } from 'typeorm';
import type { DataSource, DataSourceOptions, QueryRunner } from 'typeorm';
import type { MongoQueryRunner } from 'typeorm/driver/mongodb/MongoQueryRunner';
import { useEnv } from '../env';
import { PathResolverMode, createPathResolver } from '../utils';
import type { IPathResolver } from '../utils';
import { resolveSeederConfig } from './config';
import { SeederEntity } from './entity';
import { SeederFactoryManager, prepareSeederFactories, useSeederFactoryManager } from './factory';
import type {
    SeederConfig,
    SeederExecutorOptions,
    SeederOptions,
    SeederPrepareElement,
} from './type';
import { prepareSeederSeeds } from './utils';

export class SeederExecutor {
    protected dataSource : DataSource;

    protected options : SeederExecutorOptions;

    protected pathResolver : IPathResolver;

    constructor(dataSource: DataSource, options?: SeederExecutorOptions) {
        this.dataSource = dataSource;
        this.options = options || {};
        this.pathResolver = createPathResolver({
            root: this.options.root,
            tsconfig: this.options.tsconfig,
            mode: this.options.preserveFilePaths ?
                PathResolverMode.PRESERVE :
                PathResolverMode.AUTO,
        });
    }

    async execute(input: SeederOptions = {}) : Promise<SeederEntity[]> {
        const config = await this.resolveConfig(input);

        await prepareSeederFactories(config.factories, this.options.root);

        const all = await this.loadEntities(config);

        const tracking = config.seedTracking ||
            all.some((seed) => seed.effectiveTracking(config.seedTracking));

        let queryRunner : QueryRunner | undefined;
        let existing : SeederEntity[] = [];

        try {
            if (tracking) {
                queryRunner = this.dataSource.createQueryRunner();
                await this.createTableIfNotExist(queryRunner, config.seedTableName);
                existing = await this.loadExisting(queryRunner, config.seedTableName);
            }

            const pending = this.filterPending(all, existing, config);
            if (pending.length === 0) {
                return [];
            }

            this.dataSource.logger.logSchemaBuild(
                `${existing.length} seeds are already present in the database.`,
            );
            this.dataSource.logger.logSchemaBuild(
                `${all.length} seeds were found in the source code.`,
            );

            return await this.runPending(pending, config, queryRunner);
        } finally {
            if (queryRunner) {
                await queryRunner.release();
            }
        }
    }

    protected async resolveConfig(input: SeederOptions = {}) : Promise<SeederConfig> {
        const config = resolveSeederConfig(input, this.dataSourceOptions, useEnv());

        await this.pathResolver.transformKeys(
            config,
            ['seeds', 'seedName', 'factories'],
        );

        return config;
    }

    protected async loadEntities(config: SeederConfig) : Promise<SeederEntity[]> {
        const elements = await prepareSeederSeeds(
            config.seeds,
            this.options.root,
        );

        return this.buildEntities(elements);
    }

    protected filterPending(
        all: SeederEntity[],
        existing: SeederEntity[],
        config: SeederConfig,
    ) : SeederEntity[] {
        return all.filter((seed) => {
            if (!this.isMatch(seed, config)) {
                return false;
            }

            const index = existing.findIndex(
                (el) => el.name === seed.name,
            );

            if (index === -1) {
                return true;
            }

            return !seed.effectiveTracking(config.seedTracking);
        });
    }

    protected isMatch(seed: SeederEntity, config: SeederConfig) : boolean {
        if (!config.seedName) {
            return true;
        }

        if (
            seed.name === config.seedName ||
            seed.fileName === config.seedName
        ) {
            return true;
        }

        if (!seed.filePath) {
            return false;
        }

        if (seed.filePath === config.seedName) {
            return true;
        }

        return this.pathResolver.absolutize(config.seedName) === seed.filePath;
    }

    protected async runPending(
        pending: SeederEntity[],
        config: SeederConfig,
        queryRunner?: QueryRunner,
    ) : Promise<SeederEntity[]> {
        const factoryManager = new SeederFactoryManager({
            items: useSeederFactoryManager().items,
            dataSource: this.dataSource,
        });

        const executed : SeederEntity[] = [];

        for (const element of pending) {
            const seeder = element.instance;
            if (!seeder) {
                continue;
            }

            element.result = await seeder.run(this.dataSource, factoryManager);

            if (queryRunner && element.effectiveTracking(config.seedTracking)) {
                await this.track(queryRunner, element, config.seedTableName);
            }

            this.dataSource.logger.logSchemaBuild(
                `Seed ${element.name} has been executed successfully.`,
            );

            executed.push(element);
        }

        return executed;
    }

    protected async loadExisting(
        queryRunner: QueryRunner,
        tableName: string,
    ) : Promise<SeederEntity[]> {
        if (this.dataSource.driver.options.type === 'mongodb') {
            const mongoRunner = queryRunner as MongoQueryRunner;

            return mongoRunner
                .cursor(tableName, {})
                .sort({ _id: -1 })
                .toArray();
        }

        const raw: ObjectLiteral[] = await this.dataSource.manager
            .createQueryBuilder(queryRunner)
            .select()
            .orderBy(this.dataSource.driver.escape('id'), 'DESC')
            .from(this.buildTableName(tableName), tableName)
            .getRawMany();

        return raw.map((migrationRaw) => new SeederEntity({
            id: Number.parseInt(migrationRaw.id, 10),
            timestamp: Number.parseInt(migrationRaw.timestamp, 10),
            name: migrationRaw.name,
            constructor: undefined,
        }));
    }

    protected async buildEntities(seeds?: SeederPrepareElement[]): Promise<SeederEntity[]> {
        if (!seeds) {
            return [];
        }

        let timestampCounter = 0;
        const entities = seeds.map((element) => {
            const {
                constructor: seed,
                fileName,
                filePath,
            } = element;

            let { timestamp } = element;

            const className = seed.name || (seed.constructor as any).name;

            if (!timestamp) {
                timestamp = this.classNameToTimestamp(className);
            }

            const entity = new SeederEntity({
                fileName,
                filePath,
                timestamp: timestamp || timestampCounter,
                name: className,
                constructor: seed,
            });

            timestampCounter++;

            return entity;
        });

        this.checkForDuplicates(entities);

        return entities.sort(SeederEntity.compare);
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

    protected async createTableIfNotExist(
        queryRunner: QueryRunner,
        tableName: string,
    ) {
        // If driver is mongo no need to create
        if (this.dataSource.driver.options.type === 'mongodb') {
            return;
        }
        const tableExist = await queryRunner.hasTable(this.buildTableName(tableName));
        if (!tableExist) {
            await queryRunner.createTable(
                new Table({
                    database: this.database,
                    schema: this.schema,
                    name: this.buildTableName(tableName),
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
        tableName: string,
    ): Promise<void> {
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
                this.dataSource.driver.normalizeType({ type: this.dataSource.driver.mappedDataTypes.migrationName }) as any,
            );
        } else {
            values.timestamp = seederEntity.timestamp;
            values.name = seederEntity.name;
        }

        if (this.dataSource.driver.options.type === 'mongodb') {
            const mongoRunner = queryRunner as MongoQueryRunner;
            await mongoRunner.databaseConnection
                .db(this.dataSource.driver.database)
                .collection(tableName)
                .insertOne(values);
        } else {
            const qb = queryRunner.manager.createQueryBuilder();
            await qb
                .insert()
                .into(this.buildTableName(tableName))
                .values(values)
                .execute();
        }
    }

    protected get dataSourceOptions() : DataSourceOptions & SeederOptions {
        return this.dataSource.options;
    }

    protected get database() {
        return this.dataSource.driver.database;
    }

    protected get schema() {
        return this.dataSource.driver.schema;
    }

    protected buildTableName(tableName: string) : string {
        return this.dataSource.driver.buildTableName(
            tableName,
            this.schema,
            this.database,
        );
    }

    protected classNameToTimestamp(className: string) {
        const match = className.match(/^(.*)([0-9]{13,})$/);
        if (match) {
            return Number.parseInt(match[2], 10);
        }

        return undefined;
    }
}
