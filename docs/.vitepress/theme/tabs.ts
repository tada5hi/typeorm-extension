/**
 * Keep a tab index inside `[0, count - 1]`; `0` when there are no tabs or
 * the index is not a number.
 */
export function clampTabIndex(index: number, count: number): number {
    if (count <= 0 || !Number.isFinite(index)) {
        return 0;
    }

    return Math.min(Math.max(Math.trunc(index), 0), count - 1);
}

/**
 * The tab a key moves to in a WAI-ARIA tablist: Left/Right wrap around,
 * Home/End go to the first/last tab. `undefined` for any other key.
 */
export function moveTabIndex(key: string, current: number, count: number): number | undefined {
    if (count <= 0) {
        return undefined;
    }

    switch (key) {
        case 'ArrowRight':
            return (current + 1) % count;
        case 'ArrowLeft':
            return (current - 1 + count) % count;
        case 'Home':
            return 0;
        case 'End':
            return count - 1;
        default:
            return undefined;
    }
}
