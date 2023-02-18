const TRAILING_SLASH_RE = /\/$|\/\?/;

export function hasTrailingSlash(input = '', queryParams = false): boolean {
    if (!queryParams) {
        return input.endsWith('/');
    }

    return TRAILING_SLASH_RE.test(input);
}

export function withoutTrailingSlash(input = '', queryParams = false): string {
    if (!queryParams) {
        return (hasTrailingSlash(input) ? input.slice(0, -1) : input) || '/';
    }

    if (!hasTrailingSlash(input, true)) {
        return input || '/';
    }

    const [s0, ...s] = input.split('?');

    return (s0.slice(0, -1) || '/') + (s.length ? `?${s.join('?')}` : '');
}
