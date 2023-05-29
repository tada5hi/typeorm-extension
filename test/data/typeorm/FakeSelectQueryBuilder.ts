import type { ObjectLiteral } from 'typeorm';
import { SelectQueryBuilder } from 'typeorm';
import { dataSource } from './data-source';

export class FakeSelectQueryBuilder<T extends ObjectLiteral = ObjectLiteral> extends SelectQueryBuilder<T> {
    constructor() {
        super(dataSource);
    }

    override addSelect(
        _selection: string | string[] | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        _selectionAliasName?: string,
    ): this {
        return this;
    }

    override leftJoinAndSelect(
        // eslint-disable-next-line @typescript-eslint/ban-types
        _entityOrProperty: Function | string | ((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        _alias: string,
        // eslint-disable-next-line default-param-last
        _condition = '',
        _parameters?: ObjectLiteral,
    ): this {
        return this;
    }

    override take(_take?: number): this {
        return this;
    }

    override skip(_skip?: number): this {
        return this;
    }
}
