export function isPromise(p: unknown) : p is Promise<unknown> {
    return typeof p === 'object' &&
        p !== null &&
        (
            p instanceof Promise ||
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            typeof p.then === 'function'
        );
}
