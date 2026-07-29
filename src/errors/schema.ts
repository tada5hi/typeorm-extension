import type { SchemaDriftStatement } from '../database/schema/drift/type';
import { TypeormExtensionError } from './base';

function buildMessage(statements: SchemaDriftStatement[]): string {
    const lines = statements.map((statement) => (
        statement.parameters && statement.parameters.length > 0 ?
            `${statement.query} -- ${JSON.stringify(statement.parameters)}` :
            statement.query
    ));

    return [
        `The database schema deviates from the entity metadata (${statements.length} statement(s) required to reconcile it):`,
        ...lines,
    ].join('\n');
}

export class SchemaDriftError extends TypeormExtensionError {
    /**
     * The statements which would reconcile the database schema
     * with the entity metadata.
     */
    readonly statements: SchemaDriftStatement[];

    constructor(statements: SchemaDriftStatement[] = [], message?: string) {
        super(message || buildMessage(statements));

        this.statements = statements;
    }

    static detected(statements: SchemaDriftStatement[]) {
        return new SchemaDriftError(statements);
    }
}
