import {ObjectLiteral, SelectQueryBuilder} from "typeorm";

export class FakeSelectQueryBuilder extends SelectQueryBuilder<any>{
    constructor() {
        super(undefined);
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
