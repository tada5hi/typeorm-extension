import { ObjectLiteral, SelectQueryBuilder} from "typeorm";
import { dataSource } from './data-source';
export class FakeSelectQueryBuilder<T extends ObjectLiteral = ObjectLiteral> extends SelectQueryBuilder<T> {
    constructor() {
        super(dataSource);
    }

    override addSelect(
        _selection: string|string[]|((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        _selectionAliasName?: string
    ): this {
        return this;
    }

    override leftJoinAndSelect(
        _entityOrProperty: Function|string|((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>),
        _alias: string,
        _condition: string = "",
        _parameters?: ObjectLiteral
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
