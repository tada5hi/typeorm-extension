export default function createDataSource(name: string) {
    throw new Error(`A default export function with parameters must not be called (${name}).`);
}
