import { pascalCase } from 'pascal-case';
import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import { MigrationGenerateCommand } from 'typeorm/commands/MigrationGenerateCommand';
import type { MigrationGenerateCommandContext, MigrationGenerateResult } from './type';

class GenerateCommand extends MigrationGenerateCommand {
    static prettify(query: string) {
        return this.prettifyQuery(query);
    }
}

function queryParams(parameters: any[] | undefined): string {
    if (!parameters || !parameters.length) {
        return '';
    }

    return `, ${JSON.stringify(parameters)}`;
}

function buildTemplate(
    name: string,
    timestamp: number,
    upStatements: string[],
    downStatements: string[],
): string {
    const migrationName = `${pascalCase(name)}${timestamp}`;

    const up = upStatements.map((statement) => `        ${statement}`);
    const down = downStatements.map((statement) => `        ${statement}`);

    return `import { MigrationInterface, QueryRunner } from 'typeorm';

export class ${migrationName} implements MigrationInterface {
    name = '${migrationName}';

    public async up(queryRunner: QueryRunner): Promise<void> {
${up.join(`
`)}
    }
    public async down(queryRunner: QueryRunner): Promise<void> {
${down.join(`
`)}
    }
}
`;
}

export async function generateMigration(
    context: MigrationGenerateCommandContext,
) : Promise<MigrationGenerateResult> {
    context.name = context.name || 'Default';

    const timestamp = context.timestamp || new Date().getTime();
    const fileName = `${timestamp}-${context.name}.ts`;

    const { dataSource } = context;

    const up: string[] = []; const
        down: string[] = [];

    if (!dataSource.isInitialized) {
        await dataSource.initialize();
    }

    const sqlInMemory = await dataSource.driver.createSchemaBuilder().log();

    if (context.prettify) {
        sqlInMemory.upQueries.forEach((upQuery) => {
            upQuery.query = GenerateCommand.prettify(
                upQuery.query,
            );
        });
        sqlInMemory.downQueries.forEach((downQuery) => {
            downQuery.query = GenerateCommand.prettify(
                downQuery.query,
            );
        });
    }

    sqlInMemory.upQueries.forEach((upQuery) => {
        up.push(`await queryRunner.query(\`${upQuery.query.replace(/`/g, '\\`')}\`${queryParams(upQuery.parameters)});`);
    });

    sqlInMemory.downQueries.forEach((downQuery) => {
        down.push(`await queryRunner.query(\`${downQuery.query.replace(/`/g, '\\`')}\`${queryParams(downQuery.parameters)});`);
    });

    await dataSource.destroy();

    if (
        up.length === 0 &&
        down.length === 0
    ) {
        return { up, down };
    }

    const content = buildTemplate(context.name, timestamp, up, down.reverse());

    if (!context.preview) {
        let directoryPath : string;
        if (context.directoryPath) {
            if (!path.isAbsolute(context.directoryPath)) {
                directoryPath = path.join(process.cwd(), context.directoryPath);
            } else {
                directoryPath = context.directoryPath;
            }
        } else {
            directoryPath = path.join(process.cwd(), 'migrations');
        }

        try {
            await fs.promises.access(directoryPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (e) {
            await fs.promises.mkdir(directoryPath, { recursive: true });
        }

        const filePath = path.join(directoryPath, fileName);

        await fs.promises.writeFile(filePath, content, { encoding: 'utf-8' });
    }

    return {
        up,
        down,
        content,
    };
}
