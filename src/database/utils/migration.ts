import path from 'node:path';
import { CommandUtils } from 'typeorm/commands/CommandUtils';
import { MigrationGenerateCommand } from 'typeorm/commands/MigrationGenerateCommand';
import { resolveFilePath } from '../../utils';
import type { MigrationGenerateCommandContext, MigrationGenerateResult } from './type';

/**
 * typeorm keeps the statement escaping, the query-parameter formatting and both file
 * templates as protected statics on its migration:generate command. Subclassing is the
 * only way to reach them, and reusing them keeps the generated file byte-identical to
 * the output of `typeorm migration:generate`.
 */
class GenerateCommand extends MigrationGenerateCommand {
    static buildStatement(query: string, parameters: any[] | undefined, prettify?: boolean) : string {
        const statement = prettify ? this.prettifyQuery(query) : query;

        return `await queryRunner.query(\`${this.escapeTemplateLiteral(statement)}\`${this.queryParams(parameters)});`;
    }

    static buildContent(
        context: Required<Pick<MigrationGenerateCommandContext, 'name' | 'timestamp' | 'language' | 'esm'>>,
        up: string[],
        down: string[],
    ) : string {
        // the templates expect the statements already indented to their place in the class body.
        const upStatements = up.map((statement) => `        ${statement}`);
        const downStatements = down.map((statement) => `        ${statement}`);

        if (context.language === 'js') {
            return this.getJavascriptTemplate(
                context.name,
                context.timestamp,
                upStatements,
                downStatements,
                context.esm,
            );
        }

        return this.getTemplate(
            context.name,
            context.timestamp,
            upStatements,
            downStatements,
        );
    }
}

export async function generateMigration(
    context: MigrationGenerateCommandContext,
) : Promise<MigrationGenerateResult> {
    const name = context.name || 'Default';
    const timestamp = context.timestamp || Date.now();
    const language = context.language || 'ts';

    const sqlInMemory = await context.dataSource.driver.createSchemaBuilder().log();

    const up = sqlInMemory.upQueries.map(
        (query) => GenerateCommand.buildStatement(query.query, query.parameters, context.prettify),
    );

    // the down statements undo the up statements and therefore run in reverse order.
    const down = sqlInMemory.downQueries.map(
        (query) => GenerateCommand.buildStatement(query.query, query.parameters, context.prettify),
    ).reverse();

    if (
        up.length === 0 &&
        down.length === 0
    ) {
        return { up, down };
    }

    const content = GenerateCommand.buildContent({
        name,
        timestamp,
        language,
        esm: context.esm || false,
    }, up, down);

    if (!context.preview) {
        const directoryPath = resolveFilePath(context.directoryPath || 'migrations');

        await CommandUtils.createFile(
            path.join(directoryPath, `${timestamp}-${name}.${language}`),
            content,
        );
    }

    return {
        up,
        down,
        content,
    };
}
