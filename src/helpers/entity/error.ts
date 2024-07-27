import { TypeormExtensionError } from '../../errors';

type TypeormRelationLookupErrorOptions = {
    message: string,
    relation: string,
    columns: string[]
};

export class EntityRelationLookupError extends TypeormExtensionError {
    /**
     * The property name of the relation.
     */
    public relation: string;

    /**
     * The property names of the join columns.
     */
    public columns: string[];

    constructor(options: TypeormRelationLookupErrorOptions) {
        super(options.message);

        this.relation = options.relation;
        this.columns = options.columns;
    }

    static notReferenced(relation: string, columns: string[]) {
        return new EntityRelationLookupError({
            message: `${relation} entity is not referenced by ${columns.join(', ')}`,
            relation,
            columns,
        });
    }

    static notFound(relation: string, columns: string[]) {
        return new EntityRelationLookupError({
            message: `Can't find ${relation} entity by ${columns.join(', ')}`,
            relation,
            columns,
        });
    }
}
