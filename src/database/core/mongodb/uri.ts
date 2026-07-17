import type { ConnectionParams } from '../type';

export function buildMongoDBConnectionUri(params: ConnectionParams, database?: string): string {
    let uri = 'mongodb://';

    if (params.user && params.password) {
        uri += `${encodeURIComponent(params.user)}:${encodeURIComponent(params.password)}@`;
    }

    uri += `${params.host || '127.0.0.1'}:${params.port || 27017}/${database ?? params.database}`;

    if (params.ssl) {
        uri += '?tls=true';
    }

    return uri;
}
