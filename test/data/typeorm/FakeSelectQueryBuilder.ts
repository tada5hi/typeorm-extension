import {DataSource, ObjectLiteral, SelectQueryBuilder} from "typeorm";

export class FakeEntity{

}
export class FakeSelectQueryBuilder extends SelectQueryBuilder<FakeEntity> {
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
