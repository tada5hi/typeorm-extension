/*
 * Copyright (c) 2022.
 * Author Peter Placzek (tada5hi)
 * For the full copyright and license information,
 * view the LICENSE file that was distributed with this source code.
 */

export function toArray(input: string | string[]) : string[] {
    return Array.isArray(input) ? input : [input];
}
