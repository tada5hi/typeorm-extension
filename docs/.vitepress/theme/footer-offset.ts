/**
 * Height of the footer that is inside the viewport, in pixels.
 *
 * `footerTop` is the footer's top edge relative to the viewport
 * (`getBoundingClientRect().top`). The result is never negative and never
 * more than the viewport height.
 */
export function footerVisibleHeight(viewportHeight: number, footerTop: number): number {
    if (!Number.isFinite(viewportHeight) || !Number.isFinite(footerTop)) {
        return 0;
    }

    return Math.min(Math.max(0, viewportHeight - footerTop), Math.max(0, viewportHeight));
}
