/**
 * One token of a catalogue expression: a string literal, a quoted identifier (`"a"`, `[a]`,
 * `` `a` ``), a word, or any other single character.
 */
type Token = {
    kind: 'literal' | 'identifier' | 'word' | 'other',
    text: string,
};

const QUOTES: Record<string, string> = {
    '"': '"',
    '[': ']',
    '`': '`',
};

/**
 * The index after a quoted run starting at `start` (the opening quote), or -1 when it does not
 * end. A doubled closing quote is part of the run; `backslash` lets a backslash escape the next
 * character (a cockroachdb `e'...'` literal).
 */
function scan(text: string, start: number, close: string, backslash: boolean): number {
    for (let i = start + 1; i < text.length; i++) {
        if (backslash && text[i] === '\\') {
            i++;
        } else if (text[i] === close) {
            if (text[i + 1] !== close) {
                return i + 1;
            }

            i++;
        }
    }

    return -1;
}

/**
 * Split a catalogue expression into tokens, or undefined when its quoting can not be told apart
 * for sure: a comment (`--`, `/*`), an oracle q-quote (`q'[...]'`), a national literal (`N'...'`),
 * a quote character inside a quoted identifier, or an unterminated quote. A caller then leaves the
 * text untouched: misreading a literal could change what it compares.
 */
export function tokenize(text: string): Token[] | undefined {
    const tokens: Token[] = [];
    let i = 0;

    while (i < text.length) {
        const char = text[i];
        const previous = tokens.at(-1);
        // a one letter prefix right before a quote: e'...', N'...', q'...'
        const prefixed = previous?.kind === 'word' && previous.text.length === 1 && text[i - 1] === previous.text;

        if (text.startsWith('--', i) || text.startsWith('/*', i)) {
            return undefined;
        }

        if (char === '\'') {
            if (prefixed && /^[qn]$/i.test(previous.text)) {
                return undefined;
            }

            const end = scan(text, i, '\'', prefixed && /^e$/i.test(previous.text));

            if (end === -1) {
                return undefined;
            }

            tokens.push({ kind: 'literal', text: text.slice(i, end) });
            i = end;
        } else if (QUOTES[char]) {
            const end = scan(text, i, QUOTES[char], false);

            if (end === -1 || text.slice(i + 1, end - 1).includes('\'')) {
                return undefined;
            }

            tokens.push({ kind: 'identifier', text: text.slice(i, end) });
            i = end;
        } else if (/[\w$#@]/.test(char)) {
            const match = /^[\w$#@]+/.exec(text.slice(i)) as RegExpExecArray;

            tokens.push({ kind: 'word', text: match[0] });
            i += match[0].length;
        } else {
            tokens.push({ kind: 'other', text: char });
            i++;
        }
    }

    return tokens;
}
