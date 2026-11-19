export type InlineSegment = {
    text: string;
    code: boolean;
};

/**
 * Split frontmatter copy on backticks so `name` renders as <code>
 * without v-html.
 */
export function splitInlineCode(input: string): InlineSegment[] {
    return input
        .split('`')
        .map((text, index) => ({ text, code: index % 2 === 1 }))
        .filter((segment) => segment.text.length > 0);
}
