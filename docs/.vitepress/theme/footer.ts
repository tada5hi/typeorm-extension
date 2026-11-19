import type { TeFooterColumn, TeFooterConfig, TeFooterLink } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}

function resolveLink(value: unknown, path: string): TeFooterLink {
    const link = isRecord(value) ? value.link : undefined;

    if (typeof link !== 'string' || link.length === 0) {
        throw new Error(`${path}.link is missing`);
    }

    const text = isRecord(value) && typeof value.text === 'string' ? value.text : link;

    return { text, link };
}

/**
 * Read `themeConfig.teFooter`. Returns `undefined` when the site sets none,
 * drops columns without links and names the entry of a link without `link`.
 */
export function resolveFooter(themeConfig: unknown): TeFooterConfig | undefined {
    if (!isRecord(themeConfig) || !isRecord(themeConfig.teFooter)) {
        return undefined;
    }

    const footer = themeConfig.teFooter;

    const columns: TeFooterColumn[] = toArray(footer.columns)
        .map((column, i) => {
            const record = isRecord(column) ? column : {};

            return {
                title: typeof record.title === 'string' ? record.title : '',
                links: toArray(record.links).map((link, j) => resolveLink(
                    link,
                    `themeConfig.teFooter.columns[${i}].links[${j}]`,
                )),
            };
        })
        .filter((column) => column.links.length > 0);

    return {
        tagline: typeof footer.tagline === 'string' ? footer.tagline : '',
        columns,
        note: typeof footer.note === 'string' ? footer.note : undefined,
    };
}
