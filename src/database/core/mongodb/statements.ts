/**
 * MongoDB statements are JSON encoded command documents,
 * executed via db.command() by the adapter.
 *
 * @link https://www.mongodb.com/docs/manual/reference/command/dropDatabase/
 */
export function buildMongoDBDropDatabaseCommand(): string {
    return JSON.stringify({ dropDatabase: 1 });
}
