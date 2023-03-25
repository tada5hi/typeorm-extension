import {DataSource, DataSourceOptions} from "typeorm";
import {generateMigration} from "../../../src";
import {User} from "../../data/entity/user";

describe('src/database/migration', () => {
    it('should generate migration file', async () => {
        const options : DataSourceOptions = {
            type: 'better-sqlite3',
            entities: [User],
            database: ':memory:',
            extra: {
                charset: "UTF8_GENERAL_CI"
            }
        }
        const dataSource = new DataSource(options);

        const output = await generateMigration({
            dataSource,
            preview: true
        });

        expect(output).toBeDefined();
        expect(output.up).toBeDefined();
        expect(output.up.length).toBeGreaterThanOrEqual(1);
        expect(output.up[0]).toEqual('await queryRunner.query(`CREATE TABLE "user" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "firstName" varchar NOT NULL, "lastName" varchar NOT NULL, "email" varchar NOT NULL, "foo" varchar NOT NULL)`);')

        expect(output.down).toBeDefined();
        expect(output.down.length).toBeGreaterThanOrEqual(1);
        expect(output.down[0]).toEqual('await queryRunner.query(`DROP TABLE "user"`);')
    })
})
