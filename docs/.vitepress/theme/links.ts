/**
 * The one rule for "external" across the theme: absolute `http(s)://` and
 * protocol-relative `//host` links open in a new tab and skip `withBase()`.
 */
export function isExternalLink(link: string): boolean {
    return /^(?:https?:)?\/\//i.test(link);
}
