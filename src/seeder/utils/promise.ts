/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

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
