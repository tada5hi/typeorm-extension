export type FieldDetails = {
    name: string,
    path?: string,
    alias?: string
};

export function getFieldDetails(field: string) : FieldDetails {
    const parts : string[] = field.split('.');

    return {
        name: parts.pop(),
        path: parts.length > 0 ? parts.join('.'): undefined,
        alias: parts.length > 0 ? parts.pop() : undefined
    };
}
