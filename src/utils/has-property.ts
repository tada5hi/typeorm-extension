export function hasOwnProperty<X extends Record<string, any>, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

export function hasStringProperty<X extends Record<string, any>, Y extends PropertyKey>(obj: X, prop: Y): obj is X & Record<Y, string> {
    return hasOwnProperty(obj, prop) &&
        typeof obj[prop] === 'string';
}
