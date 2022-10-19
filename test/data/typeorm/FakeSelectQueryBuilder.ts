import {DataSource, ObjectLiteral, SelectQueryBuilder} from "typeorm";

export class FakeSelectQueryBuilder<T extends ObjectLiteral = ObjectLiteral> extends SelectQueryBuilder<T> {
    constructor() {
        super({
            options: {}
        } as DataSource);
    }

    addSelect(selection: string|string[]|((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>), selectionAliasName?: string): this {
        return this;
    }

    leftJoinAndSelect(entityOrProperty: Function|string|((qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>), alias: string, condition: string = "", parameters?: ObjectLiteral): this {
        return this;
    }

    take(take?: number): this {
        return this;
    }

    skip(skip?: number): this {
        return this;
    }
}
